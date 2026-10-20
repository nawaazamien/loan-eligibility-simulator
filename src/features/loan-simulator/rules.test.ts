import { PRODUCTS, VALIDATION_RULES } from '../../mock-api/catalogue';
import { specRules } from '../../test/fixtures';
import { amountSliderRange, buildFormRules, termSliderRange } from './rules';

describe('buildFormRules', () => {
  const rules = specRules();

  it('reads every limit and message from the API responses, amounts in cents', () => {
    expect(rules.age).toEqual({ min: 18, max: 65, message: 'Age must be between 18 and 65' });
    expect(rules.employmentDuration).toEqual({
      min: 3,
      max: undefined,
      message: 'Minimum 3 months employment required',
    });
    expect(rules.income).toEqual({
      minCents: 500_000,
      maxCents: undefined,
      message: 'Minimum monthly income of R5,000 required',
    });
    expect(rules.amount).toMatchObject({ minCents: 500_000, maxCents: 30_000_000 });
    expect(rules.term).toMatchObject({ min: 6, max: 60 });
    expect(rules.creditScore).toMatchObject({ min: 300, max: 850 });
    expect(rules.employmentStatus.options).toEqual([
      'employed',
      'self_employed',
      'unemployed',
      'retired',
    ]);
  });

  it('takes the eligibility check’s purposes from the personal loan product', () => {
    expect(rules.product.id).toBe('personal_loan');
    expect(rules.purposes).toEqual([
      'debt_consolidation',
      'home_improvement',
      'education',
      'medical',
      'other',
    ]);
    expect(rules.products.map((p) => p.id)).toEqual(['personal_loan', 'vehicle_loan']);
  });

  it('follows the rules it is given, not constants in the code', () => {
    const changed = buildFormRules(
      {
        ...VALIDATION_RULES,
        personalInfo: {
          ...VALIDATION_RULES.personalInfo,
          age: { min: 21, max: 60, required: true, errorMessage: 'Custom' },
        },
      },
      { products: [...PRODUCTS] },
    );
    expect(changed?.age).toEqual({ min: 21, max: 60, message: 'Custom' });
  });

  it('cannot be built without the personal loan product', () => {
    expect(
      buildFormRules(VALIDATION_RULES, {
        products: PRODUCTS.filter((p) => p.id !== 'personal_loan'),
      }),
    ).toBeNull();
  });
});

describe('slider ranges', () => {
  it('come from the amount and term rules', () => {
    const rules = specRules();
    expect(amountSliderRange(rules)).toEqual({ min: 5000, max: 300000, step: 1000 });
    expect(termSliderRange(rules)).toEqual({ min: 6, max: 60, step: 1 });
  });

  it('fall back to the product’s limits when a rule leaves one open', () => {
    const rules = specRules();
    const open = {
      ...rules,
      amount: { ...rules.amount, maxCents: undefined },
      term: { ...rules.term, min: undefined, max: undefined },
    };
    expect(amountSliderRange(open).max).toBe(300000);
    expect(termSliderRange(open)).toEqual({ min: 6, max: 60, step: 1 });
  });
});
