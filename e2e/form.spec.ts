import { expect, test, type Page } from '@playwright/test';

const field = (page: Page, label: string) =>
  page.getByRole('textbox', { name: `${label} in rand` });
const term = (page: Page, months: number) =>
  page.getByRole('radio', { name: `${String(months)} months` });

/** Rand figures in the estimate panel, ignoring the fictional fee quoted in the assumptions. */
async function estimateFigures(page: Page): Promise<string[]> {
  const text = await page.getByRole('region', { name: 'Your estimate' }).textContent();
  return (text ?? '').replaceAll('A R69 monthly service fee', '').match(/R\s?\d[\d\s.,]*/g) ?? [];
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('loan form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('edits amounts by keyboard and tidies them only on leaving the field', async ({ page }) => {
    const income = field(page, 'Monthly take-home income');
    await income.click();
    await page.keyboard.type('28500');
    await expect(income).toHaveValue('28500');

    await page.keyboard.press('Tab');
    await expect(income).toHaveValue('28 500');
    await expect(field(page, 'Monthly living expenses')).toBeFocused();

    await page.keyboard.type('12,5,00');
    await page.keyboard.press('Tab');
    await expect(field(page, 'Monthly living expenses')).toHaveValue('12,5,00');
  });

  test('keeps the loan field and slider in step', async ({ page }) => {
    const loan = field(page, 'Loan amount');
    const slider = page.getByRole('slider', { name: 'Loan amount slider' });

    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(loan).toHaveValue('51 000');
    await expect(slider).toHaveAttribute('aria-valuetext', 'R51 000');

    await loan.fill('');
    await expect(slider).toHaveValue('51000');
    await loan.pressSequentially('120000');
    await expect(slider).toHaveValue('120000');
  });

  test('selects a term with the arrow keys from a single tab stop', async ({ page }) => {
    await page.getByRole('slider', { name: 'Loan amount slider' }).focus();
    await page.keyboard.press('Tab');
    await expect(term(page, 36)).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(term(page, 48)).toBeChecked();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(term(page, 24)).toBeChecked();

    // The term group is a single tab stop; Tab moves on to Calculate.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Calculate estimate' })).toBeFocused();
  });

  test('fills example values, then resets to the defaults with focus on income', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Use example values' }).click();
    await expect(field(page, 'Monthly take-home income')).toHaveValue('28 500');
    await expect(field(page, 'Loan amount')).toHaveValue('60 000');
    await expect(term(page, 48)).toBeChecked();
    const form = page.getByRole('form', { name: 'Your details' });
    await expect(form.getByRole('status')).toHaveText(
      'Example values added. Select Calculate estimate to see the result.',
    );
    expect(await estimateFigures(page)).toEqual([]);

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(field(page, 'Monthly take-home income')).toHaveValue('');
    await expect(field(page, 'Monthly take-home income')).toBeFocused();
    await expect(field(page, 'Loan amount')).toHaveValue('50 000');
    await expect(term(page, 36)).toBeChecked();
    await expect(form.getByRole('status')).toHaveText(
      'Form reset. Enter your details to calculate a new estimate.',
    );
  });

  test('opens the assumptions by keyboard without overflowing the page', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'How this estimate is calculated' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('All rates, fees and rules are fictional')).toBeHidden();

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('All rates, fees and rules are fictional')).toBeVisible();

    await page.getByRole('button', { name: 'Use example values' }).click();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('layout around the breakpoint', () => {
  test('stacks below 760px and sits side by side from 760px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Resizes the viewport itself');

    const details = page.getByRole('form', { name: 'Your details' });
    const estimate = page.getByRole('region', { name: 'Your estimate' });

    await page.setViewportSize({ width: 759, height: 900 });
    await page.goto('/');
    let detailsBox = await details.boundingBox();
    let estimateBox = await estimate.boundingBox();
    if (!detailsBox || !estimateBox) throw new Error('Panels are not rendered');
    expect(estimateBox.y).toBeGreaterThan(detailsBox.y + detailsBox.height);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 760, height: 900 });
    detailsBox = await details.boundingBox();
    estimateBox = await estimate.boundingBox();
    if (!detailsBox || !estimateBox) throw new Error('Panels are not rendered');
    expect(estimateBox.x).toBeGreaterThan(detailsBox.x + detailsBox.width);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
