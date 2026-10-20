/**
 * The employer's API contract (docs/requirements/LoanEligibilitySimulatorEndpoints.md):
 * four endpoints with their exact field names and nesting. Money is a decimal number of rand
 * on the wire, as in the specification; the client converts it to integer cents at the edge.
 *
 * The specification gives example responses but no error format, enum lists for every field,
 * or decision rules. Where this file goes beyond it, a comment says so; see
 * docs/requirements/TRACEABILITY.md.
 */

export const API_PATHS = {
  eligibility: '/api/loans/eligibility',
  products: '/api/loans/products',
  calculateRate: '/api/loans/calculate-rate',
  validationRules: '/api/loans/validation-rules',
} as const;

// ---- Shared enumerations ------------------------------------------------------------------

/** From validation-rules `personalInfo.employmentStatus.options`. */
export type EmploymentStatus = 'employed' | 'self_employed' | 'unemployed' | 'retired';

/** From the products' `purposes` lists. */
export type LoanPurpose =
  | 'debt_consolidation'
  | 'home_improvement'
  | 'education'
  | 'medical'
  | 'other'
  | 'new_vehicle'
  | 'used_vehicle';

/** Product ids from GET /api/loans/products; `loanType` in calculate-rate uses the same ids. */
export type LoanType = 'personal_loan' | 'vehicle_loan';

/**
 * The eligibility request has no `loanType` field and its rules are the personal-loan ranges,
 * so the eligibility check is for this product. Vehicle finance appears as product
 * information and through calculate-rate only (docs/requirements/TRACEABILITY.md).
 */
export const ELIGIBILITY_PRODUCT_ID: LoanType = 'personal_loan';

/** The specification shows "low"; the full set is a documented assumption. */
export type RiskCategory = 'low' | 'medium' | 'high';

/** The specification shows "good"; the full set is a documented assumption. */
export type AffordabilityScore = 'excellent' | 'good' | 'fair' | 'poor';

// ---- 1. POST /api/loans/eligibility -------------------------------------------------------

export interface EligibilityRequest {
  personalInfo: {
    age: number;
    employmentStatus: EmploymentStatus;
    /** Months. */
    employmentDuration: number;
  };
  financialInfo: {
    monthlyIncome: number;
    monthlyExpenses: number;
    /** Read as existing monthly debt repayments (see TRACEABILITY.md). */
    existingDebt: number;
    /** Optional (validation-rules marks it `required: false`). */
    creditScore?: number;
  };
  loanDetails: {
    requestedAmount: number;
    /** Months. */
    loanTerm: number;
    loanPurpose: LoanPurpose;
  };
}

export interface EligibilityResponse {
  eligibilityResult: {
    isEligible: boolean;
    /** 0–100, an illustrative figure. */
    approvalLikelihood: number;
    riskCategory: RiskCategory;
    decisionReason: string;
  };
  recommendedLoan: {
    maxAmount: number;
    recommendedAmount: number;
    /** Annual percentage. */
    interestRate: number;
    monthlyPayment: number;
    totalRepayment: number;
  };
  affordabilityAnalysis: {
    disposableIncome: number;
    /** Percentages. */
    debtToIncomeRatio: number;
    loanToIncomeRatio: number;
    affordabilityScore: AffordabilityScore;
  };
}

// ---- 2. GET /api/loans/products -----------------------------------------------------------

export interface LoanProduct {
  id: LoanType;
  name: string;
  description: string;
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  interestRateRange: { min: number; max: number };
  purposes: LoanPurpose[];
}

export interface ProductsResponse {
  products: LoanProduct[];
}

// ---- 3. POST /api/loans/calculate-rate ----------------------------------------------------

export interface CalculateRateRequest {
  loanAmount: number;
  loanTerm: number;
  /** Optional in practice: the example sends it; the rules make credit score optional. */
  creditScore?: number;
  loanType: LoanType;
}

export interface PaymentScheduleRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface CalculateRateResponse {
  interestRate: number;
  monthlyPayment: number;
  totalInterest: number;
  totalRepayment: number;
  /** Every month of the term (the specification shows the first two rows). */
  paymentSchedule: PaymentScheduleRow[];
}

// ---- 4. GET /api/loans/validation-rules ---------------------------------------------------

export interface NumberRule {
  min?: number;
  max?: number;
  required: boolean;
  errorMessage: string;
}

export interface OptionsRule {
  required: boolean;
  options: EmploymentStatus[];
  errorMessage: string;
}

export interface ValidationRulesResponse {
  personalInfo: {
    age: NumberRule;
    employmentStatus: OptionsRule;
    employmentDuration: NumberRule;
  };
  financialInfo: {
    monthlyIncome: NumberRule;
    monthlyExpenses: NumberRule;
    creditScore: NumberRule;
  };
  loanDetails: {
    requestedAmount: NumberRule;
    loanTerm: NumberRule;
  };
}

// ---- Errors (not in the specification; a documented project convention) ------------------

export type ApiErrorCode =
  'VALIDATION_ERROR' | 'UNSUPPORTED_PRODUCT' | 'NOT_FOUND' | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** For VALIDATION_ERROR: one entry per invalid field, by its dotted request path. */
    fields?: { path: string; message: string }[];
  };
}
