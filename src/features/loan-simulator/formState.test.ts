import { beforeAll } from 'vitest';

import { createApiClient } from '../../api/client';
import type { CalculateRateResponse, EligibilityResponse } from '../../api/contract';
import { specRules } from '../../test/fixtures';
import {
  createFormReducer,
  initialFormState,
  isResultStale,
  scheduleMatches,
  scheduleRequestFor,
  type FormAction,
  type FormState,
} from './formState';
import type { ExpenseCategory } from './model/expenses';
import type { Field } from './model/fields';

const rules = specRules();
const reducer = createFormReducer(rules);
const step = (state: FormState, action: FormAction) => reducer(state, action);
const run = (...actions: FormAction[]) => actions.reduce(step, initialFormState(rules));

const fill: FormAction[] = [
  { type: 'edit', field: 'age', text: '35' },
  { type: 'edit', field: 'employmentStatus', text: 'employed' },
  { type: 'edit', field: 'employmentDuration', text: '24' },
  { type: 'edit', field: 'income', text: '28500' },
  { type: 'edit', field: 'expenses', text: '14200' },
  { type: 'edit', field: 'debt', text: '3150' },
  { type: 'edit', field: 'creditScore', text: '650' },
  { type: 'edit', field: 'purpose', text: 'home_improvement' },
  { type: 'edit', field: 'amount', text: '60000' },
  { type: 'edit', field: 'term', text: '48' },
];

// Real responses from the mocked API, so the reducer is exercised with genuine payloads.
let eligibility: EligibilityResponse;
let rate: CalculateRateResponse;
beforeAll(async () => {
  const client = createApiClient();
  const submitted = run(...fill, { type: 'submit' });
  if (!submitted.pending) throw new Error('Expected a pending calculation');
  eligibility = await client.checkEligibility(submitted.pending.request);
  rate = await client.calculateRate(scheduleRequestFor(submitted.pending.request, eligibility));
});

const pendingState = () => run(...fill, { type: 'submit' });
const pendingId = (state: FormState) => state.pending?.id ?? -1;
const answered = () => {
  const state = pendingState();
  return step(state, { type: 'eligibilityLoaded', id: pendingId(state), eligibility });
};
const calculationOf = (state: FormState) => state.result?.calculation ?? -1;
const withSchedule = () => {
  const state = answered();
  return step(state, { type: 'scheduleLoaded', calculation: calculationOf(state), run: 1, rate });
};
const requestOf = () => {
  const request = pendingState().pending?.request;
  if (!request) throw new Error('Expected a request');
  return request;
};

describe('editing', () => {
  it('stores text exactly as typed, including an empty field', () => {
    expect(run({ type: 'edit', field: 'income', text: '28500' }).values.income).toBe('28500');
    expect(run({ type: 'edit', field: 'amount', text: '' }).values.amount).toBe('');
  });

  it('formats valid text only when the field is left, and leaves malformed text alone', () => {
    const tidy = run(
      { type: 'edit', field: 'debt', text: '3150' },
      { type: 'blur', field: 'debt' },
      { type: 'edit', field: 'age', text: '035' },
      { type: 'blur', field: 'age' },
    );
    expect(tidy.values.debt).toBe('3 150');
    expect(tidy.values.age).toBe('35');
    const bad = run(
      { type: 'edit', field: 'expenses', text: '12,5,00' },
      { type: 'blur', field: 'expenses' },
    );
    expect(bad.values.expenses).toBe('12,5,00');
    expect(bad.errors).toEqual({});
  });

  it('keeps a slider in place while its text is not readable, and follows it otherwise', () => {
    const state = run(
      { type: 'edit', field: 'amount', text: '75000' },
      { type: 'edit', field: 'amount', text: '' },
      { type: 'edit', field: 'amount', text: 'lots' },
    );
    expect(state.sliders.amount).toBe(75_000);
    expect(run({ type: 'edit', field: 'term', text: '24' }).sliders.term).toBe(24);
  });

  it('writes a slider value into its field', () => {
    const state = run({ type: 'slide', which: 'amount', value: 120_000 });
    expect(state.values.amount).toBe('120 000');
    expect(run({ type: 'slide', which: 'term', value: 12 }).values.term).toBe('12');
  });
});

