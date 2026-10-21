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
    // Record every Content Security Policy violation the browser reports, not just its console text.
    await page.addInitScript(() => {
      const seen: { directive: string; blocked: string }[] = [];
      (window as unknown as { __csp: typeof seen }).__csp = seen;
      document.addEventListener('securitypolicyviolation', (event) => {
        seen.push({ directive: event.violatedDirective, blocked: event.blockedURI });
      });
    });
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    await openApp(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Loan eligibility simulator');
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    const violations = await page.evaluate(
      () => (window as unknown as { __csp: { directive: string; blocked: string }[] }).__csp,
    );
    if (browserName === 'webkit') {
      // WebKit 27.2 (Playwright 1.64.1) reports its own built-in styling of every native
      // <select> as an inline style-attribute violation, with this console text, although the
      // page has no style attribute or element and the policy is unchanged. It happens on a
      // bare page with one <select> and no script at all (docs/validation/phase-6/). Only that
      // exact message and that exact event, exactly once per <select>, are tolerated; a
      // different message, directive or count (a real violation) still fails.
      const selects = await page.locator('select').count();
      expect(selects).toBeGreaterThan(0);
      const engineMessage =
        "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive of the Content Security Policy.";
      expect(problems).toEqual(Array<string>(selects).fill(engineMessage));
      expect(violations).toEqual(
        Array<{ directive: string; blocked: string }>(selects).fill({
          directive: 'style-src-attr',
          blocked: 'inline',
        }),
      );
      expect(await page.evaluate(() => document.querySelectorAll('style, [style]').length)).toBe(0);
    } else {
      expect(problems).toEqual([]);
      expect(violations).toEqual([]);
    }
  });

  test('the native selects work, by pointer and by keyboard', async ({ page }) => {
    await openApp(page);
    const employment = page.getByRole('combobox', { name: /Employment status/ });
    await employment.selectOption('retired');
    await expect(employment).toHaveValue('retired');
    const purpose = page.getByRole('combobox', { name: /Loan purpose/ });
    await purpose.focus();
    await page.keyboard.press('ArrowDown');
    await expect(purpose).not.toHaveValue('');
    await page.getByRole('button', { name: 'Use example values' }).click();
    await expect(employment).toHaveValue('employed');
    await expect(purpose).toHaveValue('home_improvement');
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
