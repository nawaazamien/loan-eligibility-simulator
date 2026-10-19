import { expect, test } from '@playwright/test';

test.describe('application shell', () => {
  test('loads without runtime errors, failed requests or horizontal overflow', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) problems.push(`${String(response.status())} ${response.url()}`);
    });

    await page.goto('/');

    await expect(page).toHaveTitle('Loan eligibility simulator · Tally (demo)');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Loan eligibility simulator');
    await expect(page.getByRole('banner')).toContainText('Tally');
    await expect(page.getByRole('contentinfo')).toContainText('demonstration project');

    // Self-hosted design fonts must actually load (no network font fallback).
    await page.evaluate(() => document.fonts.ready);
    const fontsLoaded = await page.evaluate(() => ({
      body: document.fonts.check('400 15px "Barlow"'),
      heading: document.fonts.check('600 46px "Barlow Condensed"'),
    }));
    expect(fontsLoaded).toEqual({ body: true, heading: true });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    expect(problems).toEqual([]);
  });

  test('places the estimate beside the form on wide screens and below it on narrow ones', async ({
    page,
  }) => {
    await page.goto('/');
    const width = page.viewportSize()?.width ?? 0;

    const details = page.getByRole('region', { name: 'Your details' });
    const estimate = page.getByRole('region', { name: 'Your estimate' });
    const detailsBox = await details.boundingBox();
    const estimateBox = await estimate.boundingBox();
    if (!detailsBox || !estimateBox) throw new Error('Panels are not rendered');

    const tagline = page.getByText('Fictional estimates · Not a credit check');
    if (width >= 760) {
      expect(estimateBox.x).toBeGreaterThan(detailsBox.x + detailsBox.width);
      expect(Math.abs(estimateBox.y - detailsBox.y)).toBeLessThan(1);
      await expect(tagline).toBeVisible();
    } else {
      expect(estimateBox.y).toBeGreaterThan(detailsBox.y + detailsBox.height);
      await expect(tagline).toBeHidden();
    }
  });
});
