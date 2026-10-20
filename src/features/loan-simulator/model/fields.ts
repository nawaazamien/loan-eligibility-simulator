import type { EmploymentStatus, LoanPurpose } from '../../../api/contract';

/** Every input on the form, in the order it appears. */
export const FIELDS = [
  'age',
  'employmentStatus',
  'employmentDuration',
  'income',
  'expenses',
  'debt',
  'creditScore',
  'purpose',
  'amount',
  'term',
] as const;

export type Field = (typeof FIELDS)[number];

/** Raw text exactly as typed or chosen; an empty string is a valid, distinct state. */
export type FieldValues = Readonly<Record<Field, string>>;
export type FieldErrors = Partial<Record<Field, string>>;

/** Which request field each form field becomes (dotted path in the eligibility request). */
export const REQUEST_PATHS: Readonly<Record<Field, string>> = {
  age: 'personalInfo.age',
  employmentStatus: 'personalInfo.employmentStatus',
  employmentDuration: 'personalInfo.employmentDuration',
  income: 'financialInfo.monthlyIncome',
  expenses: 'financialInfo.monthlyExpenses',
  debt: 'financialInfo.existingDebt',
  creditScore: 'financialInfo.creditScore',
  purpose: 'loanDetails.loanPurpose',
  amount: 'loanDetails.requestedAmount',
  term: 'loanDetails.loanTerm',
};

/** Customer-facing wording for the contract's enumerations (the ids stay as the API sends them). */
export const EMPLOYMENT_LABELS: Readonly<Record<EmploymentStatus, string>> = {
  employed: 'Employed',
  self_employed: 'Self-employed',
  unemployed: 'Unemployed',
  retired: 'Retired',
};

export const PURPOSE_LABELS: Readonly<Record<LoanPurpose, string>> = {
  debt_consolidation: 'Debt consolidation',
  home_improvement: 'Home improvement',
  education: 'Education',
  medical: 'Medical',
  other: 'Other',
  new_vehicle: 'New vehicle',
  used_vehicle: 'Used vehicle',
};
