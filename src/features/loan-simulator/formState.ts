import {
  ELIGIBILITY_PRODUCT_ID,
  type CalculateRateRequest,
  type CalculateRateResponse,
  type EligibilityRequest,
  type EligibilityResponse,
} from '../../api/contract';
import {
  applyHelper,
  blurCategory,
  closeHelper,
  editCategory,
  initialExpenseHelper,
  openHelper,
  syncAppliedWithExpenses,
  type ExpenseHelperState,
} from './expenseHelperState';
import { parseAmount, parseWhole } from './model/amount';
import type { ExpenseCategory } from './model/expenses';
import { FIELDS, type Field, type FieldErrors, type FieldValues } from './model/fields';
import { centsToInputText } from './model/format';
import { sliderPosition } from './model/slider';
import { checkField, checkForm, fieldsKey, normalizeOnBlur } from './model/validate';
import { amountSliderRange, termSliderRange, type FormRules } from './rules';

/** Which confirmation the form status region shows, if any. Cleared by the next edit. */
export type FormStatus = 'example' | 'reset' | 'expensesApplied' | null;

/** Where focus should go after something happened; `n` makes each request distinct. */
export interface FocusRequest {
  readonly kind: 'summary' | 'result' | 'failure';
  readonly n: number;
}

/** The repayment schedule is a second request, so it can load, fail and be retried on its own. */
export type ScheduleState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly rate: CalculateRateResponse }
  | { readonly status: 'failed'; readonly message: string };

/**
 * One calculation: the snapshot that was submitted and every response to it. Both responses
 * belong to this snapshot only; nothing here is ever combined with another submission.
 */
export interface CalculatedResult {
  /** fieldsKey of the inputs at submission, compared with the current inputs for freshness. */
  readonly key: string;
  /** The submission that produced it. */
  readonly calculation: number;
  readonly request: EligibilityRequest;
  readonly eligibility: EligibilityResponse;
  readonly scheduleRequest: CalculateRateRequest;
  readonly schedule: ScheduleState;
  /** Incremented on each attempt at the schedule, so a late answer to an earlier one is ignored. */
  readonly scheduleRun: number;
}

/** A request in flight. Its answer is used only if this is still the current one. */
export interface PendingCalculation {
  readonly id: number;
  readonly key: string;
  readonly request: EligibilityRequest;
}

export interface FormState {
  readonly values: FieldValues;
  readonly sliders: { readonly amount: number; readonly term: number };
  readonly status: FormStatus;
  /** True once Calculate has been tried; from then on fields re-validate on blur. */
  readonly submitted: boolean;
  readonly errors: FieldErrors;
  readonly showSummary: boolean;
  /** Kept, unchanged, until the next successful calculation or a reset. */
  readonly result: CalculatedResult | null;
  readonly pending: PendingCalculation | null;
  /** The last calculation that failed, shown with a retry until the next attempt. */
  readonly failure: { readonly message: string; readonly calculation: number } | null;
  readonly nextId: number;
  readonly focus: FocusRequest | null;
  /** The optional expense breakdown; it can only change `values.expenses` by applying. */
  readonly expenseHelper: ExpenseHelperState;
}

export type FormAction =
  | { readonly type: 'edit'; readonly field: Field; readonly text: string }
  | { readonly type: 'blur'; readonly field: Field }
  | { readonly type: 'slide'; readonly which: 'amount' | 'term'; readonly value: number }
  | { readonly type: 'useExample' }
  | { readonly type: 'submit' }
  | { readonly type: 'reset' }
  | {
      readonly type: 'eligibilityLoaded';
      readonly id: number;
      readonly eligibility: EligibilityResponse;
    }
  | { readonly type: 'calculationFailed'; readonly id: number; readonly message: string }
  | { readonly type: 'calculationRejected'; readonly id: number; readonly errors: FieldErrors }
  | {
      readonly type: 'scheduleLoaded';
      readonly calculation: number;
      readonly run: number;
      readonly rate: CalculateRateResponse;
    }
  | {
      readonly type: 'scheduleFailed';
      readonly calculation: number;
      readonly run: number;
      readonly message: string;
    }
  | { readonly type: 'retrySchedule' }
  | { readonly type: 'openExpenseHelper' }
  | { readonly type: 'closeExpenseHelper' }
  | {
      readonly type: 'editExpenseCategory';
      readonly category: ExpenseCategory;
      readonly text: string;
    }
  | { readonly type: 'blurExpenseCategory'; readonly category: ExpenseCategory }
  | { readonly type: 'applyExpenseHelper' };

const DEFAULT_VALUES: FieldValues = {
  age: '',
  employmentStatus: '',
  employmentDuration: '',
  income: '',
  expenses: '',
  debt: '',
  creditScore: '',
  purpose: '',
  amount: '50 000',
  term: '36',
};

/** Example values: a plausible applicant, with the optional credit score filled in. */
const EXAMPLE_VALUES: FieldValues = {
  age: '35',
  employmentStatus: 'employed',
  employmentDuration: '24',
  income: '28 500',
  expenses: '14 200',
  debt: '3 150',
  creditScore: '650',
  purpose: 'home_improvement',
  amount: '60 000',
  term: '48',
};

