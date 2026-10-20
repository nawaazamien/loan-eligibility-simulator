import { expect, test } from '@playwright/test';

import {
  age,
  calculate,
  calculateEstimate,
  estimate,
  field,
  FULL,
  horizontalOverflow,
  NONE,
  openApp,
  openSchedule,
  term,
} from './helpers';

/**
 * Core flows in Firefox and WebKit (see playwright.config.ts). Chromium runs the fuller
 * suites; these confirm the same essentials work in the other two engines, including the
 * service-worker mock API that answers every request.
 */
test.describe('core flow', () => {
  test('renders the page without errors or overflow', async ({ page, browserName }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    await openApp(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Loan eligibility simulator');
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    if (browserName === 'webkit') {
      // WebKit reports its own built-in styling of a native <select> as a CSP violation
      // ("Refused to apply a stylesheet") once per select, although the page has no inline
      // style at all and the policy is unchanged. Tolerate exactly that message, no more than
      // once per <select>; any other console error still fails the test.
      const selects = await page.locator('select').count();
      const engineNoise = problems.filter((text) =>
        text.startsWith('Refused to apply a stylesheet'),
      );
      expect(engineNoise.length).toBeLessThanOrEqual(selects);
      expect(problems.filter((text) => !engineNoise.includes(text))).toEqual([]);
    } else {
      expect(problems).toEqual([]);
    }
  });

  test('calculates through the mocked API and moves focus to the estimate', async ({ page }) => {
    await openApp(page);
    await calculateEstimate(page, FULL);
    await expect(
      estimate(page).getByText('Estimated eligible for the amount requested'),
    ).toBeVisible();
    await expect(estimate(page).getByText('R3 297.60', { exact: true }).first()).toBeVisible();
    await expect(page.locator('[aria-live="polite"]')).toContainText('Estimate updated.');
    const table = await openSchedule(page);
    await expect(table.locator('tbody tr')).toHaveCount(36);
  });

  test('shows nothing recommended when commitments leave no room', async ({ page }) => {
    await openApp(page);
    await calculateEstimate(page, NONE);
    await expect(estimate(page).getByText('Estimated not eligible for this loan')).toBeVisible();
  });

  test('reports an invalid submission and links to the field', async ({ page }) => {
    await openApp(page);
    await age(page).fill('17');
    await calculate(page).click();

    const summary = page.getByRole('alert');
    await expect(summary).toBeFocused();
    await summary.getByRole('link', { name: 'Age must be between 18 and 65' }).click();
    await expect(age(page)).toBeFocused();
    await expect(age(page)).toHaveAttribute('aria-invalid', 'true');
  });

  test('marks an edited result out of date, then recalculates', async ({ page }) => {
    await openApp(page);
    await calculateEstimate(page, FULL);
    await field(page, 'Loan amount').fill('120000');
    await expect(estimate(page).getByRole('status')).toContainText('out of date');

    await estimate(page).getByRole('button', { name: 'Recalculate estimate' }).click();
    await expect(estimate(page).getByText('Your inputs have changed.')).toHaveCount(0);
    await expect(estimate(page)).toContainText('R120 000');
  });

  test('resets to the initial state', async ({ page }) => {
    await openApp(page);
    await calculateEstimate(page, NONE);
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(age(page)).toBeFocused();
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');
  });

  test('works from the keyboard: fields, sliders and Enter', async ({ page }) => {
    await openApp(page);
    await age(page).fill('35');
    const status = page.getByRole('combobox', { name: /Employment status/ });
    await status.selectOption('employed');
    await status.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.type('24');
    await field(page, 'Monthly take-home income').fill('28500');
    await page.keyboard.press('Tab');
    await expect(field(page, 'Monthly living expenses')).toBeFocused();
    await page.keyboard.type('14200');
    await field(page, 'Existing monthly debt repayments').fill('3150');
    await page.getByRole('combobox', { name: /Loan purpose/ }).selectOption('other');

    const slider = page.getByRole('slider', { name: 'Loan amount slider' });
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(field(page, 'Loan amount')).toHaveValue('51 000');

    await page.getByRole('slider', { name: 'Repayment term slider' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(term(page)).toHaveValue('37');

    await field(page, 'Loan amount').press('Enter');
    await expect(page.getByRole('heading', { name: 'Your estimate' })).toBeFocused();
    await expect(estimate(page)).toContainText('37 months');
  });
});

test.describe('expense helper', () => {
  test('Enter in a category applies the total and never submits the loan form', async ({
    page,
  }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Help me calculate my expenses' }).click();
    const housing = page.getByRole('textbox', { name: 'Housing in rand' });
    await housing.fill('6000');
    await housing.press('Enter');

    await expect(field(page, 'Monthly living expenses')).toHaveValue('6 000');
    await expect(field(page, 'Monthly living expenses')).toBeFocused();
    // A submitted loan form would show the error summary for the empty fields.
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');
  });
});

test.describe('Firefox regressions', () => {
  test('a focused control near the bottom edge is scrolled fully into view', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'firefox', 'Firefox left partly visible controls where they were');
    // Roughly a 1280×900 window at 200% zoom.
    await page.setViewportSize({ width: 640, height: 450 });
    await openApp(page);
    const button = calculate(page);
    // Leave the button only partly visible at the bottom edge, as tabbing down the page does,
    // then tab onto it from the control before it.
    await button.evaluate((el) => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top - window.innerHeight + 20);
    });
    await page.getByRole('button', { name: 'About our loan products' }).evaluate((toggle) => {
      toggle.focus({ preventScroll: true });
    });
    await page.keyboard.press('Tab');

    await expect(button).toBeFocused();
    await expect(button).toBeInViewport({ ratio: 1 });
  });
});
