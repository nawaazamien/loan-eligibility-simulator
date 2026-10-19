import { parseAmount } from './model/amount';
import { DEFAULT_TERM, type Term } from './model/constants';
import { centsToInputText, formatAmountOnBlur } from './model/format';
import { loanSliderPosition } from './model/loanSlider';

export type AmountField = 'income' | 'expenses' | 'debt' | 'loan';

/** Which confirmation the form status region shows, if any. Cleared by the next edit. */
export type FormStatus = 'example' | 'reset' | null;

export interface FormState {
  /** Raw text exactly as typed; an empty string is a valid, distinct state. */
  readonly values: Readonly<Record<AmountField, string>>;
  /** Slider position in whole rand. Follows the loan text when it is a valid amount. */
  readonly loanSlider: number;
  readonly term: Term;
  readonly status: FormStatus;
}

export type FormAction =
  | { readonly type: 'edit'; readonly field: AmountField; readonly text: string }
  | { readonly type: 'blur'; readonly field: AmountField }
  | { readonly type: 'slide'; readonly rand: number }
  | { readonly type: 'selectTerm'; readonly term: Term }
  | { readonly type: 'useExample' }
  | { readonly type: 'reset' };

/** Design defaults (HANDOFF §6): budget fields empty, R50 000 over 36 months. */
export const initialFormState: FormState = {
  values: { income: '', expenses: '', debt: '', loan: '50 000' },
  loanSlider: 50_000,
  term: DEFAULT_TERM,
  status: null,
};

/** The design's example values (HANDOFF §6). */
const exampleFormState: FormState = {
  values: { income: '28 500', expenses: '14 200', debt: '3 150', loan: '60 000' },
  loanSlider: 60_000,
  term: 48,
  status: 'example',
};

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'edit': {
      const values = { ...state.values, [action.field]: action.text };
      const loanSlider =
        action.field === 'loan'
          ? (loanSliderPosition(parseAmount(action.text)) ?? state.loanSlider)
          : state.loanSlider;
      return { ...state, values, loanSlider, status: null };
    }
    case 'blur': {
      const formatted = formatAmountOnBlur(state.values[action.field]);
      if (formatted === state.values[action.field]) return state;
      return { ...state, values: { ...state.values, [action.field]: formatted } };
    }
    case 'slide':
      return {
        ...state,
        values: { ...state.values, loan: centsToInputText(action.rand * 100) },
        loanSlider: action.rand,
        status: null,
      };
    case 'selectTerm':
      return { ...state, term: action.term, status: null };
    case 'useExample':
      return exampleFormState;
    case 'reset':
      return { ...initialFormState, status: 'reset' };
  }
}
