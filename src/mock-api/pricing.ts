import type { LoanProduct } from '../api/contract';

/**
 * Fictional pricing for the mock API, in integer cents and basis points (1 bp = 0.01%).
 * The employer's specification gives each product's rate range but no pricing rule; this
 * rule is a documented assumption (docs/SIMULATION_MODEL.md), not any lender's policy.
 */

export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/** A whole-cent amount from a decimal rand amount that has at most two decimal places. */
export function randToCents(rand: number): number {
  return Math.round(rand * 100);
}

export function centsToRand(cents: number): number {
  return cents / 100;
}

/**
 * Where in the product's published range a credit score lands, in eighths:
 * 0 is the lowest rate, 8 the highest. With no score the midpoint applies. The 650–699 band
 * sits a quarter of the way up, which gives the personal loan exactly the specification's
 * example rate of 12.5% for a score of 650.
 */
export function rangePositionInEighths(creditScore: number | undefined): number {
  if (creditScore === undefined) return 4;
  if (creditScore >= 750) return 0;
  if (creditScore >= 700) return 1;
  if (creditScore >= 650) return 2;
  if (creditScore >= 600) return 4;
  if (creditScore >= 550) return 6;
  return 8;
}

/** Annual rate in basis points, rounded half-up to a whole basis point (0.01%). */
export function annualRateBasisPoints(product: LoanProduct, creditScore?: number): number {
  const min = Math.round(product.interestRateRange.min * 100);
  const max = Math.round(product.interestRateRange.max * 100);
  return roundHalfUp(min + ((max - min) * rangePositionInEighths(creditScore)) / 8);
}

/**
 * The level monthly payment for an amortising loan, rounded once, half-up, to a whole cent.
 * The single floating-point step is the annuity factor. A zero rate is principal ÷ months.
 */
export function levelPaymentCents(principalCents: number, months: number, rateBp: number): number {
  if (rateBp === 0) return Math.ceil(principalCents / months);
  const r = rateBp / 10_000 / 12;
  return roundHalfUp((principalCents * r) / (1 - (1 + r) ** -months));
}

export interface ScheduleRowCents {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface ScheduleCents {
  levelPayment: number;
  rows: ScheduleRowCents[];
  totalInterest: number;
  totalRepayment: number;
}

/**
 * The full repayment schedule. Each month's interest is the outstanding balance × the
 * monthly rate, rounded half-up to a cent; the rest of the payment reduces the balance. The
 * final payment is adjusted (usually by a few cents) so the balance ends at exactly zero.
 */
export function buildSchedule(
  principalCents: number,
  months: number,
  rateBp: number,
): ScheduleCents {
  const r = rateBp / 10_000 / 12;
  const levelPayment = levelPaymentCents(principalCents, months, rateBp);
  const rows: ScheduleRowCents[] = [];
  let balance = principalCents;
  let totalInterest = 0;
  let totalRepayment = 0;

  for (let month = 1; month <= months; month += 1) {
    const interest = roundHalfUp(balance * r);
    const last = month === months;
    const principal = last ? balance : Math.min(levelPayment - interest, balance);
    const payment = principal + interest;
    balance -= principal;
    totalInterest += interest;
    totalRepayment += payment;
    rows.push({ month, payment, principal, interest, balance });
  }

  return { levelPayment, rows, totalInterest, totalRepayment };
}
