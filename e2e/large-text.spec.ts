import { expect, test } from '@playwright/test';

import { horizontalOverflow } from './helpers';

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
});
