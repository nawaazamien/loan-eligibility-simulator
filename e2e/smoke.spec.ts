import { expect, test } from '@playwright/test';

import {
  ABOVE,
  calculate,
  calculateEstimate,
  estimate,
  field,
  horizontalOverflow,
  term,
  WITHIN,
} from './helpers';

/**
 * Core flows in Firefox and WebKit (see playwright.config.ts). Chromium runs the fuller
 * suites; these confirm the same essentials work in the other two engines.
 */
test.describe('core flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the page without errors or overflow', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    await page.reload();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Loan eligibility simulator');
    await expect(page.getByRole('form', { name: 'Your details' })).toBeVisible();
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(problems).toEqual([]);
  });

  test('calculates an estimate and moves focus to it', async ({ page }) => {
    await calculateEstimate(page, WITHIN);
    await expect(estimate(page).getByText('Within the demo affordability limit')).toBeVisible();
    await expect(estimate(page).getByText('R1 878.88')).toBeVisible();
    await expect(page.locator('[aria-live="polite"]')).toContainText('Estimate updated.');
  });

  test('reports an invalid submission and links to the field', async ({ page }) => {
    await field(page, 'Monthly take-home income').fill('abc');
    await calculate(page).click();

    const summary = page.getByRole('alert');
    await expect(summary).toBeFocused();
    await summary.getByRole('link', { name: 'Use numbers only, for example 18 500.' }).click();
    await expect(field(page, 'Monthly take-home income')).toBeFocused();
    await expect(field(page, 'Monthly take-home income')).toHaveAttribute('aria-invalid', 'true');
  });

  test('marks an edited result out of date, then recalculates', async ({ page }) => {
    await calculateEstimate(page, WITHIN);
    await field(page, 'Loan amount').fill('120000');
    await expect(estimate(page).getByRole('status')).toContainText('out of date');

    await estimate(page).getByRole('button', { name: 'Recalculate estimate' }).click();
    await expect(estimate(page).getByRole('status')).toBeEmpty();
    await expect(estimate(page)).toContainText('R120 000');
  });

  test('resets to the initial state', async ({ page }) => {
    await calculateEstimate(page, ABOVE);
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(field(page, 'Monthly take-home income')).toBeFocused();
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');
  });

  test('works from the keyboard: fields, slider, term arrows and Enter', async ({ page }) => {
    await field(page, 'Monthly take-home income').fill('28500');
    await page.keyboard.press('Tab');
    await expect(field(page, 'Monthly living expenses')).toBeFocused();
    await page.keyboard.type('14200');
    await field(page, 'Existing monthly debt repayments').fill('3150');

    const slider = page.getByRole('slider', { name: 'Loan amount slider' });
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(field(page, 'Loan amount')).toHaveValue('51 000');

    await term(page, 36).focus();
    await page.keyboard.press('ArrowRight');
    await expect(term(page, 48)).toBeChecked();

    await field(page, 'Loan amount').press('Enter');
    await expect(page.getByRole('heading', { name: 'Your estimate' })).toBeFocused();
    await expect(estimate(page)).toContainText('48 months');
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
    await page.goto('/');
    const button = calculate(page);
    // Leave the button only partly visible at the bottom edge, as tabbing down the page does,
    // then tab onto it from the term group.
    await button.evaluate((el) => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top - window.innerHeight + 20);
    });
    await term(page, 36).evaluate((radio) => {
      radio.focus({ preventScroll: true });
    });
    await page.keyboard.press('Tab');

    await expect(button).toBeFocused();
    await expect(button).toBeInViewport({ ratio: 1 });
  });
});
