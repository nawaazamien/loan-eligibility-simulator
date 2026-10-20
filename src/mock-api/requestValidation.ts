import type {
  CalculateRateRequest,
  EligibilityRequest,
  EmploymentStatus,
  LoanPurpose,
  NumberRule,
} from '../api/contract';
import { MAX_MONEY_RAND } from '../api/assumptions';
import { ELIGIBILITY_PRODUCT_ID, findProduct, VALIDATION_RULES } from './catalogue';

/**
 * Server-side validation for the mock API: the same rules the client shows, so a request
 * that bypassed the form is still rejected. Returns field errors by dotted request path.
 */
export type FieldError = { path: string; message: string };
export type Validated<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A finite number with at most two decimal places (cents). */
function isMoney(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-6 &&
    Number.isSafeInteger(Math.round(value * 100))
  );
}

const isWholeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

function checkNumber(
  errors: FieldError[],
  path: string,
  value: unknown,
  rule: NumberRule,
  kind: 'money' | 'whole',
  ceiling?: number,
): number | undefined {
  if (value === undefined || value === null) {
    if (rule.required) errors.push({ path, message: rule.errorMessage });
    return undefined;
  }
  if (
    typeof value !== 'number' ||
    !(kind === 'money' ? isMoney(value) : isWholeNumber(value)) ||
    (rule.min !== undefined && value < rule.min) ||
    (rule.max !== undefined && value > rule.max)
  ) {
    errors.push({ path, message: rule.errorMessage });
    return undefined;
  }
  if (ceiling !== undefined && value > ceiling) {
    // The specification gives these fields no maximum; the ceiling is a project assumption.
    errors.push({ path, message: `Amount must not be more than R${String(ceiling)}` });
    return undefined;
  }
  return value;
}

export function validateEligibilityRequest(body: unknown): Validated<EligibilityRequest> {
  const errors: FieldError[] = [];
  const root = isRecord(body) ? body : {};
  const personal = isRecord(root.personalInfo) ? root.personalInfo : {};
  const financial = isRecord(root.financialInfo) ? root.financialInfo : {};
  const loan = isRecord(root.loanDetails) ? root.loanDetails : {};
  const rules = VALIDATION_RULES;

  const age = checkNumber(
    errors,
    'personalInfo.age',
    personal.age,
    rules.personalInfo.age,
    'whole',
  );
  const status = personal.employmentStatus;
  if (
    typeof status !== 'string' ||
    !(rules.personalInfo.employmentStatus.options as readonly string[]).includes(status)
  ) {
    errors.push({
      path: 'personalInfo.employmentStatus',
      message: rules.personalInfo.employmentStatus.errorMessage,
    });
  }
  const duration = checkNumber(
    errors,
    'personalInfo.employmentDuration',
    personal.employmentDuration,
    rules.personalInfo.employmentDuration,
    'whole',
  );
  const income = checkNumber(
    errors,
    'financialInfo.monthlyIncome',
    financial.monthlyIncome,
    rules.financialInfo.monthlyIncome,
    'money',
    MAX_MONEY_RAND,
  );
  const expenses = checkNumber(
    errors,
    'financialInfo.monthlyExpenses',
    financial.monthlyExpenses,
    rules.financialInfo.monthlyExpenses,
    'money',
    MAX_MONEY_RAND,
  );
  // The rules list no existingDebt entry; it is required and at least 0 by assumption.
  const debt = checkNumber(
    errors,
    'financialInfo.existingDebt',
    financial.existingDebt,
    { min: 0, required: true, errorMessage: 'Please enter your existing monthly debt repayments' },
    'money',
    MAX_MONEY_RAND,
  );
  const creditScore = checkNumber(
    errors,
    'financialInfo.creditScore',
    financial.creditScore,
    rules.financialInfo.creditScore,
    'whole',
  );
  const amount = checkNumber(
    errors,
    'loanDetails.requestedAmount',
    loan.requestedAmount,
    rules.loanDetails.requestedAmount,
    'money',
  );
  const term = checkNumber(
    errors,
    'loanDetails.loanTerm',
    loan.loanTerm,
    rules.loanDetails.loanTerm,
    'whole',
  );

  // The eligibility request has no loanType: it is a personal-loan check, so only
  // personal-loan purposes are accepted.
  const purposes: readonly string[] = findProduct(ELIGIBILITY_PRODUCT_ID)?.purposes ?? [];
  const purpose = loan.loanPurpose;
  if (typeof purpose !== 'string' || !purposes.includes(purpose)) {
    errors.push({
      path: 'loanDetails.loanPurpose',
      message: 'Please select a personal-loan purpose',
    });
  }

  if (
    errors.length > 0 ||
    age === undefined ||
    duration === undefined ||
    income === undefined ||
    expenses === undefined ||
    debt === undefined ||
    amount === undefined ||
    term === undefined
  ) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      personalInfo: {
        age,
        employmentStatus: status as EmploymentStatus,
        employmentDuration: duration,
      },
      financialInfo: {
        monthlyIncome: income,
        monthlyExpenses: expenses,
        existingDebt: debt,
        ...(creditScore === undefined ? {} : { creditScore }),
      },
      loanDetails: { requestedAmount: amount, loanTerm: term, loanPurpose: purpose as LoanPurpose },
    },
  };
}

/** calculate-rate is checked against the requested product's own limits. */
export function validateRateRequest(
  body: unknown,
): Validated<CalculateRateRequest> | { ok: false; unsupported: true } {
  const root = isRecord(body) ? body : {};
  const product = typeof root.loanType === 'string' ? findProduct(root.loanType) : undefined;
  if (!product) return { ok: false, unsupported: true };

  const errors: FieldError[] = [];
  const amount = checkNumber(
    errors,
    'loanAmount',
    root.loanAmount,
    {
      min: product.minAmount,
      max: product.maxAmount,
      required: true,
      errorMessage: `Loan amount must be between R${String(product.minAmount)} and R${String(product.maxAmount)} for ${product.name}`,
    },
    'money',
  );
  const term = checkNumber(
    errors,
    'loanTerm',
    root.loanTerm,
    {
      min: product.minTerm,
      max: product.maxTerm,
      required: true,
      errorMessage: `Loan term must be between ${String(product.minTerm)} and ${String(product.maxTerm)} months for ${product.name}`,
    },
    'whole',
  );
  const creditScore = checkNumber(
    errors,
    'creditScore',
    root.creditScore,
    VALIDATION_RULES.financialInfo.creditScore,
    'whole',
  );
  if (errors.length > 0 || amount === undefined || term === undefined) return { ok: false, errors };
  return {
    ok: true,
    value: {
      loanAmount: amount,
      loanTerm: term,
      loanType: product.id,
      ...(creditScore === undefined ? {} : { creditScore }),
    },
  };
}