/** Slider positions that follow the text of the amount and term fields. */
function slidersFor(values: FieldValues, rules: FormRules, previous: FormState['sliders']) {
  const amount = parseAmount(values.amount);
  const term = parseWhole(values.term);
  return {
    amount:
      sliderPosition(amount.kind === 'ok' ? amount.cents / 100 : null, amountSliderRange(rules)) ??
      previous.amount,
    term:
      sliderPosition(term.kind === 'ok' ? term.value : null, termSliderRange(rules)) ??
      previous.term,
  };
}

export function initialFormState(rules: FormRules): FormState {
  return {
    values: DEFAULT_VALUES,
    sliders: slidersFor(DEFAULT_VALUES, rules, {
      amount: amountSliderRange(rules).min,
      term: termSliderRange(rules).min,
    }),
    status: null,
    submitted: false,
    errors: {},
    showSummary: false,
    result: null,
    pending: null,
    failure: null,
    nextId: 1,
    focus: null,
    expenseHelper: initialExpenseHelper,
  };
}

/** True when a result exists and the current inputs no longer produce the same snapshot. */
export function isResultStale(state: FormState): boolean {
  return state.result !== null && fieldsKey(state.values) !== state.result.key;
}

/**
 * What the schedule request asks for: the amount being recommended when there is one,
 * otherwise the requested amount, so the schedule always matches the figures shown beside it.
 */
export function scheduleRequestFor(
  request: EligibilityRequest,
  eligibility: EligibilityResponse,
): CalculateRateRequest {
  const { recommendedAmount } = eligibility.recommendedLoan;
  return {
    loanAmount: recommendedAmount > 0 ? recommendedAmount : request.loanDetails.requestedAmount,
    loanTerm: request.loanDetails.loanTerm,
    loanType: ELIGIBILITY_PRODUCT_ID,
    ...(request.financialInfo.creditScore === undefined
      ? {}
      : { creditScore: request.financialInfo.creditScore }),
  };
}

/** The schedule must agree with the eligibility response it accompanies. */
export function scheduleMatches(
  eligibility: EligibilityResponse,
  rate: CalculateRateResponse,
  scheduleRequest: CalculateRateRequest,
): boolean {
  const { recommendedLoan } = eligibility;
  const sameRate = rate.interestRate === recommendedLoan.interestRate;
  const sameTotals =
    recommendedLoan.recommendedAmount === 0 ||
    (rate.monthlyPayment === recommendedLoan.monthlyPayment &&
      rate.totalRepayment === recommendedLoan.totalRepayment);
  return sameRate && sameTotals && rate.paymentSchedule.length === scheduleRequest.loanTerm;
}

const SCHEDULE_MISMATCH =
  "The repayment schedule didn't match the estimate, so it isn't shown. Try again.";

function focusNext(state: FormState, kind: FocusRequest['kind']): FocusRequest {
  return { kind, n: (state.focus?.n ?? 0) + 1 };
}

/** After a failed submit, a field's error follows its current value. */
function revalidate(state: FormState, rules: FormRules, field: Field, text: string): FormState {
  if (!state.submitted) return state;
  const check = checkField(field, text, rules);
  const errors: FieldErrors = {};
  for (const name of FIELDS) {
    const message = name === field ? (check.ok ? undefined : check.message) : state.errors[name];
    if (message) errors[name] = message;
  }
  return { ...state, errors, showSummary: state.showSummary && Object.keys(errors).length > 0 };
}

function normalizedValues(values: FieldValues): FieldValues {
  return {
    age: normalizeOnBlur('age', values.age),
    employmentStatus: values.employmentStatus,
    employmentDuration: normalizeOnBlur('employmentDuration', values.employmentDuration),
    income: normalizeOnBlur('income', values.income),
    expenses: normalizeOnBlur('expenses', values.expenses),
    debt: normalizeOnBlur('debt', values.debt),
    creditScore: normalizeOnBlur('creditScore', values.creditScore),
    purpose: values.purpose,
    amount: normalizeOnBlur('amount', values.amount),
    term: normalizeOnBlur('term', values.term),
  };
}

