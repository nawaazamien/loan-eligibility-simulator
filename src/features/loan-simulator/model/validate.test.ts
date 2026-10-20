import { specRules, validValues } from '../../../test/fixtures';
import { FIELDS } from './fields';
import { checkField, checkForm, fieldsKey, normalizeOnBlur } from './validate';

const rules = specRules();
const message = (field: Parameters<typeof checkField>[0], raw: string) => {
  const check = checkField(field, raw, rules);
  return check.ok ? null : check.message;
};

describe('checkField: messages come from the validation rules', () => {
  it.each([
    ['age', '', 'Age must be between 18 and 65'],
    ['age', '17', 'Age must be between 18 and 65'],
    ['age', '66', 'Age must be between 18 and 65'],
    ['age', '-5', 'Age must be between 18 and 65'],
    ['employmentStatus', '', 'Please select your employment status'],
    ['employmentStatus', 'astronaut', 'Please select your employment status'],
    ['employmentDuration', '', 'Minimum 3 months employment required'],
    ['employmentDuration', '2', 'Minimum 3 months employment required'],
    ['income', '', 'Minimum monthly income of R5,000 required'],
    ['income', '4 999.99', 'Minimum monthly income of R5,000 required'],
    ['expenses', '', 'Please enter your monthly expenses'],
    ['creditScore', '299', 'Credit score must be between 300 and 850'],
    ['creditScore', '851', 'Credit score must be between 300 and 850'],
    ['amount', '', 'Loan amount must be between R5,000 and R300,000'],
    ['amount', '4 999.99', 'Loan amount must be between R5,000 and R300,000'],
    ['amount', '300 000.01', 'Loan amount must be between R5,000 and R300,000'],
    ['term', '', 'Loan term must be between 6 and 60 months'],
    ['term', '5', 'Loan term must be between 6 and 60 months'],
    ['term', '61', 'Loan term must be between 6 and 60 months'],
  ] as const)('%s %j → %s', (field, raw, expected) => {
    expect(message(field, raw)).toBe(expected);
  });

  it('accepts every boundary value', () => {
    for (const [field, raw] of [
      ['age', '18'],
      ['age', '65'],
      ['employmentDuration', '3'],
      ['employmentDuration', '480'],
      ['income', '5 000'],
      ['income', '100 000 000'],
      ['expenses', '0'],
      ['debt', '0'],
      ['creditScore', '300'],
      ['creditScore', '850'],
      ['amount', '5 000'],
      ['amount', '300 000'],
      ['term', '6'],
      ['term', '60'],
    ] as const) {
      expect(message(field, raw)).toBeNull();
    }
  });

  it('treats the credit score as optional: empty is fine, a bad value is not', () => {
    expect(message('creditScore', '')).toBeNull();
    expect(message('creditScore', '   ')).toBeNull();
    expect(message('creditScore', 'abc')).toBe('Use whole numbers only, for example 35.');
  });

  it('keeps empty distinct from zero: an empty expenses field is an error, 0 is valid', () => {
    expect(message('expenses', '')).toBe('Please enter your monthly expenses');
    expect(message('expenses', '0')).toBeNull();
    expect(message('debt', '')).toBe(
      'Enter your existing monthly debt repayments, or 0 if you have none.',
    );
    expect(message('debt', '0')).toBeNull();
  });

  it('rejects unreadable text as a whole, with no partial reading', () => {
    for (const raw of ['abc', '12,5,00', '1e5', '35abc', '1.234']) {
      expect(message('income', raw)).toBe('Use numbers only, for example 18 500.');
      expect(message('expenses', raw)).toBe('Use numbers only, for example 18 500.');
    }
    for (const raw of ['abc', '35.5', '3 5x', '1e2']) {
      expect(message('age', raw)).toBe('Use whole numbers only, for example 35.');
      expect(message('term', raw)).toBe('Use whole numbers only, for example 35.');
    }
  });

  it('accepts the formats the form already tolerates', () => {
    for (const raw of ['28500', '28 500', 'R28,500', '28 500', '28 500,00']) {
      expect(message('income', raw)).toBeNull();
    }
    expect(message('age', '35.00')).toBeNull();
  });

  it('rejects a negative amount and amounts above the project ceiling', () => {
    expect(message('expenses', '-1')).toBe('Enter an amount of R0 or more.');
    // Where the rules set a minimum above zero, the rule’s own message applies.
    expect(message('income', '-1')).toBe('Minimum monthly income of R5,000 required');
    expect(message('debt', '-1')).toBe('Enter an amount of R0 or more.');
    expect(message('income', '100 000 000.01')).toBe('Enter an amount up to R100 000 000.');
    expect(message('expenses', '9'.repeat(30))).toBe('Enter an amount up to R100 000 000.');
  });

  it('checks the option lists', () => {
    for (const status of ['employed', 'self_employed', 'unemployed', 'retired']) {
      expect(message('employmentStatus', status)).toBeNull();
    }
    for (const purpose of [
      'debt_consolidation',
      'home_improvement',
      'education',
      'medical',
      'other',
    ]) {
      expect(message('purpose', purpose)).toBeNull();
    }
    expect(message('purpose', '')).toBe('Please select a loan purpose.');
    // A vehicle purpose belongs to another product: not accepted by the personal-loan check.
    expect(message('purpose', 'new_vehicle')).toBe('Please select a loan purpose.');
  });

  it('does not silently exempt any employment status from the duration requirement', () => {
    // The rules make duration required with a minimum of 3 for everyone; there is no
    // conditional rule, so the form follows the contract (TRACEABILITY.md).
    for (const status of ['employed', 'self_employed', 'unemployed', 'retired']) {
      const result = checkForm(
        validValues({ employmentStatus: status, employmentDuration: '' }),
        rules,
      );
      expect(result.ok).toBe(false);
    }
  });
});

