import { expect, type Page } from '@playwright/test';

export interface Entry {
  income: string;
  expenses: string;
  debt: string;
  loan: string;
  term: number;
}

/** Reference cases 1–3 from docs/SIMULATION_MODEL.md §6. */
export const WITHIN: Entry = {
  income: '28500',
  expenses: '14200',
  debt: '3150',
  loan: '60000',
  term: 48,
};
export const ABOVE: Entry = {
  income: '18000',
  expenses: '11500',
  debt: '2400',
  loan: '120000',
  term: 36,
};
export const NONE: Entry = {
  income: '12000',
  expenses: '9800',
  debt: '2600',
  loan: '20000',
  term: 24,
};

export const field = (page: Page, label: string) =>
  page.getByRole('textbox', { name: `${label} in rand` });
export const term = (page: Page, months: number) =>
  page.getByRole('radio', { name: `${String(months)} months` });
export const estimate = (page: Page) => page.getByRole('region', { name: 'Your estimate' });
export const calculate = (page: Page) => page.getByRole('button', { name: 'Calculate estimate' });

export async function enter(page: Page, entry: Entry) {
  await field(page, 'Monthly take-home income').fill(entry.income);
  await field(page, 'Monthly living expenses').fill(entry.expenses);
  await field(page, 'Existing monthly debt repayments').fill(entry.debt);
  await field(page, 'Loan amount').fill(entry.loan);
  // The radio is visually hidden inside its label, so click the label as a user would.
  await page.locator('label', { has: term(page, entry.term) }).click();
}

/** Fills the form, calculates, and waits until the estimate heading has focus. */
export async function calculateEstimate(page: Page, entry: Entry) {
  await enter(page, entry);
  await calculate(page).click();
  await expect(page.getByRole('heading', { name: 'Your estimate' })).toBeFocused();
}

export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
