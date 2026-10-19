import {
  AFFORDABILITY_SHARE,
  LONGEST_TERM,
  LOAN_MAX_RAND,
  LOAN_MIN_RAND,
  LOAN_STEP_RAND,
  MONTHLY_FEE_CENTS,
  MONTHLY_INTEREST_RATE,
  type Term,
} from './constants';
import type { SimulationInputs } from './validate';

export type Outcome = 'within' | 'above' | 'none';

/** One complete, internally consistent estimate. Every money value is integer cents. */
export interface Estimate {
  readonly inputs: SimulationInputs;
  /** Expenses plus existing debt. */
  readonly committedCents: number;
  /** Income minus committed: the money left before the new loan. May be zero or negative. */
  readonly availableCents: number;
  /** Amortised loan instalment, rounded once (half-up) to cents. Excludes the fee. */
  readonly instalmentCents: number;
  /** The monthly repayment shown to the customer: instalment plus the monthly fee. */
  readonly repaymentCents: number;
  /** 40% of available, rounded down; 0 when nothing is available. For display and tips only. */
  readonly limitCents: number;
  readonly outcome: Outcome;
  /** Available minus the repayment. Negative when commitments plus the loan exceed income. */
  readonly remainingCents: number;
  /** Repayment × term, fees included. */
  readonly totalRepayableCents: number;
  /** "above" only: the largest R1 000 step that would be within the limit at this term. */
  readonly maxLoanCents: number | null;
  /** "above" only, when the term is under 60 months: the same loan over 60 months. */
  readonly longestTerm: { readonly repaymentCents: number; readonly outcome: Outcome } | null;
}

/** Rounds a non-negative amount half-up to a whole number. */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * The amortised monthly instalment for a principal in cents, rounded once, half-up, to
 * whole cents. This is the model's single floating-point step. A zero rate is defined as
 * principal ÷ months, so the function is total even though the demo rate is never zero.
 */
export function instalmentCents(
  principalCents: number,
  months: number,
  monthlyRate: number = MONTHLY_INTEREST_RATE,
): number {
  if (monthlyRate === 0) return roundHalfUp(principalCents / months);
  return roundHalfUp((principalCents * monthlyRate) / (1 - (1 + monthlyRate) ** -months));
}

export function repaymentCents(principalCents: number, term: Term): number {
  return instalmentCents(principalCents, term) + MONTHLY_FEE_CENTS;
}

/** The exact affordability test. Nothing fits when nothing is available. */
export function outcomeFor(repayment: number, available: number): Outcome {
  if (available <= 0) return 'none';
  const { numerator, denominator } = AFFORDABILITY_SHARE;
  return denominator * repayment <= numerator * available ? 'within' : 'above';
}

/**
 * Searches the same repayment function used for the outcome, so the suggestion can never
 * contradict the rule. Returns null when even the minimum loan is above the limit.
 */
function largestLoanWithin(available: number, term: Term): number | null {
  for (let rand = LOAN_MAX_RAND; rand >= LOAN_MIN_RAND; rand -= LOAN_STEP_RAND) {
    if (outcomeFor(repaymentCents(rand * 100, term), available) === 'within') return rand * 100;
  }
  return null;
}

export function calculateEstimate(inputs: SimulationInputs): Estimate {
  const { incomeCents, expensesCents, debtCents, loanCents, term } = inputs;
  const committedCents = expensesCents + debtCents;
  const availableCents = incomeCents - committedCents;
  const instalment = instalmentCents(loanCents, term);
  const repayment = instalment + MONTHLY_FEE_CENTS;
  const outcome = outcomeFor(repayment, availableCents);
  const { numerator, denominator } = AFFORDABILITY_SHARE;

  let longestTerm: Estimate['longestTerm'] = null;
  if (outcome === 'above' && term < LONGEST_TERM) {
    const longest = repaymentCents(loanCents, LONGEST_TERM);
    longestTerm = { repaymentCents: longest, outcome: outcomeFor(longest, availableCents) };
  }

  return {
    inputs,
    committedCents,
    availableCents,
    instalmentCents: instalment,
    repaymentCents: repayment,
    limitCents: availableCents > 0 ? Math.floor((numerator * availableCents) / denominator) : 0,
    outcome,
    remainingCents: availableCents - repayment,
    totalRepayableCents: repayment * term,
    maxLoanCents: outcome === 'above' ? largestLoanWithin(availableCents, term) : null,
    longestTerm,
  };
}

/** round(part ÷ whole × 100), half-up, in integers. Display only; `whole` must be positive. */
export function percentOf(part: number, whole: number): number {
  return Math.floor((200 * part + whole) / (2 * whole));
}
