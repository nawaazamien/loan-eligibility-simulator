import { parseAmount } from './model/amount';
import { calculateEstimate, type Estimate } from './model/calculate';
import { DEFAULT_TERM, type Term } from './model/constants';
import { centsToInputText, formatAmountOnBlur } from './model/format';
import { loanSliderPosition } from './model/loanSlider';
import {
  AMOUNT_FIELDS,
  checkAmount,
  checkForm,
  inputsKey,
  type AmountField,
  type FieldErrors,
} from './model/validate';

export type { AmountField } from './model/validate';

/** Which confirmation the form status region shows, if any. Cleared by the next edit. */
export type FormStatus = 'example' | 'reset' | null;

/** The last successful calculation: its canonical inputs key and the estimate itself. */
export interface CalculatedResult {
  readonly key: string;
  readonly estimate: Estimate;
  /** The submitCount that produced it; identifies each successful calculation. */
  readonly calculation: number;
}

export interface FormState {
  /** Raw text exactly as typed; an empty string is a valid, distinct state. */
  readonly values: Readonly<Record<AmountField, string>>;
  /** Slider position in whole rand. Follows the loan text when it is a valid amount. */
  readonly loanSlider: number;
  readonly term: Term;
  readonly status: FormStatus;
  /** True once Calculate has been tried; from then on fields re-validate on blur. */
  readonly submitted: boolean;
  readonly errors: FieldErrors;
  readonly showSummary: boolean;
  /** Kept, unchanged, until the next successful calculation or a reset. */
  readonly result: CalculatedResult | null;
  /** Incremented on every submit, so the view can move focus once per attempt. */
  readonly submitCount: number;
}

export type FormAction =
  | { readonly type: 'edit'; readonly field: AmountField; readonly text: string }
  | { readonly type: 'blur'; readonly field: AmountField }
  | { readonly type: 'slide'; readonly rand: number }
  | { readonly type: 'selectTerm'; readonly term: Term }
  | { readonly type: 'useExample' }
  | { readonly type: 'submit' }
  | { readonly type: 'reset' };

/** Design defaults (HANDOFF §6): budget fields empty, R50 000 over 36 months. */
export const initialFormState: FormState = {
  values: { income: '', expenses: '', debt: '', loan: '50 000' },
  loanSlider: 50_000,
  term: DEFAULT_TERM,
  status: null,
  submitted: false,
  errors: {},
  showSummary: false,
  result: null,
  submitCount: 0,
};

/** The design's example values (HANDOFF §6). */
const EXAMPLE_VALUES = { income: '28 500', expenses: '14 200', debt: '3 150', loan: '60 000' };

/** True when a result exists and the current inputs no longer produce the same snapshot. */
export function isResultStale(state: FormState): boolean {
  return state.result !== null && inputsKey(state.values, state.term) !== state.result.key;
}

/** After a failed submit, a field's error follows its current value. */
function revalidate(state: FormState, field: AmountField, text: string): FormState {
  if (!state.submitted) return state;
  const check = checkAmount(field, text);
  const errors: FieldErrors = {};
  for (const name of AMOUNT_FIELDS) {
    const message = name === field ? (check.ok ? undefined : check.message) : state.errors[name];
    if (message) errors[name] = message;
  }
  const hasErrors = Object.keys(errors).length > 0;
  return { ...state, errors, showSummary: state.showSummary && hasErrors };
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'edit': {
      // No validation while typing: errors only change on blur or submit.
      const values = { ...state.values, [action.field]: action.text };
      const loanSlider =
        action.field === 'loan'
          ? (loanSliderPosition(parseAmount(action.text)) ?? state.loanSlider)
          : state.loanSlider;
      return { ...state, values, loanSlider, status: null };
    }
    case 'blur': {
      const formatted = formatAmountOnBlur(state.values[action.field]);
      const values = { ...state.values, [action.field]: formatted };
      return revalidate({ ...state, values }, action.field, formatted);
    }
    case 'slide': {
      const text = centsToInputText(action.rand * 100);
      const next: FormState = {
        ...state,
        values: { ...state.values, loan: text },
        loanSlider: action.rand,
        status: null,
      };
      return revalidate(next, 'loan', text);
    }
    case 'selectTerm':
      return { ...state, term: action.term, status: null };
    case 'useExample':
      // Fills the inputs only. Any previous result stays and is compared as usual.
      return {
        ...state,
        values: EXAMPLE_VALUES,
        loanSlider: 60_000,
        term: 48,
        errors: {},
        showSummary: false,
        status: 'example',
      };
    case 'submit': {
      const values = {
        income: formatAmountOnBlur(state.values.income),
        expenses: formatAmountOnBlur(state.values.expenses),
        debt: formatAmountOnBlur(state.values.debt),
        loan: formatAmountOnBlur(state.values.loan),
      };
      const check = checkForm(values, state.term);
      const submitCount = state.submitCount + 1;
      const base = { ...state, values, submitted: true, status: null, submitCount };
      if (!check.ok) return { ...base, errors: check.errors, showSummary: true };
      return {
        ...base,
        errors: {},
        showSummary: false,
        result: {
          key: inputsKey(values, state.term),
          estimate: calculateEstimate(check.inputs),
          calculation: submitCount,
        },
      };
    }
    case 'reset':
      return { ...initialFormState, status: 'reset', submitCount: state.submitCount };
  }
}
