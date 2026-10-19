import { checkAmount, checkForm, inputsKey } from './validate';

const VALID = { income: '28 500', expenses: '14 200', debt: '3 150', loan: '60 000' };

describe('checkAmount', () => {
  it('keeps empty distinct from zero', () => {
    expect(checkAmount('expenses', '')).toEqual({
      ok: false,
      message: 'Enter your monthly living expenses, or 0 if you have none.',
    });
    expect(checkAmount('expenses', '0')).toEqual({ ok: true, cents: 0 });
    expect(checkAmount('debt', '0')).toEqual({ ok: true, cents: 0 });
  });

  it('uses each field’s own empty message', () => {
    expect(checkAmount('income', ' ')).toMatchObject({
      message: 'Enter your monthly take-home income.',
    });
    expect(checkAmount('debt', '')).toMatchObject({
      message: 'Enter your existing debt repayments, or 0 if you have none.',
    });
    expect(checkAmount('loan', '')).toMatchObject({
      message: 'Enter the loan amount you would like.',
    });
  });

  it.each(['28 500', '28500', 'R28,500', '28 500', '28 500,00'])(
    'accepts the formatting %j',
    (raw) => {
      expect(checkAmount('income', raw)).toEqual({ ok: true, cents: 2_850_000 });
    },
  );

  it.each(['abc', '12,5,00', '1.234', '10.005', '1e5', '28 500abc', '5.'])(
    'rejects %j as a whole, with no partial reading',
    (raw) => {
      expect(checkAmount('income', raw)).toEqual({
        ok: false,
        message: 'Use numbers only, for example 18 500.',
      });
    },
  );

  it('rejects negative amounts', () => {
    expect(checkAmount('debt', '-200')).toEqual({
      ok: false,
      message: 'Enter an amount of R0 or more.',
    });
  });

  it('applies the inclusive bounds for each field', () => {
    const incomeRange = 'Enter an amount between R1 000 and R1 000 000.';
    expect(checkAmount('income', '999.99')).toEqual({ ok: false, message: incomeRange });
    expect(checkAmount('income', '1 000')).toEqual({ ok: true, cents: 100_000 });
    expect(checkAmount('income', '1 000 000')).toEqual({ ok: true, cents: 100_000_000 });
    expect(checkAmount('income', '1 000 000.01')).toEqual({ ok: false, message: incomeRange });

    const loanRange = 'Enter an amount between R1 000 and R250 000.';
    expect(checkAmount('loan', '999')).toEqual({ ok: false, message: loanRange });
    expect(checkAmount('loan', '250 000')).toEqual({ ok: true, cents: 25_000_000 });
    expect(checkAmount('loan', '400 000')).toEqual({ ok: false, message: loanRange });

    const upTo = 'Enter an amount up to R1 000 000.';
    expect(checkAmount('expenses', '1 000 000')).toEqual({ ok: true, cents: 100_000_000 });
    expect(checkAmount('expenses', '1 000 001')).toEqual({ ok: false, message: upTo });
    expect(checkAmount('debt', '1 000 000.01')).toEqual({ ok: false, message: upTo });
  });

  it('reports numbers too large to hold exactly as out of range, never rounded', () => {
    expect(checkAmount('loan', '9'.repeat(20))).toEqual({
      ok: false,
      message: 'Enter an amount between R1 000 and R250 000.',
    });
    expect(checkAmount('income', '9'.repeat(400))).toMatchObject({ ok: false });
  });
});

describe('checkForm', () => {
  it('returns exact cents for valid inputs', () => {
    expect(checkForm(VALID, 48)).toEqual({
      ok: true,
      inputs: {
        incomeCents: 2_850_000,
        expensesCents: 1_420_000,
        debtCents: 315_000,
        loanCents: 6_000_000,
        term: 48,
      },
    });
  });

  it('accepts income that does not cover commitments: that is an outcome, not an error', () => {
    expect(checkForm({ ...VALID, income: '12 000', expenses: '20 000' }, 24).ok).toBe(true);
  });

  it('reports every invalid field at once and calculates nothing', () => {
    expect(
      checkForm({ income: '-5 000', expenses: '12,5,00', debt: '', loan: '400 000' }, 36),
    ).toEqual({
      ok: false,
      errors: {
        income: 'Enter an amount of R0 or more.',
        expenses: 'Use numbers only, for example 18 500.',
        debt: 'Enter your existing debt repayments, or 0 if you have none.',
        loan: 'Enter an amount between R1 000 and R250 000.',
      },
    });
  });

  it('rejects an unsupported term outright', () => {
    expect(() => checkForm(VALID, 18)).toThrow(RangeError);
    expect(() => checkForm(VALID, 0)).toThrow(RangeError);
  });
});

describe('inputsKey', () => {
  it('ignores formatting-only differences', () => {
    expect(inputsKey({ ...VALID, income: '28500' }, 48)).toBe(inputsKey(VALID, 48));
    expect(inputsKey({ ...VALID, income: 'R28,500.00' }, 48)).toBe(inputsKey(VALID, 48));
  });

  it('changes with any value or the term', () => {
    expect(inputsKey({ ...VALID, debt: '3 151' }, 48)).not.toBe(inputsKey(VALID, 48));
    expect(inputsKey(VALID, 36)).not.toBe(inputsKey(VALID, 48));
  });

  it('never matches when a field is empty or invalid', () => {
    expect(inputsKey({ ...VALID, debt: '' }, 48)).not.toBe(inputsKey(VALID, 48));
    expect(inputsKey({ ...VALID, loan: '60 000x' }, 48)).not.toBe(inputsKey(VALID, 48));
  });
});
