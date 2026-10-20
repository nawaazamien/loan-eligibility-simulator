import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { ABOVE, calculate, calculateEstimate, estimate, field, NONE, WITHIN } from './helpers';

/**
 * axe-core checks of each state the customer can reach, run in every Chromium viewport
 * project (1280, 360 and 320 px). The whole page is scanned: no regions are excluded and no
 * rules are disabled. Passing means axe found no violations in these states; it is one part
 * of the review in docs/validation/phase-3/ACCESSIBILITY_REVIEW.md, not proof of WCAG
 * conformance.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => node.target.join(' ')),
  }));
  expect(summary).toEqual([]);
}

test.describe('accessibility (axe)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
  });

  test('initial state', async ({ page }) => {
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');
    await expectNoViolations(page);
  });

  test('within the limit', async ({ page }) => {
    await calculateEstimate(page, WITHIN);
    await expect(estimate(page).getByText('Within the demo affordability limit')).toBeVisible();
    await expectNoViolations(page);
  });

  test('above the limit, with next steps', async ({ page }) => {
    await calculateEstimate(page, ABOVE);
    await expect(estimate(page).getByRole('heading', { name: 'What you could try' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('no room for a repayment', async ({ page }) => {
    await calculateEstimate(page, NONE);
    await expect(estimate(page).getByText('No room for an additional repayment')).toBeVisible();
    await expectNoViolations(page);
  });

  test('invalid submission', async ({ page }) => {
    await field(page, 'Monthly take-home income').fill('-5 000');
    await field(page, 'Monthly living expenses').fill('12,5,00');
    await field(page, 'Loan amount').fill('400000');
    await calculate(page).click();
    await expect(page.getByRole('alert')).toBeFocused();
    await expectNoViolations(page);
  });

  test('out-of-date result', async ({ page }) => {
    await calculateEstimate(page, WITHIN);
    await field(page, 'Monthly take-home income').fill('24000');
    await expect(estimate(page).getByRole('status')).toContainText('out of date');
    await expectNoViolations(page);
  });

  test('assumptions expanded over a result', async ({ page }) => {
    await calculateEstimate(page, ABOVE);
    const toggle = page.getByRole('button', { name: 'How this estimate is calculated' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expectNoViolations(page);
  });

  test('after reset', async ({ page }) => {
    await calculateEstimate(page, ABOVE);
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(field(page, 'Monthly take-home income')).toBeFocused();
    await expectNoViolations(page);
  });
});

/** WCAG relative-luminance contrast between two computed `rgb(...)` colours. */
function contrast(a: string, b: string): number {
  const luminance = (rgb: string) => {
    const [r = 0, g = 0, bl = 0] = (rgb.match(/[\d.]+/g) ?? []).map(Number).map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

test.describe('accessibility regressions (Phase 3 findings)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('text field borders stand out from the page (non-text contrast 3:1)', async ({ page }) => {
    const [border, pageBackground] = await field(page, 'Monthly take-home income').evaluate(
      (input) => [
        getComputedStyle(input).borderTopColor,
        getComputedStyle(document.body).backgroundColor,
      ],
    );
    expect(contrast(border, pageBackground)).toBeGreaterThanOrEqual(3);
  });

  test('the selected term stays distinguishable in forced colours', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const cell = (months: number) =>
      page.locator('label', { has: page.getByRole('radio', { name: `${String(months)} months` }) });
    // The colour actually seen behind the text: a transparent cell shows its ancestors'.
    const look = (months: number) =>
      cell(months).evaluate((label) => {
        let background = 'rgba(0, 0, 0, 0)';
        for (let el: Element | null = label; el; el = el.parentElement) {
          background = getComputedStyle(el).backgroundColor;
          if (!/rgba\(.*,\s*0\)$/.test(background) && background !== 'transparent') break;
        }
        return `${background} ${getComputedStyle(label).color}`;
      });
    expect(await look(36)).not.toBe(await look(12));
  });

  test('reduced motion: the jump to the estimate on a phone does not animate', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'Only phones scroll to the estimate');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Use example values' }).click();
    await calculate(page).click();
    // Without animation the heading is already in place when focus arrives.
    await expect(page.getByRole('heading', { name: 'Your estimate' })).toBeFocused();
    const first = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(first);
    await expect(page.getByRole('heading', { name: 'Your estimate' })).toBeInViewport();
  });
});