describe('submitting', () => {
  it('reports every error at once, builds no request and asks for focus on the summary', () => {
    const state = run({ type: 'submit' });
    expect(Object.keys(state.errors)).toEqual([
      'age',
      'employmentStatus',
      'employmentDuration',
      'income',
      'expenses',
      'debt',
      'purpose',
    ]);
    expect(state.showSummary).toBe(true);
    expect(state.pending).toBeNull();
    expect(state.focus).toEqual({ kind: 'summary', n: 1 });
  });

  it('does not show new errors while typing, then re-validates on blur', () => {
    let state = run({ type: 'submit' });
    state = step(state, { type: 'edit', field: 'age', text: '10' });
    expect(state.errors.age).toBe('Age must be between 18 and 65');
    state = step(state, { type: 'edit', field: 'age', text: '40' });
    state = step(state, { type: 'blur', field: 'age' });
    expect(state.errors.age).toBeUndefined();
  });

  it('hides the summary once the last error is fixed', () => {
    let state = run(...fill, { type: 'edit', field: 'amount', text: '1' }, { type: 'submit' });
    expect(state.showSummary).toBe(true);
    state = step(state, { type: 'slide', which: 'amount', value: 20_000 });
    expect(state.errors).toEqual({});
    expect(state.showSummary).toBe(false);
  });

  it('records one pending request, with the contract’s names and no loanType', () => {
    const state = pendingState();
    expect(state.pending?.request.personalInfo.age).toBe(35);
    expect(JSON.stringify(state.pending?.request)).not.toContain('loanType');
    expect(state.result).toBeNull();
  });

  it('treats a second press with the same inputs as a duplicate', () => {
    const once = pendingState();
    const twice = step(once, { type: 'submit' });
    expect(twice.pending).toEqual(once.pending);
    expect(twice.nextId).toBe(once.nextId);
  });

  it('supersedes the request in flight when the inputs have changed', () => {
    const first = pendingState();
    const changed = step(first, { type: 'edit', field: 'term', text: '24' });
    const second = step(changed, { type: 'submit' });
    expect(pendingId(second)).toBe(pendingId(first) + 1);
    // The first answer arrives late and is ignored.
    const late = step(second, { type: 'eligibilityLoaded', id: pendingId(first), eligibility });
    expect(late).toBe(second);
  });
});

describe('outcomes', () => {
  it('shows an answer for the current request and asks for focus on the estimate', () => {
    const state = answered();
    expect(state.pending).toBeNull();
    expect(state.result?.eligibility).toBe(eligibility);
    expect(state.result?.schedule).toEqual({ status: 'loading' });
    expect(state.focus).toEqual({ kind: 'result', n: 1 });
    expect(isResultStale(state)).toBe(false);
  });

  it('keeps the previous estimate through a failed calculation, with a retry state', () => {
    const before = answered();
    const edited = step(before, { type: 'edit', field: 'term', text: '24' });
    const pending = step(edited, { type: 'submit' });
    const failed = step(pending, {
      type: 'calculationFailed',
      id: pendingId(pending),
      message: 'down',
    });
    expect(failed.result).toBe(before.result);
    expect(failed.failure?.message).toBe('down');
    expect(failed.pending).toBeNull();
    expect(failed.focus?.kind).toBe('failure');
    expect(isResultStale(failed)).toBe(true);
    // Retrying is just submitting again, which clears the failure.
    expect(step(failed, { type: 'submit' }).failure).toBeNull();
  });

  it('ignores answers after a reset, and a reset clears everything', () => {
    const pending = pendingState();
    const reset = step(pending, { type: 'reset' });
    expect(reset.pending).toBeNull();
    expect(reset.status).toBe('reset');
    expect(reset.values).toEqual(initialFormState(rules).values);
    const late = step(reset, { type: 'eligibilityLoaded', id: pendingId(pending), eligibility });
    expect(late.result).toBeNull();
    const failedLate = step(reset, {
      type: 'calculationFailed',
      id: pendingId(pending),
      message: 'x',
    });
    expect(failedLate.failure).toBeNull();
  });

  it('keeps ids rising across a reset so an old answer can never match a new request', () => {
    const first = pendingState();
    const second = run(...fill, { type: 'submit' }, { type: 'reset' }, ...fill, {
      type: 'submit',
    });
    expect(pendingId(second)).toBeGreaterThan(pendingId(first));
  });

  it('maps a rejection onto fields and the summary, or onto a failure when there are none', () => {
    const pending = pendingState();
    const id = pendingId(pending);
    const rejected = step(pending, {
      type: 'calculationRejected',
      id,
      errors: { age: 'Age must be between 18 and 65' },
    });
    expect(rejected.errors.age).toBe('Age must be between 18 and 65');
    expect(rejected.showSummary).toBe(true);
    expect(rejected.focus?.kind).toBe('summary');
    const bare = step(pending, { type: 'calculationRejected', id, errors: {} });
    expect(bare.focus?.kind).toBe('failure');
    expect(step(pending, { type: 'calculationRejected', id: id + 9, errors: {} })).toBe(pending);
  });
});

