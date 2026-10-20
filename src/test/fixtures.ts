import type { FieldValues } from '../features/loan-simulator/model/fields';
import { buildFormRules, type FormRules } from '../features/loan-simulator/rules';
import { PRODUCTS, VALIDATION_RULES } from '../mock-api/catalogue';

/** The form rules exactly as the employer's specification states them. */
export function specRules(): FormRules {
  const rules = buildFormRules(VALIDATION_RULES, { products: [...PRODUCTS] });
  if (!rules) throw new Error('The specification lists no personal loan product');
  return rules;
}

/** A complete, valid set of form values (the example applicant), overridable per test. */
export function validValues(over: Partial<FieldValues> = {}): FieldValues {
  return {
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
    ...over,
  };
}
