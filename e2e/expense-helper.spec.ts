import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  calculate,
  calculateEstimate,
  estimate,
  field,
  horizontalOverflow,
  WITHIN,
} from './helpers';

const toggle = (page: Page) => page.getByRole('button', { name: 'Help me calculate my expenses' });
const category = (page: Page, label: string) =>
  page.getByRole('textbox', { name: `${label} in rand` });
const useTotal = (page: Page) => page.getByRole('button', { name: 'Use this total' });

/** The same axe configuration as e2e/a11y.spec.ts: whole page, no rules disabled. */
async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(
    violations.map((v) => ({ rule: v.id, targets: v.nodes.map((n) => n.target.join(' ')) })),
  ).toEqual([]);
}

const TEXT_SPACING = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
  p, li, dd, dt, legend, label { margin-bottom: 2em !important; }`;

test.describe('expense helper', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
  });

  test('expanded: accessible and within the page', async ({ page }) => {
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.getByRole('group', { name: 'Monthly living expenses by category' }),
    ).toBeVisible();
    await expectNoViolations(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('invalid: errors are linked, the first is focused, and the page stays accessible', async ({
    page,
  }) => {
    await toggle(page).click();
    await category(page, 'Utilities').fill('abc');
    await useTotal(page).click();

    await expect(category(page, 'Utilities')).toBeFocused();
    await expect(category(page, 'Utilities')).toHaveAttribute('aria-invalid', 'true');
    await expect(category(page, 'Utilities')).toHaveAccessibleDescription(
      'Use numbers only, for example 18 500.',
    );
    await expectNoViolations(page);
  });

  test('apply: fills the field, confirms, returns focus and calculates nothing', async ({
    page,
  }) => {
    await toggle(page).click();
    await category(page, 'Housing').fill('7500');
    await category(page, 'Food and groceries').fill('3200.50');
    await expect(page.getByText('Total R10 700.50 a month')).toBeVisible();
    await category(page, 'Transport').press('Enter');

    await expect(field(page, 'Monthly living expenses')).toHaveValue('10 700.50');
    await expect(field(page, 'Monthly living expenses')).toBeFocused();
    await expect(page.getByRole('form').getByRole('status')).toContainText(
      'Monthly living expenses set to R10 700.50 from your breakdown.',
    );
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');
    await expectNoViolations(page);
  });

  test('cancel: discards the draft and leaves the field as it was', async ({ page }) => {
    await field(page, 'Monthly living expenses').fill('9000');
    await toggle(page).click();
    await category(page, 'Other living expenses').fill('');
    await category(page, 'Housing').fill('1');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(field(page, 'Monthly living expenses')).toHaveValue('9 000');
    await expect(toggle(page)).toBeFocused();
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
    await expectNoViolations(page);
  });

  test('a changed total marks the estimate out of date; an equal one does not', async ({
    page,
  }) => {
    await calculateEstimate(page, WITHIN);

    await toggle(page).click();
    await category(page, 'Other living expenses').fill('');
    await category(page, 'Housing').fill('9000');
    await category(page, 'Food and groceries').fill('5200');
    await useTotal(page).click();
    await expect(field(page, 'Monthly living expenses')).toHaveValue('14 200');
    await expect(estimate(page).getByRole('status')).toBeEmpty();

    await toggle(page).click();
    await category(page, 'Food and groceries').fill('4000');
    await useTotal(page).click();
    await expect(field(page, 'Monthly living expenses')).toHaveValue('13 000');
    await expect(estimate(page).getByRole('status')).toContainText('out of date');
    await expectNoViolations(page);

    await calculate(page).click();
    await expect(estimate(page).getByRole('status')).toBeEmpty();
  });
});

test.describe('expense helper with text spacing increased (WCAG 1.4.12)', () => {
  // People apply these overrides with a browser extension or user stylesheet, which a page's
  // CSP does not restrict. The test injects a <style> element instead, so it bypasses the CSP
  // the way those tools do; every other test runs under the real policy.
  test.use({ bypassCSP: true });

  test('fits the page and keeps its actions visible', async ({ page }) => {
    await page.goto('/');
    await toggle(page).click();
    await page.addStyleTag({ content: TEXT_SPACING });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expect(useTotal(page)).toBeVisible();
  });
});
