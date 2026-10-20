import type { LoanProduct, ValidationRulesResponse } from '../api/contract';

export { ELIGIBILITY_PRODUCT_ID } from '../api/contract';

/**
 * The mock API's data, exactly as the employer's specification shows it
 * (docs/requirements/LoanEligibilitySimulatorEndpoints.md §2 and §4).
 */

export const PRODUCTS: readonly LoanProduct[] = [
  {
    id: 'personal_loan',
    name: 'Personal Loan',
    description: 'Flexible personal financing for various needs',
    minAmount: 5000.0,
    maxAmount: 300000.0,
    minTerm: 6,
    maxTerm: 60,
    interestRateRange: { min: 10.5, max: 18.5 },
    purposes: ['debt_consolidation', 'home_improvement', 'education', 'medical', 'other'],
  },
  {
    id: 'vehicle_loan',
    name: 'Vehicle Finance',
    description: 'Financing for new and used vehicles',
    minAmount: 50000.0,
    maxAmount: 1500000.0,
    minTerm: 12,
    maxTerm: 72,
    interestRateRange: { min: 8.5, max: 15.0 },
    purposes: ['new_vehicle', 'used_vehicle'],
  },
];

export const VALIDATION_RULES: ValidationRulesResponse = {
  personalInfo: {
    age: { min: 18, max: 65, required: true, errorMessage: 'Age must be between 18 and 65' },
    employmentStatus: {
      required: true,
      options: ['employed', 'self_employed', 'unemployed', 'retired'],
      errorMessage: 'Please select your employment status',
    },
    employmentDuration: {
      min: 3,
      required: true,
      errorMessage: 'Minimum 3 months employment required',
    },
  },
  financialInfo: {
    monthlyIncome: {
      min: 5000.0,
      required: true,
      errorMessage: 'Minimum monthly income of R5,000 required',
    },
    monthlyExpenses: { min: 0, required: true, errorMessage: 'Please enter your monthly expenses' },
    creditScore: {
      min: 300,
      max: 850,
      required: false,
      errorMessage: 'Credit score must be between 300 and 850',
    },
  },
  loanDetails: {
    requestedAmount: {
      min: 5000.0,
      max: 300000.0,
      required: true,
      errorMessage: 'Loan amount must be between R5,000 and R300,000',
    },
    loanTerm: {
      min: 6,
      max: 60,
      required: true,
      errorMessage: 'Loan term must be between 6 and 60 months',
    },
  },
};

export function findProduct(id: string): LoanProduct | undefined {
  return PRODUCTS.find((product) => product.id === id);
}
