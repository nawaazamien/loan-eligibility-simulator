import { expect, type Page } from '@playwright/test';

export interface Entry {
  age: string;
  status: string;
  duration: string;
  income: string;
  expenses: string;
  debt: string;
  /** Empty for "not given". */
  score: string;
  purpose: string;
  loan: string;
  term: string;
}

/**
 * Reference scenarios S1, S2 and S5 from docs/validation/phase-6/verify_reference.py, whose
 * expected figures were computed independently of the app in high-precision decimals.
 */
/** S2: the full amount requested is recommended, at 11.5% over 36 months. */
export const FULL: Entry = {
  age: '35',
  status: 'employed',
  duration: '36',
  income: '40000',
  expenses: '15000',
  debt: '3000',
  score: '720',
  purpose: 'home_improvement',
  loan: '100000',
  term: '36',
};
/** S1: the specification's sample inputs; a smaller amount (R42 000) is recommended. */
export const REDUCED: Entry = {
  age: '30',
  status: 'employed',
  duration: '24',
  income: '25000',
  expenses: '15000',
  debt: '5000',
  score: '650',
  purpose: 'debt_consolidation',
  loan: '150000',
  term: '24',
};
/** S5: nothing is left after commitments, so no amount is recommended. */
export const NONE: Entry = {
  age: '35',
  status: 'employed',
  duration: '24',
  income: '12000',
  expenses: '9000',
  debt: '3000',
  score: '650',
  purpose: 'other',
  loan: '20000',
  term: '24',
};

/** A money field, whose accessible name ends in "in rand". */
export const field = (page: Page, label: string) =>
  page.getByRole('textbox', { name: `${label} in rand` });
/** A whole-number or score field, by its exact accessible name. */
export const text = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });
export const age = (page: Page) => text(page, 'Age in years');
export const duration = (page: Page) => text(page, 'Time in current employment in months');
export const score = (page: Page) => text(page, 'Credit score (optional)');
export const term = (page: Page) => text(page, 'Repayment term in months');
export const status = (page: Page) => page.getByRole('combobox', { name: /Employment status/ });
export const purpose = (page: Page) => page.getByRole('combobox', { name: /Loan purpose/ });
export const estimate = (page: Page) => page.getByRole('region', { name: 'Your estimate' });
export const calculate = (page: Page) =>
  page.getByRole('button', { name: 'Calculate estimate', exact: true });

/** Opens the page and waits until the rules and products have loaded and the form shows. */
export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('form', { name: 'Your details' })).toBeVisible();
}

export async function enter(page: Page, entry: Entry) {
  await age(page).fill(entry.age);
  await status(page).selectOption(entry.status);
  await duration(page).fill(entry.duration);
  await field(page, 'Monthly take-home income').fill(entry.income);
  await field(page, 'Monthly living expenses').fill(entry.expenses);
  await field(page, 'Existing monthly debt repayments').fill(entry.debt);
  await score(page).fill(entry.score);
  await purpose(page).selectOption(entry.purpose);
  await field(page, 'Loan amount').fill(entry.loan);
  await term(page).fill(entry.term);
}

/**
 * Fills the form, calculates, and waits until the estimate heading has focus and the
 * repayment schedule (a second request) has finished loading.
 */
export async function calculateEstimate(page: Page, entry: Entry) {
  await enter(page, entry);
  await calculate(page).click();
  await expect(page.getByRole('heading', { name: 'Your estimate' })).toBeFocused();
  await expect(estimate(page).getByText('Loading the repayment schedule…')).toHaveCount(0);
}

/** Opens the schedule disclosure and returns its table (waits for the schedule request). */
export async function openSchedule(page: Page) {
  const toggle = page.getByRole('button', { name: /^Repayment schedule/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  return estimate(page).getByRole('table');
}

export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