describe('the repayment schedule', () => {
  it('asks for the recommended amount, or the requested one when none is recommended', () => {
    const request = requestOf();
    const recommended = scheduleRequestFor(request, eligibility);
    expect(recommended.loanAmount).toBe(eligibility.recommendedLoan.recommendedAmount);
    expect(recommended).toMatchObject({
      loanTerm: 48,
      loanType: 'personal_loan',
      creditScore: 650,
    });
    const none = scheduleRequestFor(request, {
      ...eligibility,
      recommendedLoan: { ...eligibility.recommendedLoan, recommendedAmount: 0 },
    });
    expect(none.loanAmount).toBe(60000);
  });

  it('omits the credit score from the schedule request when none was given', () => {
    const state = run(
      ...fill,
      { type: 'edit', field: 'creditScore', text: '' },
      { type: 'submit' },
    );
    const request = state.pending?.request;
    if (!request) throw new Error('Expected a request');
    expect('creditScore' in scheduleRequestFor(request, eligibility)).toBe(false);
  });

  it('becomes ready when the answer agrees with the estimate', () => {
    expect(withSchedule().result?.schedule).toEqual({ status: 'ready', rate });
  });

  it('fails, rather than show a mismatch, when the answer disagrees', () => {
    const state = answered();
    const calculation = calculationOf(state);
    const wrong = step(state, {
      type: 'scheduleLoaded',
      calculation,
      run: 1,
      rate: { ...rate, interestRate: rate.interestRate + 1 },
    });
    expect(wrong.result?.schedule.status).toBe('failed');
    const short = step(state, {
      type: 'scheduleLoaded',
      calculation,
      run: 1,
      rate: { ...rate, paymentSchedule: rate.paymentSchedule.slice(1) },
    });
    expect(short.result?.schedule.status).toBe('failed');
  });

  it('scheduleMatches checks rate, payment, total and length together', () => {
    const scheduleRequest = scheduleRequestFor(requestOf(), eligibility);
    expect(scheduleMatches(eligibility, rate, scheduleRequest)).toBe(true);
    const payment = { ...rate, monthlyPayment: rate.monthlyPayment + 1 };
    expect(scheduleMatches(eligibility, payment, scheduleRequest)).toBe(false);
    const total = { ...rate, totalRepayment: rate.totalRepayment + 1 };
    expect(scheduleMatches(eligibility, total, scheduleRequest)).toBe(false);
  });

  it('can fail on its own, keep the eligibility result, and be retried', () => {
    const state = answered();
    const calculation = calculationOf(state);
    const failed = step(state, { type: 'scheduleFailed', calculation, run: 1, message: 'nope' });
    expect(failed.result?.eligibility).toBe(eligibility);
    expect(failed.result?.schedule).toEqual({ status: 'failed', message: 'nope' });
    const retried = step(failed, { type: 'retrySchedule' });
    expect(retried.result?.schedule).toEqual({ status: 'loading' });
    expect(retried.result?.scheduleRun).toBe(2);
    // The answer to the first attempt arrives late and is ignored.
    expect(step(retried, { type: 'scheduleLoaded', calculation, run: 1, rate })).toBe(retried);
    expect(step(retried, { type: 'scheduleFailed', calculation, run: 1, message: 'x' })).toBe(
      retried,
    );
    expect(step(retried, { type: 'retrySchedule' })).toBe(retried);
  });

  it('ignores a schedule for another calculation', () => {
    const state = answered();
    expect(step(state, { type: 'scheduleLoaded', calculation: 999, run: 1, rate })).toBe(state);
    expect(run({ type: 'scheduleFailed', calculation: 1, run: 1, message: 'x' }).result).toBeNull();
  });
});

describe('result freshness', () => {
  const edited = (field: Field, text: string) =>
    step(withSchedule(), { type: 'edit', field, text });

  it('goes stale when any input changes, including the new fields', () => {
    const changes: [Field, string][] = [
      ['age', '36'],
      ['employmentStatus', 'retired'],
      ['employmentDuration', '25'],
      ['creditScore', '700'],
      ['creditScore', ''],
      ['purpose', 'medical'],
      ['income', '30 000'],
      ['expenses', '14 300'],
      ['debt', '3 000'],
      ['amount', '61 000'],
      ['term', '47'],
    ];
    for (const [field, text] of changes) {
      expect(isResultStale(edited(field, text))).toBe(true);
    }
  });

  it('stays fresh for formatting-only changes and when inputs return', () => {
    expect(isResultStale(edited('income', 'R28,500.00'))).toBe(false);
    const away = edited('age', '36');
    expect(isResultStale(step(away, { type: 'edit', field: 'age', text: '35' }))).toBe(false);
  });

  it('keeps the previous result, still stale, after an invalid resubmission', () => {
    const base = withSchedule();
    const bad = step(step(base, { type: 'edit', field: 'age', text: '5' }), { type: 'submit' });
    expect(bad.result).toBe(base.result);
    expect(isResultStale(bad)).toBe(true);
  });

  it('example values keep any previous result and compare it as usual', () => {
    const base = withSchedule();
    const example = step(base, { type: 'useExample' });
    expect(example.result).toBe(base.result);
    expect(example.status).toBe('example');
    // The example is the same applicant as the filled values, so the estimate is still current.
    expect(isResultStale(example)).toBe(false);
  });

  it('clears the status message on the next change', () => {
    const example = step(initialFormState(rules), { type: 'useExample' });
    expect(step(example, { type: 'edit', field: 'age', text: '40' }).status).toBeNull();
    expect(step(example, { type: 'submit' }).status).toBeNull();
  });
});

