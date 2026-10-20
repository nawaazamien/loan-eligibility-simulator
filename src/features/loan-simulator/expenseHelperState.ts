import {
  checkCategory,
  EMPTY_EXPENSE_DRAFT,
  EXPENSE_CATEGORIES,
  mapDraft,
  totalDraft,
  type CategoryErrors,
  type ExpenseCategory,
  type ExpenseDraft,
} from './model/expenses';
import { centsToInputText, formatAmountOnBlur } from './model/format';
import { checkAmount } from './model/validate';

/**
 * State of the optional "Help me calculate my expenses" helper. The draft is only a helper:
 * the monthly-expenses field stays the single value the calculation uses, and the helper
 * changes it only through "Use this total".
 */
export interface ExpenseHelperState {
  readonly open: boolean;
  readonly draft: ExpenseDraft;
  readonly errors: CategoryErrors;
  readonly totalError: string | null;
  /** True after a failed "Use this total": categories then re-check when left. */
  readonly attempted: boolean;
  /** Why the draft started as it did, shown to the customer. */
  readonly note:
    | { readonly kind: 'movedToOther'; readonly cents: number }
    | { readonly kind: 'replaces' }
    | null;
  /** The last breakdown applied, kept while the expenses field still equals its total. */
  readonly applied: { readonly cents: number; readonly draft: ExpenseDraft } | null;
  /** Incremented on every "Use this total", so the view can move focus once per attempt. */
  readonly applyCount: number;
}

export const initialExpenseHelper: ExpenseHelperState = {
  open: false,
  draft: EMPTY_EXPENSE_DRAFT,
  errors: {},
  totalError: null,
  attempted: false,
  note: null,
  applied: null,
  applyCount: 0,
};

/** The expenses field's value in cents, or null when it is empty or invalid. */
function expensesCents(text: string): number | null {
  const check = checkAmount('expenses', text);
  return check.ok ? check.cents : null;
}

/**
 * Opening never discards what is already in the expenses field:
 * - if the field still equals the last applied breakdown, that breakdown comes back;
 * - if it holds another valid amount, the draft starts with it under "Other living expenses";
 * - if it is empty or invalid, the draft starts empty, with a note that applying replaces it.
 */
export function openHelper(helper: ExpenseHelperState, expensesText: string): ExpenseHelperState {
  const current = expensesCents(expensesText);
  const base = { ...helper, open: true, errors: {}, totalError: null, attempted: false };
  if (helper.applied && current === helper.applied.cents) {
    return { ...base, draft: helper.applied.draft, note: null };
  }
  if (current !== null) {
    return {
      ...base,
      applied: null,
      draft: { ...EMPTY_EXPENSE_DRAFT, other: centsToInputText(current) },
      note: { kind: 'movedToOther', cents: current },
    };
  }
  return { ...base, applied: null, draft: EMPTY_EXPENSE_DRAFT, note: { kind: 'replaces' } };
}

/** Cancel, or closing the disclosure: unapplied edits are discarded; nothing else changes. */
export function closeHelper(helper: ExpenseHelperState): ExpenseHelperState {
  return {
    ...initialExpenseHelper,
    applied: helper.applied,
    applyCount: helper.applyCount,
  };
}

export function editCategory(
  helper: ExpenseHelperState,
  category: ExpenseCategory,
  text: string,
): ExpenseHelperState {
  return { ...helper, draft: { ...helper.draft, [category]: text }, totalError: null };
}

/** Tidies a category on blur and, after a failed apply, re-checks it. */
export function blurCategory(
  helper: ExpenseHelperState,
  category: ExpenseCategory,
): ExpenseHelperState {
  const text = formatAmountOnBlur(helper.draft[category]);
  const draft = { ...helper.draft, [category]: text };
  if (!helper.attempted) return { ...helper, draft };
  const check = checkCategory(text);
  const errors: CategoryErrors = {};
  for (const { key } of EXPENSE_CATEGORIES) {
    const message = key === category ? (check.ok ? undefined : check.message) : helper.errors[key];
    if (message) errors[key] = message;
  }
  return { ...helper, draft, errors };
}

export type ApplyOutcome =
  | { readonly ok: true; readonly helper: ExpenseHelperState; readonly expensesText: string }
  | { readonly ok: false; readonly helper: ExpenseHelperState };

/**
 * "Use this total": validates every category, adds them in integer cents and, when the total
 * fits, returns the text for the expenses field and a closed helper that remembers this
 * breakdown. Otherwise the helper stays open with its errors.
 */
export function applyHelper(helper: ExpenseHelperState): ApplyOutcome {
  const draft = mapDraft((key) => formatAmountOnBlur(helper.draft[key]));
  const total = totalDraft(draft);
  const applyCount = helper.applyCount + 1;
  if (!total.ok) {
    return {
      ok: false,
      helper: {
        ...helper,
        draft,
        attempted: true,
        applyCount,
        errors: total.reason === 'invalid' ? total.errors : {},
        totalError: total.reason === 'tooLarge' ? total.message : null,
      },
    };
  }
  return {
    ok: true,
    expensesText: centsToInputText(total.cents),
    helper: { ...initialExpenseHelper, applied: { cents: total.cents, draft }, applyCount },
  };
}

/**
 * After the expenses field is changed by hand, a saved breakdown no longer explains it once
 * the amount differs, so it is forgotten rather than shown later for a different total.
 */
export function syncAppliedWithExpenses(
  helper: ExpenseHelperState,
  expensesText: string,
): ExpenseHelperState {
  if (!helper.applied || expensesCents(expensesText) === helper.applied.cents) return helper;
  return { ...helper, applied: null };
}
