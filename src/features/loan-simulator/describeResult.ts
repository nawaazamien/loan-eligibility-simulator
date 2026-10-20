import type { AffordabilityScore, EligibilityResponse, RiskCategory } from '../../api/contract';
import type { CalculatedResult } from './formState';
import { formatCents, formatPercent } from './model/format';

/**
 * Customer-facing wording for one calculation. Everything here is formatting of what the API
 * returned for that submission; it contains no lending maths. All wording is estimate language:
 * these are simulated figures, never an approval, a decision or a prediction.
 */

/** From the design: stays beside the outcome. */
export const OUTCOME_NOTE =
  'An illustration based on fictional assumptions — not a credit decision.';
export const STALE_NOTE = 'Previous estimate — recalculate to update.';
export const LIKELIHOOD_DISCLAIMER =
  'Approval likelihood, risk and recommendations are simulated estimates for this demo, not a real approval or prediction.';

export const RISK_LABELS: Readonly<Record<RiskCategory, string>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const AFFORDABILITY_LABELS: Readonly<Record<AffordabilityScore, string>> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

/** A rand amount from the API (decimal rand), with cents only when they are not zero. */
export function money(rand: number): string {
  const cents = Math.round(rand * 100);
  return formatCents(cents, { withCents: cents % 100 !== 0 });
}

/** A payment or schedule figure: always to the cent. */
export function moneyExact(rand: number): string {
  return formatCents(Math.round(rand * 100), { withCents: true });
}

export type OutcomeKind = 'full' | 'reduced' | 'none';

export function outcomeKind(eligibility: EligibilityResponse, requested: number): OutcomeKind {
  const { isEligible } = eligibility.eligibilityResult;
  const { recommendedAmount } = eligibility.recommendedLoan;
  if (!isEligible || recommendedAmount <= 0) return 'none';
  return recommendedAmount < requested ? 'reduced' : 'full';
}

export const OUTCOME_TITLES: Readonly<Record<OutcomeKind, string>> = {
  full: 'Estimated eligible for the amount requested',
  reduced: 'Estimated eligible for a smaller amount',
  none: 'Estimated not eligible for this loan',
};

export interface ResultSummary {
  readonly kind: OutcomeKind;
  readonly title: string;
  readonly reason: string;
  readonly likelihood: string;
  readonly risk: string;
  /** The headline monthly payment, or null when no amount is recommended. */
  readonly payment: string | null;
  readonly rows: readonly { readonly term: string; readonly value: string }[];
  readonly announcement: string;
}

export function describeResult(result: CalculatedResult): ResultSummary {
  const { eligibility, request } = result;
  const requested = request.loanDetails.requestedAmount;
  const { recommendedLoan: loan, eligibilityResult } = eligibility;
  const kind = outcomeKind(eligibility, requested);
  const payment = kind === 'none' ? null : moneyExact(loan.monthlyPayment);

  const rows: { term: string; value: string }[] = [
    { term: 'Requested amount', value: money(requested) },
    { term: 'Recommended amount', value: kind === 'none' ? 'None' : money(loan.recommendedAmount) },
    { term: 'Maximum amount', value: loan.maxAmount > 0 ? money(loan.maxAmount) : 'None' },
    { term: 'Interest rate', value: `${formatPercent(loan.interestRate)} a year` },
    { term: 'Repayment term', value: `${String(request.loanDetails.loanTerm)} months` },
  ];
  if (kind !== 'none') {
    rows.push(
      { term: 'Monthly payment', value: moneyExact(loan.monthlyPayment) },
      { term: 'Total repayment', value: moneyExact(loan.totalRepayment) },
    );
  }

  const announcement =
    kind === 'none'
      ? `Estimate updated. ${OUTCOME_TITLES[kind]}. Illustrative approval likelihood ${String(eligibilityResult.approvalLikelihood)} percent.`
      : `Estimate updated. ${OUTCOME_TITLES[kind]}. Estimated monthly payment ${payment ?? ''}.`;

  return {
    kind,
    title: OUTCOME_TITLES[kind],
    reason: eligibilityResult.decisionReason,
    likelihood: `${String(eligibilityResult.approvalLikelihood)}%`,
    risk: RISK_LABELS[eligibilityResult.riskCategory],
    payment,
    rows,
    announcement,
  };
}
