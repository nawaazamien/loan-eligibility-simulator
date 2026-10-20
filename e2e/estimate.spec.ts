import { expect, test } from '@playwright/test';

import {
  age,
  calculate,
  calculateEstimate,
  enter,
  estimate,
  field,
  FULL,
  horizontalOverflow,
  NONE,
  openApp,
  openSchedule,
  REDUCED,
  score,
  status,
  type Entry,
} from './helpers';

/** Spec example 150 000 over 24 months at 12.5%, with enough income that all of it is recommended. */
const SPEC_EXAMPLE: Entry = {
  ...FULL,
  income: '100000',
  expenses: '10000',
  debt: '0',
  score: '650',
  loan: '150000',
  term: '24',
};

test.describe('estimate', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('calculates through the mocked API, focuses the estimate and keeps it in view', async ({
    page,
  }) => {
    const calls: string[] = [];
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/'))
        calls.push(`${response.request().method()} ${url.pathname}`);
    });
    await calculateEstimate(page, FULL);

    const heading = page.getByRole('heading', { name: 'Your estimate' });
    await expect(heading).toBeInViewport();
    await expect(
      estimate(page).getByText('Estimated eligible for the amount requested'),
    ).toBeVisible();
    await expect(estimate(page).getByText('R3 297.60', { exact: true }).first()).toBeVisible();
    await expect(estimate(page)).toContainText('Illustrative approval likelihood 95%');
    await expect(estimate(page)).toContainText('Risk category Low');
    await expect(estimate(page)).toContainText('11.5% a year');
    await expect(estimate(page)).toContainText('R118 713.62');
    await expect(page.locator('[aria-live="polite"]')).toHaveText(
      'Estimate updated. Estimated eligible for the amount requested. Estimated monthly payment R3 297.60.',
    );
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    // The UI really used the client: eligibility, then the schedule (the page's earlier
    // GET requests for rules and products were made before this listener's first calculation).
    await expect.poll(() => calls).toContain('POST /api/loans/eligibility');
    await expect.poll(() => calls).toContain('POST /api/loans/calculate-rate');
  });

  test('shows the affordability analysis from the API', async ({ page }) => {
    await calculateEstimate(page, REDUCED);
    await page.getByRole('button', { name: 'Affordability details' }).click();
    const details = estimate(page);
    await expect(details).toContainText('R10 000 a month');
    await expect(details).toContainText('Debt-to-income ratio');
    await expect(details).toContainText('20%');
    await expect(details).toContainText('Loan-to-income ratio');
    await expect(details).toContainText('50%');
    await expect(details).toContainText('Affordability score');
    await expect(details).toContainText('Poor');
  });

  test('submits with Enter from a field', async ({ page }) => {
    await enter(page, FULL);
    await field(page, 'Existing monthly debt repayments').press('Enter');
    await expect(estimate(page).getByText('R3 297.60', { exact: true }).first()).toBeVisible();
  });

  test('recommends a smaller amount when the requested one does not fit', async ({ page }) => {
    await calculateEstimate(page, REDUCED);

    await expect(estimate(page).getByText('Estimated eligible for a smaller amount')).toBeVisible();
    await expect(estimate(page).getByText('R1 986.91', { exact: true }).first()).toBeVisible();
    await expect(estimate(page)).toContainText('Recommended amount');
    await expect(estimate(page)).toContainText('R42 000');
    await expect(estimate(page)).toContainText('R47 685.77');
    await expect(estimate(page)).toContainText('Illustrative approval likelihood 50%');
    await expect(estimate(page)).toContainText('Risk category Medium');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('shows when nothing can be recommended, with a reason', async ({ page }) => {
    await calculateEstimate(page, NONE);

    await expect(estimate(page).getByText('Estimated not eligible for this loan')).toBeVisible();
    await expect(estimate(page)).toContainText('No loan amount fits these figures in this demo.');
    await expect(estimate(page)).toContainText('Risk category High');
    await expect(estimate(page).getByText('Estimated monthly payment')).toHaveCount(0);
  });

  test('estimates an applicant with no credit score at the middle of the rate range', async ({
    page,
  }) => {
    await calculateEstimate(page, { ...FULL, score: '' });
    await expect(estimate(page)).toContainText('14.5% a year');
  });

  test('does not assess an unemployed applicant, and says so', async ({ page }) => {
    await enter(page, FULL);
    await status(page).selectOption('unemployed');
    await calculate(page).click();
    await expect(page.getByRole('heading', { name: 'Your estimate' })).toBeFocused();
    await expect(estimate(page).getByText('Estimated not eligible for this loan')).toBeVisible();
  });

  test('shows the complete schedule, with first and last rows matching an independent calculation', async ({
    page,
  }) => {
    await calculateEstimate(page, SPEC_EXAMPLE);
    const table = await openSchedule(page);
    await expect(table.getByRole('columnheader')).toHaveText([
      'Month',
      'Payment',
      'Principal',
      'Interest',
      'Remaining balance',
    ]);
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(24);
    await expect(rows.first().getByRole('cell')).toHaveText([
      'R7 096.10',
      'R5 533.60',
      'R1 562.50',
      'R144 466.40',
    ]);
    // The last payment absorbs the rounding so the balance ends at exactly R0.00.
    await expect(rows.last().getByRole('cell')).toHaveText([
      'R7 096.00',
      'R7 022.85',
      'R73.15',
      'R0.00',
    ]);
    await expect(table.locator('tfoot')).toContainText('R170 306.30');
    await expect(table.locator('tfoot')).toContainText('R20 306.30');
    await expect(table.getByRole('rowheader').first()).toHaveText('1');
  });

  test('reports invalid fields, and each summary link focuses its field', async ({ page }) => {
    await age(page).fill('17');
    await field(page, 'Monthly take-home income').fill('-5 000');
    await field(page, 'Monthly living expenses').fill('12,5,00');
    await score(page).fill('900');
    await calculate(page).click();

    const summary = page.getByRole('alert');
    await expect(summary).toBeFocused();
    await expect(summary).toContainText('before calculating');
    await expect(field(page, 'Monthly living expenses')).toHaveValue('12,5,00');
    await expect(field(page, 'Monthly living expenses')).toHaveAttribute('aria-invalid', 'true');
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');

    await summary.getByRole('link', { name: 'Use numbers only, for example 18 500.' }).click();
    await expect(field(page, 'Monthly living expenses')).toBeFocused();
    await summary.getByRole('link', { name: 'Age must be between 18 and 65' }).click();
    await expect(age(page)).toBeFocused();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('marks the estimate out of date after an edit, including the new fields, then recalculates', async ({
    page,
  }) => {
    await calculateEstimate(page, FULL);

    for (const change of [
      () => field(page, 'Monthly take-home income').fill('24000'),
      () => age(page).fill('36'),
      () => score(page).fill(''),
    ]) {
      await change();
      await expect(estimate(page).getByRole('status')).toContainText(
        'Your inputs have changed. The estimate below is out of date.',
      );
      await expect(estimate(page).getByText('R3 297.60', { exact: true }).first()).toBeVisible();
      await enter(page, FULL);
      await expect(estimate(page).getByText('Your inputs have changed.')).toHaveCount(0);
    }

    await field(page, 'Monthly take-home income').fill('50000');
    const mobileNote = page.getByText(
      'Your inputs have changed. Calculate again to update the estimate below.',
    );
    if ((page.viewportSize()?.width ?? 0) < 760) await expect(mobileNote).toBeVisible();
    else await expect(mobileNote).toBeHidden();

    await estimate(page).getByRole('button', { name: 'Recalculate estimate' }).click();
    await expect(estimate(page).getByText('Your inputs have changed.')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your estimate' })).toBeFocused();
    await expect(mobileNote).toBeHidden();
  });

  test('reset returns the estimate to its initial state', async ({ page }) => {
    await calculateEstimate(page, REDUCED);
    await page.getByRole('button', { name: 'Reset' }).click();

    await expect(age(page)).toBeFocused();
    await expect(age(page)).toHaveValue('');
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');
    await expect(estimate(page).getByText('Estimated eligible for a smaller amount')).toHaveCount(
      0,
    );
  });
});

test.describe('pressing a button right after editing a field', () => {
  // Leaving a field re-validates it once a calculation has been tried, and a new inline error
  // moves everything below it. The press that caused the blur must still count.
  test('Calculate reports the errors on the first press', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Use example values' }).click();
    await calculate(page).click();
    await expect(page.getByRole('heading', { name: 'Your estimate' })).toBeFocused();

    await field(page, 'Monthly take-home income').fill('abc');
    await field(page, 'Loan amount').fill('');
    await calculate(page).click();

    await expect(page.getByRole('alert')).toBeFocused();
    await expect(page.getByRole('alert')).toContainText('Check 2 fields before calculating');
  });

  test('Reset works on the first press', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Use example values' }).click();
    await calculate(page).click();

    await field(page, 'Loan amount').fill('');
    await page.getByRole('button', { name: 'Reset' }).click();

    await expect(age(page)).toBeFocused();
    await expect(field(page, 'Loan amount')).toHaveValue('50 000');
  });
});

test.describe('while a request is in flight', () => {
  test('a second press does not send a second request', async ({ page }) => {
    await openApp(page);
    let posts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/loans/eligibility')) {
        posts += 1;
      }
    });
    await page.getByRole('button', { name: 'Use example values' }).click();
    await calculate(page).click();
    // While pending the button is aria-disabled and reads "Calculating…"; pressing it, or Enter
    // in a field, must not send the same request again.
    await page.getByRole('button', { name: 'Calculating…' }).click({ force: true });
    await age(page).press('Enter');
    await expect(estimate(page).getByText('Estimated monthly payment')).toBeVisible();
    expect(posts).toBe(1);
  });
});
