import type {
  ApiErrorBody,
  CalculateRateResponse,
  EligibilityResponse,
  ProductsResponse,
  ValidationRulesResponse,
} from './contract';

/**
 * Runtime checks that a response has the shape the contract promises. They keep the typed
 * client honest when the server is a real API rather than the mock: an unexpected body is
 * reported as an invalid response instead of crashing the screen later.
 */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string';

function hasNumbers(o: unknown, keys: string[]): boolean {
  return isRecord(o) && keys.every((key) => num(o[key]));
}

export function isEligibilityResponse(v: unknown): v is EligibilityResponse {
  if (!isRecord(v)) return false;
  const { eligibilityResult: result, recommendedLoan, affordabilityAnalysis: analysis } = v;
  return (
    isRecord(result) &&
    typeof result.isEligible === 'boolean' &&
    num(result.approvalLikelihood) &&
    str(result.riskCategory) &&
    str(result.decisionReason) &&
    hasNumbers(recommendedLoan, [
      'maxAmount',
      'recommendedAmount',
      'interestRate',
      'monthlyPayment',
      'totalRepayment',
    ]) &&
    hasNumbers(analysis, ['disposableIncome', 'debtToIncomeRatio', 'loanToIncomeRatio']) &&
    isRecord(analysis) &&
    str(analysis.affordabilityScore)
  );
}

export function isProductsResponse(v: unknown): v is ProductsResponse {
  return (
    isRecord(v) &&
    Array.isArray(v.products) &&
    v.products.every(
      (p: unknown) =>
        isRecord(p) &&
        str(p.id) &&
        str(p.name) &&
        str(p.description) &&
        hasNumbers(p, ['minAmount', 'maxAmount', 'minTerm', 'maxTerm']) &&
        hasNumbers(p.interestRateRange, ['min', 'max']) &&
        Array.isArray(p.purposes) &&
        p.purposes.every(str),
    )
  );
}

export function isCalculateRateResponse(v: unknown): v is CalculateRateResponse {
  return (
    hasNumbers(v, ['interestRate', 'monthlyPayment', 'totalInterest', 'totalRepayment']) &&
    isRecord(v) &&
    Array.isArray(v.paymentSchedule) &&
    v.paymentSchedule.every((row: unknown) =>
      hasNumbers(row, ['month', 'payment', 'principal', 'interest', 'balance']),
    )
  );
}

function isNumberRule(v: unknown): boolean {
  return (
    isRecord(v) &&
    typeof v.required === 'boolean' &&
    str(v.errorMessage) &&
    (v.min === undefined || num(v.min)) &&
    (v.max === undefined || num(v.max))
  );
}

export function isValidationRulesResponse(v: unknown): v is ValidationRulesResponse {
  if (!isRecord(v)) return false;
  const { personalInfo: p, financialInfo: f, loanDetails: l } = v;
  if (!isRecord(p) || !isRecord(f) || !isRecord(l)) return false;
  const status = p.employmentStatus;
  return (
    isNumberRule(p.age) &&
    isRecord(status) &&
    typeof status.required === 'boolean' &&
    str(status.errorMessage) &&
    Array.isArray(status.options) &&
    status.options.every(str) &&
    isNumberRule(p.employmentDuration) &&
    isNumberRule(f.monthlyIncome) &&
    isNumberRule(f.monthlyExpenses) &&
    isNumberRule(f.creditScore) &&
    isNumberRule(l.requestedAmount) &&
    isNumberRule(l.loanTerm)
  );
}

export function isApiErrorBody(v: unknown): v is ApiErrorBody {
  return isRecord(v) && isRecord(v.error) && str(v.error.code) && str(v.error.message);
}