describe('expense helper', () => {
  const applyBreakdown = (state: FormState, entries: [ExpenseCategory, string][]) => {
    let next = step(state, { type: 'openExpenseHelper' });
    for (const [category, text] of entries) {
      next = step(next, { type: 'editExpenseCategory', category, text });
    }
    return step(next, { type: 'applyExpenseHelper' });
  };

  it('editing the draft leaves the form, its status and the estimate untouched', () => {
    const before = step(withSchedule(), { type: 'useExample' });
    let state = step(before, { type: 'openExpenseHelper' });
    state = step(state, { type: 'editExpenseCategory', category: 'housing', text: '99' });
    expect(state.values).toEqual(before.values);
    expect(state.status).toBe('example');
    expect(state.result).toBe(before.result);
  });

  it('applying writes the total into the expenses field and marks a changed estimate stale', () => {
    const state = applyBreakdown(withSchedule(), [
      ['other', ''],
      ['housing', '9000'],
      ['food', '6000'],
    ]);
    expect(state.values.expenses).toBe('15 000');
    expect(state.status).toBe('expensesApplied');
    expect(state.expenseHelper.open).toBe(false);
    expect(isResultStale(state)).toBe(true);
  });

  it('applying a total equal to the calculated one keeps the estimate current', () => {
    const state = applyBreakdown(withSchedule(), [
      ['other', ''],
      ['housing', '9000'],
      ['food', '5200'],
    ]);
    expect(state.values.expenses).toBe('14 200');
    expect(isResultStale(state)).toBe(false);
  });

  it('a failed apply changes nothing outside the helper', () => {
    const before = withSchedule();
    const state = applyBreakdown(before, [['food', 'abc']]);
    expect(state.values).toEqual(before.values);
    expect(state.expenseHelper.open).toBe(true);
    expect(state.expenseHelper.errors.food).toBeDefined();
  });

  it('applying clears an expenses error after a failed calculation', () => {
    let state = run({ type: 'submit' });
    expect(state.errors.expenses).toBeDefined();
    state = applyBreakdown(state, [['other', '3000']]);
    expect(state.errors.expenses).toBeUndefined();
  });

  it('a manual change to another amount forgets the saved breakdown', () => {
    let state = applyBreakdown(withSchedule(), [
      ['other', ''],
      ['housing', '9000'],
    ]);
    state = step(state, { type: 'edit', field: 'expenses', text: '9 000.00' });
    expect(state.expenseHelper.applied).not.toBeNull();
    state = step(state, { type: 'edit', field: 'expenses', text: '9 500' });
    expect(state.expenseHelper.applied).toBeNull();
  });

  it('closes, and re-checks a category when it is left after a failed apply', () => {
    const open = step(withSchedule(), { type: 'openExpenseHelper' });
    expect(step(open, { type: 'closeExpenseHelper' }).expenseHelper.open).toBe(false);
    let state = step(open, { type: 'editExpenseCategory', category: 'food', text: 'abc' });
    state = step(state, { type: 'applyExpenseHelper' });
    state = step(state, { type: 'editExpenseCategory', category: 'food', text: '2500' });
    state = step(state, { type: 'blurExpenseCategory', category: 'food' });
    expect(state.expenseHelper.draft.food).toBe('2 500');
    expect(state.expenseHelper.errors.food).toBeUndefined();
  });

  it('reset and example values discard the breakdown and close the helper', () => {
    const applied = applyBreakdown(withSchedule(), [['housing', '9000']]);
    for (const action of [{ type: 'reset' }, { type: 'useExample' }] as const) {
      const after = step(step(applied, { type: 'openExpenseHelper' }), action);
      expect(after.expenseHelper.open).toBe(false);
      expect(after.expenseHelper.applied).toBeNull();
    }
  });
});
