import {
  ELIGIBILITY_PRODUCT_ID,
  type EmploymentStatus,
  type LoanProduct,
  type LoanPurpose,
  type ProductsResponse,
  type ValidationRulesResponse,
} from '../../api/contract';
import { AMOUNT_SLIDER_STEP_RAND } from './model/constants';

/**
 * The form's limits and messages, built from what the API returned, so the screen follows the
 * rules the server states instead of copies of them in the code. Amounts are integer cents.
 */
export interface WholeNumberRule {
  min: number | undefined;
  max: number | undefined;
  message: string;
}

export interface MoneyRule {
  minCents: number;
  maxCents: number | undefined;
  message: string;
}

export interface FormRules {
  age: WholeNumberRule;
  employmentStatus: { options: readonly EmploymentStatus[]; message: string };
  employmentDuration: WholeNumberRule;
  income: MoneyRule;
  expenses: MoneyRule;
  creditScore: WholeNumberRule;
  amount: MoneyRule;
  term: WholeNumberRule;
  /** Purposes of the product the eligibility check is for. */
  purposes: readonly LoanPurpose[];
  /** The product the eligibility check is for, shown to the customer. */
  product: LoanProduct;
  /** Every product the API lists, for the product information. */
  products: readonly LoanProduct[];
}

const cents = (rand: number) => Math.round(rand * 100);

/** Null when the API's answers cannot support the form (no personal-loan product). */
export function buildFormRules(
  rules: ValidationRulesResponse,
  products: ProductsResponse,
): FormRules | null {
  const product = products.products.find((p) => p.id === ELIGIBILITY_PRODUCT_ID);
  if (!product) return null;
  const { personalInfo, financialInfo, loanDetails } = rules;
  const money = (rule: { min?: number; max?: number; errorMessage: string }): MoneyRule => ({
    minCents: cents(rule.min ?? 0),
    maxCents: rule.max === undefined ? undefined : cents(rule.max),
    message: rule.errorMessage,
  });
  const whole = (rule: { min?: number; max?: number; errorMessage: string }): WholeNumberRule => ({
    min: rule.min,
    max: rule.max,
    message: rule.errorMessage,
  });
  return {
    age: whole(personalInfo.age),
    employmentStatus: {
      options: personalInfo.employmentStatus.options,
      message: personalInfo.employmentStatus.errorMessage,
    },
    employmentDuration: whole(personalInfo.employmentDuration),
    income: money(financialInfo.monthlyIncome),
    expenses: money(financialInfo.monthlyExpenses),
    creditScore: whole(financialInfo.creditScore),
    amount: money(loanDetails.requestedAmount),
    term: whole(loanDetails.loanTerm),
    purposes: product.purposes,
    product,
    products: products.products,
  };
}

/** The loan amount slider's range in whole rand, from the amount rule (or the product). */
export function amountSliderRange(rules: FormRules): { min: number; max: number; step: number } {
  return {
    min: Math.ceil(rules.amount.minCents / 100),
    max: Math.floor((rules.amount.maxCents ?? Math.round(rules.product.maxAmount * 100)) / 100),
    step: AMOUNT_SLIDER_STEP_RAND,
  };
}

/** The term slider's range in months, from the term rule (or the product). */
export function termSliderRange(rules: FormRules): { min: number; max: number; step: number } {
  return {
    min: rules.term.min ?? rules.product.minTerm,
    max: rules.term.max ?? rules.product.maxTerm,
    step: 1,
  };
}
