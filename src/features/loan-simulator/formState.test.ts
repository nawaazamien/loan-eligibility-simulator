import {
  formReducer,
  initialFormState,
  isResultStale,
  type FormAction,
  type FormState,
} from './formState';

const run = (...actions: FormAction[]) => actions.reduce(formReducer, initialFormState);

const fill: FormAction[] = [
  { type: 'edit', field: 'income', text: '28500' },
  { type: 'edit', field: 'expenses', text: '14200' },
  { type: 'edit', field: 'debt', text: '3150' },
  { type: 'edit', field: 'loan', text: '60000' },
  { type: 'selectTerm', term: 48 },
];

describe('formReducer: editing', () => {
  it('stores text exactly as typed, including an empty field', () => {
    expect(run({ type: 'edit', field: 'income', text: '28500' }).values.income).toBe('28500');
    expect(run({ type: 'edit', field: 'loan', text: '' }).values.loan).toBe('');
  });

  it('formats a valid amount only when the field is left', () => {
    expect(
      run({ type: 'edit', field: 'debt', text: '3150' }, { type: 'blur', field: 'debt' }).values
        .debt,
    ).toBe('3 150');
  });

  it('leaves malformed text untouched on blur', () => {
    const state = run(
      { type: 'edit', field: 'expenses', text: '12,5,00' },
      { type: 'blur', field: 'expenses' },
    );
    expect(state.values.expenses).toBe('12,5,00');
    expect(state.errors).toEqual({});
  });

  it('keeps the slider in place while the loan text is not a valid amount', () => {
    const state = run(
      { type: 'edit', field: 'loan', text: '75000' },
      { type: 'edit', field: 'loan', text: '' },
      { type: 'edit', field: 'loan', text: 'lots' },
    );
    expect(state.loanSlider).toBe(75_000);
  });

  it('writes the slider value into the loan field', () => {
    const state = run({ type: 'slide', rand: 120_000 });
    expect(state.values.loan).toBe('120 000');
    expect(state.loanSlider).toBe(120_000);
  });
});

describe('formReducer: submitting', () => {
  it('reports every error, keeps every value and calculates nothing', () => {
    const state = run(
      { type: 'edit', field: 'income', text: '-5 000' },
      { type: 'edit', field: 'expenses', text: '12,5,00' },
      { type: 'edit', field: 'loan', text: '400000' },
      { type: 'submit' },
    );
    expect(state.values).toEqual({
      income: '-5 000',
      expenses: '12,5,00',
      debt: '',
      loan: '400 000',
    });
    expect(Object.keys(state.errors)).toEqual(['income', 'expenses', 'debt', 'loan']);
    expect(state.showSummary).toBe(true);
    expect(state.result).toBeNull();
    expect(state.submitCount).toBe(1);
  });

  it('calculates from the text fields and formats them', () => {
    const state = run(...fill, { type: 'submit' });
    expect(state.values).toEqual({
      income: '28 500',
      expenses: '14 200',
      debt: '3 150',
      loan: '60 000',
    });
    expect(state.errors).toEqual({});
    expect(state.result?.estimate.repaymentCents).toBe(187_888);
    expect(state.result?.calculation).toBe(1);
  });

  it('calculates from the loan text, not from a slider left elsewhere', () => {
    const state = run(...fill, { type: 'edit', field: 'loan', text: '60 500' }, { type: 'submit' });
    expect(state.loanSlider).toBe(61_000);
    expect(state.result?.estimate.inputs.loanCents).toBe(6_050_000);
  });

  it('does not show new errors while typing, then re-validates on blur', () => {
    let state = run({ type: 'submit' });
    state = formReducer(state, { type: 'edit', field: 'income', text: '50' });
    expect(state.errors.income).toBe('Enter your monthly take-home income.');
    state = formReducer(state, { type: 'blur', field: 'income' });
    expect(state.errors.income).toBe('Enter an amount between R1 000 and R1 000 000.');
    state = formReducer(state, { type: 'edit', field: 'income', text: '5000' });
    state = formReducer(state, { type: 'blur', field: 'income' });
    expect(state.errors.income).toBeUndefined();
  });

  it('hides the summary once the last error is fixed', () => {
    let state = run(...fill, { type: 'edit', field: 'debt', text: '' }, { type: 'submit' });
    expect(state.showSummary).toBe(true);
    state = formReducer(state, { type: 'edit', field: 'debt', text: '0' });
    state = formReducer(state, { type: 'blur', field: 'debt' });
    expect(state.errors).toEqual({});
    expect(state.showSummary).toBe(false);
  });

  it('clears a loan error when the slider sets a valid amount', () => {
    let state = run({ type: 'edit', field: 'loan', text: '' }, { type: 'submit' });
    expect(state.errors.loan).toBeDefined();
    state = formReducer(state, { type: 'slide', rand: 20_000 });
    expect(state.errors.loan).toBeUndefined();
  });
});

