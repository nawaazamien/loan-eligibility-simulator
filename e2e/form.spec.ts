import { expect, test } from '@playwright/test';

import {
  age,
  calculate,
  duration,
  estimate,
  field,
  horizontalOverflow,
  openApp,
  purpose,
  score,
  status,
  term,
} from './helpers';

test.describe('loan form', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('is built from the validation rules and products the API returned', async ({ page }) => {
    await expect(age(page)).toBeVisible();
    await expect(page.getByText('Your age in years, 18 to 65 years.')).toBeVisible();
    await expect(status(page).locator('option')).toHaveText([
      'Select your employment status',
      'Employed',
      'Self-employed',
      'Unemployed',
      'Retired',
    ]);
    await expect(page.getByText(/At least 3\./)).toBeVisible();
    await expect(page.getByText(/Leave it blank if you don't know it/)).toBeVisible();
    // Product information, from GET /api/loans/products.
    await expect(page.getByText(/This estimate is for the Personal Loan/)).toBeVisible();
    await page.getByRole('button', { name: 'About our loan products' }).click();
    await expect(page.getByRole('heading', { name: 'Vehicle Finance' })).toBeVisible();
    await expect(
      page.getByText(/Shown for information: this page estimates the personal loan only/),
    ).toBeVisible();
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
    await expect(slider).toHaveAttribute('aria-valuetext', /^R51\s000$/);

    await loan.fill('');
    await expect(slider).toHaveValue('51000');
    await loan.pressSequentially('120000');
    await expect(slider).toHaveValue('120000');
  });

  test('keeps the term field and slider in step', async ({ page }) => {
    const slider = page.getByRole('slider', { name: 'Repayment term slider' });
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(term(page)).toHaveValue('37');
    await term(page).fill('24');
    await expect(slider).toHaveValue('24');
    await expect(slider).toHaveAttribute('aria-valuetext', '24 months');
  });

  test('offers the loan purposes of the personal loan product', async ({ page }) => {
    await expect(purpose(page).locator('option')).toHaveText([
      'Select what the loan is for',
      'Debt consolidation',
      'Home improvement',
      'Education',
      'Medical',
      'Other',
    ]);
  });

  test('treats the credit score as optional but checks it when given', async ({ page }) => {
    await expect(score(page)).toHaveValue('');
    await score(page).fill('900');
    await calculate(page).click();
    await expect(page.getByRole('alert')).toContainText('Credit score must be between 300 and 850');
    await score(page).fill('');
    await calculate(page).click();
    await expect(page.getByRole('alert')).not.toContainText('Credit score');
  });

  test('fills example values, then resets to the defaults with focus on age', async ({ page }) => {
    await page.getByRole('button', { name: 'Use example values' }).click();
    await expect(field(page, 'Monthly take-home income')).toHaveValue('28 500');
    await expect(duration(page)).toHaveValue('24');
    await expect(score(page)).toHaveValue('650');
    await expect(field(page, 'Loan amount')).toHaveValue('60 000');
    await expect(term(page)).toHaveValue('48');
    const form = page.getByRole('form', { name: 'Your details' });
    await expect(form.getByRole('status')).toHaveText(
      'Example values added. Select Calculate estimate to see the result.',
    );
    await expect(estimate(page).getByText('Estimated monthly payment')).toHaveCount(0);

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(age(page)).toHaveValue('');
    await expect(age(page)).toBeFocused();
    await expect(field(page, 'Loan amount')).toHaveValue('50 000');
    await expect(term(page)).toHaveValue('36');
    await expect(form.getByRole('status')).toHaveText(
      'Form reset. Enter your details to calculate a new estimate.',
    );
  });

  test('opens the assumptions by keyboard without overflowing the page', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'How this estimate is made' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText(/All rates, rules and results here are fictional/)).toBeHidden();

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(/All rates, rules and results here are fictional/)).toBeVisible();

    await page.getByRole('button', { name: 'Use example values' }).click();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('layout around the breakpoint', () => {
  test('stacks below 760px and sits side by side from 760px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Resizes the viewport itself');

    const details = page.getByRole('form', { name: 'Your details' });

    await page.setViewportSize({ width: 759, height: 900 });
    await openApp(page);
    let detailsBox = await details.boundingBox();
    let estimateBox = await estimate(page).boundingBox();
    if (!detailsBox || !estimateBox) throw new Error('Panels are not rendered');
    expect(estimateBox.y).toBeGreaterThan(detailsBox.y + detailsBox.height);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 760, height: 900 });
    detailsBox = await details.boundingBox();
    estimateBox = await estimate(page).boundingBox();
    if (!detailsBox || !estimateBox) throw new Error('Panels are not rendered');
    expect(estimateBox.x).toBeGreaterThan(detailsBox.x + detailsBox.width);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
