import { parseAmount } from './amount';
import { AMOUNT_BOUNDS_CENTS } from './constants';
import { formatCents } from './format';

/**
 * The optional monthly-expense breakdown. It only helps the customer arrive at one figure for
 * "Monthly living expenses"; the lending model never sees the categories.
 */
export const EXPENSE_CATEGORIES = [
  { key: 'housing', label: 'Housing' },
  { key: 'utilities', label: 'Utilities' },
  { key: 'food', label: 'Food and groceries' },
  { key: 'transport', label: 'Transport' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'phone', label: 'Phone and internet' },
  { key: 'dependants', label: 'Dependants and education' },
  { key: 'other', label: 'Other living expenses' },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['key'];
export type ExpenseDraft = Readonly<Record<ExpenseCategory, string>>;
export type CategoryErrors = Partial<Record<ExpenseCategory, string>>;

export const EMPTY_EXPENSE_DRAFT: ExpenseDraft = {
  housing: '',
  utilities: '',
  food: '',
  transport: '',
  insurance: '',
  phone: '',
  dependants: '',
  other: '',
};

/** Builds a draft by applying `value` to every category (typed, with no casts). */
export function mapDraft(value: (category: ExpenseCategory) => string): ExpenseDraft {
  return {
    housing: value('housing'),
    utilities: value('utilities'),
    food: value('food'),
    transport: value('transport'),
    insurance: value('insurance'),
    phone: value('phone'),
    dependants: value('dependants'),
    other: value('other'),
  };
}

/** Each category, and their total, must fit the monthly-expenses bound. */
const MAX_CENTS = AMOUNT_BOUNDS_CENTS.expenses.max;

export type CategoryCheck =
  { readonly ok: true; readonly cents: number } | { readonly ok: false; readonly message: string };

/**
 * One category amount. Blank means R0 (the helper says so); a typed 0 is also R0. Anything
 * else follows the main field's rules: malformed text (including more than two decimal
 * places), negative amounts and out-of-range values are errors, never parsed in part,
 * rounded or clamped.
 */
export function checkCategory(raw: string): CategoryCheck {
  const parsed = parseAmount(raw);
  switch (parsed.kind) {
    case 'empty':
      return { ok: true, cents: 0 };
    case 'malformed':
      return { ok: false, message: 'Use numbers only, for example 18 500.' };
    case 'negative':
      return { ok: false, message: 'Enter an amount of R0 or more.' };
    case 'ok':
      if (!Number.isSafeInteger(parsed.cents) || parsed.cents > MAX_CENTS) {
        return { ok: false, message: `Enter an amount up to ${formatCents(MAX_CENTS)}.` };
      }
      return { ok: true, cents: parsed.cents };
  }
}

export type DraftTotal =
  | { readonly ok: true; readonly cents: number }
  /** Some categories are invalid: there is no meaningful total to show. */
  | { readonly ok: false; readonly reason: 'invalid'; readonly errors: CategoryErrors }
  /** Every category is valid but together they exceed the monthly-expenses bound. */
  | {
      readonly ok: false;
      readonly reason: 'tooLarge';
      readonly cents: number;
      readonly message: string;
    };

/** Adds the draft in integer cents, or reports why there is no usable total. */
export function totalDraft(draft: ExpenseDraft): DraftTotal {
  const errors: CategoryErrors = {};
  let cents = 0;
  for (const { key } of EXPENSE_CATEGORIES) {
    const check = checkCategory(draft[key]);
    if (check.ok) cents += check.cents;
    else errors[key] = check.message;
  }
  if (Object.keys(errors).length > 0) return { ok: false, reason: 'invalid', errors };
  if (cents > MAX_CENTS) {
    return {
      ok: false,
      reason: 'tooLarge',
      cents,
      message: `These amounts add up to ${formatCents(cents)}, more than the ${formatCents(MAX_CENTS)} limit for monthly living expenses. Check the amounts.`,
    };
  }
  return { ok: true, cents };
}
