import { formReducer, initialFormState, type FormState } from './formState';

describe('formReducer', () => {
  it('stores text exactly as typed, including an empty field', () => {
    let state = formReducer(initialFormState, { type: 'edit', field: 'income', text: '28500' });
    expect(state.values.income).toBe('28500');

    state = formReducer(state, { type: 'edit', field: 'income', text: '' });
    expect(state.values.income).toBe('');
  });

  it('formats a valid amount only when the field is left', () => {
    const typed = formReducer(initialFormState, { type: 'edit', field: 'debt', text: '3150' });
    expect(formReducer(typed, { type: 'blur', field: 'debt' }).values.debt).toBe('3 150');
  });

  it('leaves malformed text untouched on blur', () => {
    const typed = formReducer(initialFormState, {
      type: 'edit',
      field: 'expenses',
      text: '12,5,00',
    });
    const blurred = formReducer(typed, { type: 'blur', field: 'expenses' });
    expect(blurred.values.expenses).toBe('12,5,00');
    expect(blurred).toBe(typed);
  });

  it('moves the slider when a valid loan amount is typed', () => {
    const state = formReducer(initialFormState, { type: 'edit', field: 'loan', text: '75000' });
    expect(state.loanSlider).toBe(75_000);
  });

  it('keeps the slider in place while the loan text is not a valid amount', () => {
    const cleared = formReducer(initialFormState, { type: 'edit', field: 'loan', text: '' });
    expect(cleared.loanSlider).toBe(50_000);
    const garbled = formReducer(cleared, { type: 'edit', field: 'loan', text: 'lots' });
    expect(garbled.loanSlider).toBe(50_000);
  });

  it('writes the slider value into the loan field', () => {
    const state = formReducer(initialFormState, { type: 'slide', rand: 120_000 });
    expect(state.values.loan).toBe('120 000');
    expect(state.loanSlider).toBe(120_000);
  });

  it('fills the example values and term without touching anything else', () => {
    const state = formReducer(initialFormState, { type: 'useExample' });
    expect(state).toEqual<FormState>({
      values: { income: '28 500', expenses: '14 200', debt: '3 150', loan: '60 000' },
      loanSlider: 60_000,
      term: 48,
      status: 'example',
    });
  });

  it('resets to the documented defaults and reports the reset', () => {
    let state = formReducer(initialFormState, { type: 'useExample' });
    state = formReducer(state, { type: 'selectTerm', term: 12 });
    state = formReducer(state, { type: 'reset' });
    expect(state).toEqual({ ...initialFormState, status: 'reset' });
  });

  it('clears the status message on the next change', () => {
    const example = formReducer(initialFormState, { type: 'useExample' });
    expect(formReducer(example, { type: 'edit', field: 'income', text: '1' }).status).toBeNull();
    expect(formReducer(example, { type: 'selectTerm', term: 60 }).status).toBeNull();
    expect(formReducer(example, { type: 'slide', rand: 2_000 }).status).toBeNull();
  });
});