describe('formReducer: result freshness', () => {
  const calculated = (): FormState => run(...fill, { type: 'submit' });

  it('is fresh straight after a calculation', () => {
    expect(isResultStale(calculated())).toBe(false);
    expect(isResultStale(initialFormState)).toBe(false);
  });

  it('goes stale when any input or the term changes', () => {
    expect(
      isResultStale(formReducer(calculated(), { type: 'edit', field: 'debt', text: '3 151' })),
    ).toBe(true);
    expect(isResultStale(formReducer(calculated(), { type: 'selectTerm', term: 60 }))).toBe(true);
    expect(isResultStale(formReducer(calculated(), { type: 'slide', rand: 61_000 }))).toBe(true);
  });

  it('goes stale on an incomplete or invalid edit', () => {
    expect(
      isResultStale(formReducer(calculated(), { type: 'edit', field: 'income', text: '' })),
    ).toBe(true);
    expect(
      isResultStale(formReducer(calculated(), { type: 'edit', field: 'income', text: '28 5o0' })),
    ).toBe(true);
  });

  it('stays fresh for formatting-only changes', () => {
    expect(
      isResultStale(formReducer(calculated(), { type: 'edit', field: 'income', text: '28500' })),
    ).toBe(false);
    expect(
      isResultStale(
        formReducer(calculated(), { type: 'edit', field: 'income', text: 'R28,500.00' }),
      ),
    ).toBe(false);
  });

  it('is fresh again when the inputs return to the calculated values', () => {
    let state = formReducer(calculated(), { type: 'selectTerm', term: 60 });
    state = formReducer(state, { type: 'edit', field: 'income', text: '30 000' });
    expect(isResultStale(state)).toBe(true);
    state = formReducer(state, { type: 'edit', field: 'income', text: '28 500' });
    state = formReducer(state, { type: 'selectTerm', term: 48 });
    expect(isResultStale(state)).toBe(false);
  });

  it('keeps the previous result, still stale, after an invalid resubmission', () => {
    const before = calculated();
    let state = formReducer(before, { type: 'edit', field: 'income', text: 'abc' });
    state = formReducer(state, { type: 'submit' });
    expect(state.result).toBe(before.result);
    expect(state.errors.income).toBe('Use numbers only, for example 18 500.');
    expect(isResultStale(state)).toBe(true);
  });

  it('replaces the result on a valid recalculation', () => {
    let state = formReducer(calculated(), { type: 'edit', field: 'loan', text: '120 000' });
    state = formReducer(state, { type: 'submit' });
    expect(isResultStale(state)).toBe(false);
    expect(state.result?.estimate.inputs.loanCents).toBe(12_000_000);
    expect(state.result?.calculation).toBe(2);
  });

  it('example values keep any previous result and compare it as usual', () => {
    const fromExample = formReducer(calculated(), { type: 'useExample' });
    expect(fromExample.result).not.toBeNull();
    expect(isResultStale(fromExample)).toBe(false);
    expect(fromExample.status).toBe('example');

    const otherIncome = run(
      ...fill,
      { type: 'edit', field: 'income', text: '40000' },
      { type: 'submit' },
      { type: 'useExample' },
    );
    expect(otherIncome.result?.estimate.inputs.incomeCents).toBe(4_000_000);
    expect(isResultStale(otherIncome)).toBe(true);
  });

  it('reset restores the defaults and clears the result and errors', () => {
    let state = formReducer(calculated(), { type: 'edit', field: 'income', text: 'x' });
    state = formReducer(state, { type: 'submit' });
    state = formReducer(state, { type: 'reset' });
    expect(state).toEqual({ ...initialFormState, status: 'reset', submitCount: 2 });
    expect(isResultStale(state)).toBe(false);
  });

  it('clears the status message on the next change', () => {
    const example = run({ type: 'useExample' });
    expect(formReducer(example, { type: 'edit', field: 'income', text: '1' }).status).toBeNull();
    expect(formReducer(example, { type: 'selectTerm', term: 60 }).status).toBeNull();
    expect(formReducer(example, { type: 'submit' }).status).toBeNull();
  });
});
