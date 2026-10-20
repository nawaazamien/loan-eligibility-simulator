import { expect, test } from '@playwright/test';

import { calculateEstimate, estimate, horizontalOverflow } from './helpers';

/**
 * Runs in the "firefox-large-text" project (playwright.config.ts), which raises Firefox's
 * default font size from 16px to 32px, as Settings > Fonts > Size does. Text sizes are in
 * rem, so the page should double its text and still fit.
 */
test.describe('larger default text size', () => {
  test('follows the browser text size without clipping', async ({ page }) => {
    await page.goto('/');

    const label = page.locator('label', { hasText: 'Monthly take-home income' });
    expect(await label.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBe(30);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // The term choices wrap instead of being cut off at the group's edge.
    const group = page.getByRole('group', { name: 'Repayment term' });
    const allInside = await group.evaluate((fieldset) => {
      const bounds = fieldset.getBoundingClientRect();
      return [...fieldset.querySelectorAll('label')].every((label) => {
        const box = label.getBoundingClientRect();
        return (
          box.left >= bounds.left - 1 &&
          box.right <= bounds.right + 1 &&
          label.scrollWidth <= label.clientWidth + 1
        );
      });
    });
    expect(allInside).toBe(true);
  });

  test('keeps the longest repayment figure whole, on one line', async ({ page }) => {
    await page.goto('/');
    // R250 000 over 12 months gives the longest figure the model can produce: R23 167.84.
    await calculateEstimate(page, {
      income: '1000000',
      expenses: '0',
      debt: '0',
      loan: '250000',
      term: 12,
    });

    const figure = estimate(page).getByText('R23 167.84', { exact: true });
    await expect(figure).toBeVisible();
    const { lines, fontSize } = await figure.evaluate((el) => {
      const size = parseFloat(getComputedStyle(el).fontSize);
      return { lines: Math.round(el.getBoundingClientRect().height / size), fontSize: size };
    });
    expect(lines).toBe(1);
    // Still clearly the largest text on the page (body text is 30px here).
    expect(fontSize).toBeGreaterThanOrEqual(48);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('the expense helper fits and stays usable', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Help me calculate my expenses' }).click();
    await expect(page.getByRole('button', { name: 'Use this total' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    const group = page.getByRole('group', { name: 'Monthly living expenses by category' });
    const fieldsFit = await group.evaluate((fieldset) => {
      const right = fieldset.getBoundingClientRect().right;
      return [...fieldset.querySelectorAll('input')].every(
        (input) => input.getBoundingClientRect().right <= right + 1,
      );
    });
    expect(fieldsFit).toBe(true);
  });
});