export function createFormReducer(rules: FormRules) {
  return function formReducer(state: FormState, action: FormAction): FormState {
    switch (action.type) {
      case 'edit': {
        // No validation while typing: errors only change on blur or submit.
        const values = { ...state.values, [action.field]: action.text };
        const sliders =
          action.field === 'amount' || action.field === 'term'
            ? slidersFor(values, rules, state.sliders)
            : state.sliders;
        const expenseHelper =
          action.field === 'expenses'
            ? syncAppliedWithExpenses(state.expenseHelper, action.text)
            : state.expenseHelper;
        return { ...state, values, sliders, expenseHelper, status: null };
      }
      case 'blur': {
        const text = normalizeOnBlur(action.field, state.values[action.field]);
        const values = { ...state.values, [action.field]: text };
        return revalidate({ ...state, values }, rules, action.field, text);
      }
      case 'slide': {
        const field = action.which;
        const text =
          field === 'amount' ? centsToInputText(action.value * 100) : String(action.value);
        const next: FormState = {
          ...state,
          values: { ...state.values, [field]: text },
          sliders: { ...state.sliders, [field]: action.value },
          status: null,
        };
        return revalidate(next, rules, field, text);
      }
      case 'useExample':
        // Fills the inputs only. Any previous result stays and is compared as usual.
        return {
          ...state,
          values: EXAMPLE_VALUES,
          sliders: slidersFor(EXAMPLE_VALUES, rules, state.sliders),
          errors: {},
          showSummary: false,
          failure: null,
          status: 'example',
          expenseHelper: { ...initialExpenseHelper, applyCount: state.expenseHelper.applyCount },
        };
      case 'submit': {
        const values = normalizedValues(state.values);
        const check = checkForm(values, rules);
        const base = { ...state, values, submitted: true, status: null } satisfies FormState;
        if (!check.ok) {
          return {
            ...base,
            errors: check.errors,
            showSummary: true,
            failure: null,
            focus: focusNext(state, 'summary'),
          };
        }
        const key = fieldsKey(values);
        // The same inputs are already on their way: a second press is a duplicate.
        if (state.pending?.key === key) return { ...base, errors: {}, showSummary: false };
        return {
          ...base,
          errors: {},
          showSummary: false,
          failure: null,
          pending: { id: state.nextId, key, request: check.request },
          nextId: state.nextId + 1,
        };
      }
      case 'eligibilityLoaded': {
        const { pending } = state;
        if (pending?.id !== action.id) return state; // superseded, reset, or already answered
        return {
          ...state,
          pending: null,
          failure: null,
          result: {
            key: pending.key,
            calculation: pending.id,
            request: pending.request,
            eligibility: action.eligibility,
            scheduleRequest: scheduleRequestFor(pending.request, action.eligibility),
            schedule: { status: 'loading' },
            scheduleRun: 1,
          },
          focus: focusNext(state, 'result'),
        };
      }
      case 'calculationFailed': {
        if (state.pending?.id !== action.id) return state;
        return {
          ...state,
          pending: null,
          failure: { message: action.message, calculation: action.id },
          focus: focusNext(state, 'failure'),
        };
      }
      case 'calculationRejected': {
        if (state.pending?.id !== action.id) return state;
        const hasErrors = Object.keys(action.errors).length > 0;
        return {
          ...state,
          pending: null,
          errors: action.errors,
          showSummary: hasErrors,
          focus: focusNext(state, hasErrors ? 'summary' : 'failure'),
        };
      }
      case 'scheduleLoaded': {
        const { result } = state;
        if (result?.calculation !== action.calculation || result.scheduleRun !== action.run) {
          return state;
        }
        const matches = scheduleMatches(result.eligibility, action.rate, result.scheduleRequest);
        return {
          ...state,
          result: {
            ...result,
            schedule: matches
              ? { status: 'ready', rate: action.rate }
              : { status: 'failed', message: SCHEDULE_MISMATCH },
          },
        };
      }
      case 'scheduleFailed': {
        const { result } = state;
        if (result?.calculation !== action.calculation || result.scheduleRun !== action.run) {
          return state;
        }
        return {
          ...state,
          result: { ...result, schedule: { status: 'failed', message: action.message } },
        };
      }
      case 'retrySchedule': {
        const { result } = state;
        if (result?.schedule.status !== 'failed') return state;
        return {
          ...state,
          result: {
            ...result,
            schedule: { status: 'loading' },
            scheduleRun: result.scheduleRun + 1,
          },
        };
      }
      case 'reset':
        // Dropping `pending` abandons any request in flight; its answer is then ignored.
        return {
          ...initialFormState(rules),
          status: 'reset',
          nextId: state.nextId,
          expenseHelper: { ...initialExpenseHelper, applyCount: state.expenseHelper.applyCount },
        };
      case 'openExpenseHelper':
        return { ...state, expenseHelper: openHelper(state.expenseHelper, state.values.expenses) };
      case 'closeExpenseHelper':
        return { ...state, expenseHelper: closeHelper(state.expenseHelper) };
      case 'editExpenseCategory':
        // Draft only: the expenses field, the status message and any estimate are untouched.
        return {
          ...state,
          expenseHelper: editCategory(state.expenseHelper, action.category, action.text),
        };
      case 'blurExpenseCategory':
        return { ...state, expenseHelper: blurCategory(state.expenseHelper, action.category) };
      case 'applyExpenseHelper': {
        const outcome = applyHelper(state.expenseHelper);
        if (!outcome.ok) return { ...state, expenseHelper: outcome.helper };
        // Through the same path as typing into the field and leaving it, so validation and the
        // derived freshness of any estimate behave exactly as for a manual entry.
        const values = { ...state.values, expenses: outcome.expensesText };
        return revalidate(
          { ...state, values, status: 'expensesApplied', expenseHelper: outcome.helper },
          rules,
          'expenses',
          outcome.expensesText,
        );
      }
    }
  };
}
