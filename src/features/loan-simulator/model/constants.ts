/**
 * Fixed product limits from the approved design (design/reference/HANDOFF.md §5–6 and
 * docs/SIMULATION_MODEL.md §1). All of them are fictional demo values.
 */

/** Loan amount bounds and slider step, in whole rand. */
export const LOAN_MIN_RAND = 1_000;
export const LOAN_MAX_RAND = 250_000;
export const LOAN_STEP_RAND = 1_000;

/** Repayment terms offered, in months. */
export const TERMS = [12, 24, 36, 48, 60] as const;
export type Term = (typeof TERMS)[number];

export const DEFAULT_TERM: Term = 36;
