/**
 * The fictional demo assumptions and limits, in one place (docs/SIMULATION_MODEL.md §1–2).
 * None of these is any lender's real rate, fee or policy.
 */

/** Nominal annual interest rate, fixed for the term and compounded monthly. */
export const ANNUAL_INTEREST_RATE = 0.195;
export const MONTHLY_INTEREST_RATE = ANNUAL_INTEREST_RATE / 12;

/** Service fee added to every monthly repayment, in cents (R69). */
export const MONTHLY_FEE_CENTS = 6_900;

/**
 * Affordability rule: the new repayment may use up to 40% of the money left after living
 * expenses and existing debt. Kept as a fraction so the test is exact integer arithmetic:
 * repayment ≤ available × 2/5  ⇔  5 × repayment ≤ 2 × available.
 */
export const AFFORDABILITY_SHARE = { numerator: 2, denominator: 5 } as const;
export const AFFORDABILITY_PERCENT = 40;

/** Loan amount bounds and slider step, in whole rand. */
export const LOAN_MIN_RAND = 1_000;
export const LOAN_MAX_RAND = 250_000;
export const LOAN_STEP_RAND = 1_000;

/** Inclusive bounds for each amount, in cents. */
export const AMOUNT_BOUNDS_CENTS = {
  income: { min: 100_000, max: 100_000_000 },
  expenses: { min: 0, max: 100_000_000 },
  debt: { min: 0, max: 100_000_000 },
  loan: { min: LOAN_MIN_RAND * 100, max: LOAN_MAX_RAND * 100 },
} as const;

/** Repayment terms offered, in months. */
export const TERMS = [12, 24, 36, 48, 60] as const;
export type Term = (typeof TERMS)[number];

export const DEFAULT_TERM: Term = 36;
export const LONGEST_TERM: Term = 60;

export function isTerm(value: number): value is Term {
  return (TERMS as readonly number[]).includes(value);
}