describe('checkForm', () => {
  it('builds the eligibility request with the contract’s exact names and nesting', () => {
    expect(checkForm(validValues(), rules)).toEqual({
      ok: true,
      request: {
        personalInfo: { age: 35, employmentStatus: 'employed', employmentDuration: 24 },
        financialInfo: {
          monthlyIncome: 28500,
          monthlyExpenses: 14200,
          existingDebt: 3150,
          creditScore: 650,
        },
        loanDetails: { requestedAmount: 60000, loanTerm: 48, loanPurpose: 'home_improvement' },
      },
    });
  });

  it('omits the credit score when it is not given, rather than sending zero or null', () => {
    const result = checkForm(validValues({ creditScore: '' }), rules);
    expect(result.ok && 'creditScore' in result.request.financialInfo).toBe(false);
  });

  it('has no loanType in the eligibility request', () => {
    const result = checkForm(validValues(), rules);
    expect(JSON.stringify(result)).not.toContain('loanType');
  });

  it('sends amounts as exact decimal rand', () => {
    const result = checkForm(validValues({ income: '12 345.67', amount: '5 000.50' }), rules);
    expect(result.ok && result.request.financialInfo.monthlyIncome).toBe(12345.67);
    expect(result.ok && result.request.loanDetails.requestedAmount).toBe(5000.5);
  });

  it('reports every invalid field at once and builds nothing', () => {
    const result = checkForm(
      validValues({ age: '10', income: '', term: '99', purpose: '' }),
      rules,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        age: 'Age must be between 18 and 65',
        income: 'Minimum monthly income of R5,000 required',
        purpose: 'Please select a loan purpose.',
        term: 'Loan term must be between 6 and 60 months',
      },
    });
  });

  it('accepts income that does not cover commitments: that is an outcome, not an input error', () => {
    expect(checkForm(validValues({ income: '5 000', expenses: '20 000' }), rules).ok).toBe(true);
  });
});

describe('normalizeOnBlur', () => {
  it('regroups valid amounts and tidies whole numbers', () => {
    expect(normalizeOnBlur('income', '28500')).toBe('28 500');
    expect(normalizeOnBlur('amount', 'R60,000.5')).toBe('60 000.50');
    expect(normalizeOnBlur('age', ' 035 ')).toBe('35');
    expect(normalizeOnBlur('term', '48.00')).toBe('48');
  });

  it('leaves anything else exactly as typed', () => {
    expect(normalizeOnBlur('income', '28 5o0')).toBe('28 5o0');
    expect(normalizeOnBlur('age', '35.5')).toBe('35.5');
    expect(normalizeOnBlur('creditScore', '')).toBe('');
    expect(normalizeOnBlur('employmentStatus', 'employed')).toBe('employed');
  });
});

describe('fieldsKey', () => {
  const key = (over: Parameters<typeof validValues>[0] = {}) => fieldsKey(validValues(over));

  it('ignores formatting-only differences', () => {
    expect(key({ income: '28500' })).toBe(key());
    expect(key({ income: 'R28,500.00', age: '035', term: '48.0' })).toBe(key());
  });

  it('changes with any field', () => {
    for (const field of FIELDS) {
      const different =
        field === 'employmentStatus' ? 'retired' : field === 'purpose' ? 'medical' : '36';
      expect(key({ [field]: different })).not.toBe(key());
    }
  });

  it('tells an empty whole-number field from an unreadable one', () => {
    expect(key({ age: '' })).not.toBe(key({ age: 'abc' }));
    expect(key({ age: '' })).toBe(key({ age: '   ' }));
  });

  it('never matches when a field is empty or unreadable', () => {
    expect(key({ income: '' })).not.toBe(key());
    expect(key({ income: '28 5o0' })).not.toBe(key());
    expect(key({ employmentStatus: '' })).not.toBe(key());
  });

  it('treats an empty credit score as "not given", distinct from any score', () => {
    expect(key({ creditScore: '' })).not.toBe(key());
    expect(key({ creditScore: '   ' })).toBe(key({ creditScore: '' }));
  });
});
