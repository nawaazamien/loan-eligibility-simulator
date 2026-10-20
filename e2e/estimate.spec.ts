import { expect, test, type Page } from '@playwright/test';

const field = (page: Page, label: string) =>
  page.getByRole('textbox', { name: `${label} in rand` });
const estimate = (page: Page) => page.getByRole('region', { name: 'Your estimate' });
const calculate = (page: Page) =>
  page.getByRole('button', { name: 'Calculate estimate', exact: true });

interface Entry {
  income: string;
  expenses: string;
  debt: string;
  loan: string;
  term: number;
}

async function enter(page: Page, entry: Entry) {
  await field(page, 'Monthly take-home income').fill(entry.income);
  await field(page, 'Monthly living expenses').fill(entry.expenses);
  await field(page, 'Existing monthly debt repayments').fill(entry.debt);
  await field(page, 'Loan amount').fill(entry.loan);
  // The radio is visually hidden inside its label, so click the label as a user would.
  await page
    .locator('label', { has: page.getByRole('radio', { name: `${String(entry.term)} months` }) })
    .click();
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** Reference cases 1–3 from docs/SIMULATION_MODEL.md §6. */
const WITHIN: Entry = { income: '28500', expenses: '14200', debt: '3150', loan: '60000', term: 48 };
const ABOVE: Entry = { income: '18000', expenses: '11500', debt: '2400', loan: '120000', term: 36 };
const NONE: Entry = { income: '12000', expenses: '9800', debt: '2600', loan: '20000', term: 24 };

test.describe('estimate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('calculates, focuses the estimate and keeps it in view', async ({ page }) => {
    await enter(page, WITHIN);
    await calculate(page).click();

    const heading = page.getByRole('heading', { name: 'Your estimate' });
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    await expect(estimate(page).getByText('Within the demo affordability limit')).toBeVisible();
    await expect(estimate(page).getByText('R1 878.88')).toBeVisible();
    await expect(estimate(page)).toContainText('48 months');
    await expect(page.locator('[aria-live="polite"]')).toHaveText(
      'Estimate updated. Within the demo affordability limit. Estimated monthly repayment R1 878.88.',
    );
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('submits with Enter from a field', async ({ page }) => {
    await enter(page, WITHIN);
    await field(page, 'Existing monthly debt repayments').press('Enter');
    await expect(estimate(page).getByText('R1 878.88')).toBeVisible();
  });

  test('shows an estimate above the limit with its shortfall and next steps', async ({ page }) => {
    await enter(page, ABOVE);
    await calculate(page).click();

    await expect(estimate(page).getByText('Above the demo affordability limit')).toBeVisible();
    await expect(estimate(page)).toContainText('−R398 a month');
    await expect(estimate(page)).toContainText(
      'Your commitments and the new repayment would be R398 more than your income.',
    );
    await expect(estimate(page).getByRole('heading', { name: 'What you could try' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('shows when commitments leave no room', async ({ page }) => {
    await enter(page, NONE);
    await calculate(page).click();

    await expect(estimate(page).getByText('No room for an additional repayment')).toBeVisible();
    await expect(estimate(page)).toContainText('are R400 more than your take-home income');
    await expect(estimate(page).getByRole('heading', { name: /goes each month/ })).toHaveCount(0);
  });

  test('reports invalid fields, and each summary link focuses its field', async ({ page }) => {
    await field(page, 'Monthly take-home income').fill('-5 000');
    await field(page, 'Monthly living expenses').fill('12,5,00');
    await field(page, 'Existing monthly debt repayments').fill('2400');
    await field(page, 'Loan amount').fill('400000');
    await calculate(page).click();

    const summary = page.getByRole('alert');
    await expect(summary).toBeFocused();
    await expect(summary).toContainText('Check 3 fields before calculating');
    await expect(field(page, 'Monthly living expenses')).toHaveValue('12,5,00');
    await expect(field(page, 'Monthly living expenses')).toHaveAttribute('aria-invalid', 'true');
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');

    await summary.getByRole('link', { name: 'Use numbers only, for example 18 500.' }).click();
    await expect(field(page, 'Monthly living expenses')).toBeFocused();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('marks the estimate out of date after an edit, then recalculates', async ({ page }) => {
    await enter(page, WITHIN);
    await calculate(page).click();

    await field(page, 'Monthly take-home income').fill('24000');
    await expect(estimate(page).getByRole('status')).toContainText(
      'Your inputs have changed. The estimate below is out of date.',
    );
    await expect(estimate(page).getByText('R1 878.88')).toBeVisible();

    const mobileNote = page.getByText(
      'Your inputs have changed. Calculate again to update the estimate below.',
    );
    if ((page.viewportSize()?.width ?? 0) < 760) await expect(mobileNote).toBeVisible();
    else await expect(mobileNote).toBeHidden();

    await estimate(page).getByRole('button', { name: 'Recalculate estimate' }).click();
    await expect(estimate(page).getByRole('status')).toBeEmpty();
    await expect(page.getByRole('heading', { name: 'Your estimate' })).toBeFocused();
    await expect(estimate(page)).toContainText('Where your R24 000 goes each month');
    await expect(mobileNote).toBeHidden();
  });

  test('reset returns the estimate to its initial state', async ({ page }) => {
    await enter(page, ABOVE);
    await calculate(page).click();
    await page.getByRole('button', { name: 'Reset' }).click();

    await expect(field(page, 'Monthly take-home income')).toBeFocused();
    await expect(field(page, 'Monthly take-home income')).toHaveValue('');
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');
    await expect(estimate(page).getByText('Above the demo affordability limit')).toHaveCount(0);
  });
});

test.describe('pressing a button right after editing a field', () => {
  // Leaving a field re-validates it once a calculation has been tried, and a new inline error
  // moves everything below it. The press that caused the blur must still count.
  test('Calculate reports the errors on the first press', async ({ page }) => {
    await page.goto('/');
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
    await page.goto('/');
    await page.getByRole('button', { name: 'Use example values' }).click();
    await calculate(page).click();

    await field(page, 'Loan amount').fill('');
    await page.getByRole('button', { name: 'Reset' }).click();

    await expect(field(page, 'Monthly take-home income')).toBeFocused();
    await expect(field(page, 'Loan amount')).toHaveValue('50 000');
  });
});

test('the breakdown bar stays inside the estimate panel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Use example values' }).click();
  await calculate(page).click();

  // The bar is decorative (aria-hidden); its four segments and their gaps must fit the panel.
  const overhang = await estimate(page).evaluate((panel) => {
    const style = getComputedStyle(panel);
    const contentRight = panel.getBoundingClientRect().right - parseFloat(style.paddingRight);
    const lastSegment = panel.querySelector('div[aria-hidden="true"]')?.lastElementChild;
    return lastSegment ? lastSegment.getBoundingClientRect().right - contentRight : null;
  });
  expect(overhang).not.toBeNull();
  expect(overhang).toBeLessThanOrEqual(0.5);
});
