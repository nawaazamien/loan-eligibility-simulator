import { MAX_MONEY_RAND } from '../../../api/assumptions';

/**
 * Limits that are this project's own technical choices, not the employer's rules. Every other
 * limit (age, income minimum, amount and term ranges, credit score range) comes from the
 * validation-rules and products endpoints at run time.
 */

/** The ceiling for income, expenses, existing debt and expense categories, in cents. */
export const MAX_MONEY_CENTS = MAX_MONEY_RAND * 100;

/** Slider granularity for the loan amount, in whole rand. */
export const AMOUNT_SLIDER_STEP_RAND = 1_000;
