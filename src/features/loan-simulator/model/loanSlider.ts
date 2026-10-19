import type { ParsedAmount } from './amount';
import { LOAN_MAX_RAND, LOAN_MIN_RAND, LOAN_STEP_RAND } from './constants';

/**
 * Where the loan slider should sit for the text in the loan amount field, which is the
 * source of truth. A valid amount is rounded to the slider step and clamped to its range
 * (so R52 500 can be typed although the slider moves in R1 000 steps). Any other text
 * returns null: the slider keeps its last position rather than inventing an amount.
 */
export function loanSliderPosition(parsed: ParsedAmount): number | null {
  if (parsed.kind !== 'ok') return null;
  const stepped = Math.round(parsed.cents / (LOAN_STEP_RAND * 100)) * LOAN_STEP_RAND;
  return Math.min(LOAN_MAX_RAND, Math.max(LOAN_MIN_RAND, stepped));
}
