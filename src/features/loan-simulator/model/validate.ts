import { parseAmount } from './amount';
import { AMOUNT_BOUNDS_CENTS, isTerm, type Term } from './constants';
import { formatCents } from './format';

export type AmountField = 'income' | 'expenses' | 'debt' | 'loan';
export const AMOUNT_FIELDS: readonly AmountField[] = ['income', 'expenses', 'debt', 'loan'];

/** Validated inputs for one calculation. Every amount is exact integer cents. */
export interface SimulationInputs {
  readonly incomeCents: number;
  readonly expensesCents: number;
  readonly debtCents: number;
  readonly loanCents: number;
  readonly term: Term;
}

/** Messages verbatim from the design (HANDOFF §6). */
const EMPTY_MESSAGES: Record<AmountField, string> = {
  income: 'Enter your monthly take-home income.',
  expenses: 'Enter your monthly living expenses, or 0 if you have none.',
  debt: 'Enter your existing debt repayments, or 0 if you have none.',
  loan: 'Enter the loan amount you would like.',
};
const MALFORMED_MESSAGE = 'Use numbers only, for example 18 500.';
const NEGATIVE_MESSAGE = 'Enter an amount of R0 or more.';

function rangeMessage(field: AmountField): string {
  const { min, max } = AMOUNT_BOUNDS_CENTS[field];
  return min > 0
    ? `Enter an amount between ${formatCents(min)} and ${formatCents(max)}.`
    : `Enter an amount up to ${formatCents(max)}.`;
}

export type AmountCheck =
  { readonly ok: true; readonly cents: number } | { readonly ok: false; readonly message: string };

/**
 * Checks one amount, in the design's order: empty → malformed (including more than two
 * decimal places) → negative → range. Values are never clamped or defaulted; numbers too
 * large to hold exactly are reported as out of range.
 */
export function checkAmount(field: AmountField, raw: string): AmountCheck {
  const parsed = parseAmount(raw);
  switch (parsed.kind) {
    case 'empty':
      return { ok: false, message: EMPTY_MESSAGES[field] };
    case 'malformed':
      return { ok: false, message: MALFORMED_MESSAGE };
    case 'negative':
      return { ok: false, message: NEGATIVE_MESSAGE };
    case 'ok': {
      const { min, max } = AMOUNT_BOUNDS_CENTS[field];
      if (!Number.isSafeInteger(parsed.cents) || parsed.cents < min || parsed.cents > max) {
        return { ok: false, message: rangeMessage(field) };
      }
      return { ok: true, cents: parsed.cents };
    }
  }
}

export type FieldErrors = Partial<Record<AmountField, string>>;

export type FormCheck =
  | { readonly ok: true; readonly inputs: SimulationInputs }
  | { readonly ok: false; readonly errors: FieldErrors };

/** Validates the whole form. Either every input is valid, or every problem is reported. */
export function checkForm(values: Readonly<Record<AmountField, string>>, term: number): FormCheck {
  const errors: FieldErrors = {};
  const cents: Partial<Record<AmountField, number>> = {};
  for (const field of AMOUNT_FIELDS) {
    const check = checkAmount(field, values[field]);
    if (check.ok) cents[field] = check.cents;
    else errors[field] = check.message;
  }
  if (!isTerm(term)) {
    // Not reachable through the radio buttons; guards the model against bad callers.
    throw new RangeError(`Unsupported repayment term: ${String(term)} months`);
  }

  const { income, expenses, debt, loan } = cents;
  if (income === undefined || expenses === undefined || debt === undefined || loan === undefined) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    inputs: {
      incomeCents: income,
      expensesCents: expenses,
      debtCents: debt,
      loanCents: loan,
      term,
    },
  };
}

/**
 * A key for the inputs as the calculation sees them. Valid amounts are keyed by their cents,
 * so "28500" and "28 500" match; anything invalid is keyed by its raw text, so it never
 * matches a calculated snapshot.
 */
export function inputsKey(values: Readonly<Record<AmountField, string>>, term: number): string {
  const parts = AMOUNT_FIELDS.map((field) => {
    const check = checkAmount(field, values[field]);
    return check.ok ? String(check.cents) : `invalid:${values[field]}`;
  });
  return [...parts, String(term)].join('|');
}
