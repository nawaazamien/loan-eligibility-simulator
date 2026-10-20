import type {
  AffordabilityScore,
  EligibilityRequest,
  EligibilityResponse,
  LoanProduct,
  RiskCategory,
} from '../api/contract';
import { annualRateBasisPoints, buildSchedule, centsToRand, randToCents } from './pricing';

/**
 * The mock eligibility decision. The specification defines the response fields but not how
 * they are decided, so every rule below is a fictional, deterministic assumption, documented
 * in docs/SIMULATION_MODEL.md. None of it is a lender's policy or a credit decision.
 *
 * Amounts are integer cents. `existingDebt` is read as existing monthly debt repayments: the
 * specification's example debt-to-income ratio (5 000 ÷ 25 000 = 20%) is consistent with that.
 */

/** The new repayment may use up to 40% of what is left after expenses and existing debt. */
const SHARE = { numerator: 2, denominator: 5 } as const;
const AMOUNT_STEP_CENTS = 100_000; // R1 000

/** Whether a repayment fits: 5 × payment ≤ 2 × available, exactly, in integers. */
function fits(paymentCents: number, availableCents: number): boolean {
  return availableCents > 0 && SHARE.denominator * paymentCents <= SHARE.numerator * availableCents;
}

/** Percentage rounded half-up to one decimal place, from integer cents. */
function percent(part: number, whole: number): number {
  return Math.floor((1000 * part) / whole + 0.5) / 10;
}

function affordabilityScore(paymentCents: number, availableCents: number): AffordabilityScore {
  if (availableCents <= 0) return 'poor';
  if (5 * paymentCents <= availableCents) return 'excellent'; // ≤ 20% of what is left
  if (10 * paymentCents <= 3 * availableCents) return 'good'; // ≤ 30%
  if (fits(paymentCents, availableCents)) return 'fair'; // ≤ 40%, the limit
  return 'poor';
}

function creditPoints(score: number | undefined): number {
  if (score === undefined) return 0;
  if (score >= 750) return 25;
  if (score >= 700) return 20;
  if (score >= 650) return 15;
  if (score >= 600) return 5;
  if (score >= 550) return -5;
  return -15;
}

const AFFORDABILITY_POINTS: Record<AffordabilityScore, number> = {
  excellent: 20,
  good: 15,
  fair: 10,
  poor: -20,
};

function riskFor(likelihood: number): RiskCategory {
  if (likelihood >= 75) return 'low';
  if (likelihood >= 50) return 'medium';
  return 'high';
}

const formatRand = (cents: number) =>
  `R${String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;

export function assessEligibility(
  request: EligibilityRequest,
  product: LoanProduct,
): EligibilityResponse {
  const { personalInfo, financialInfo, loanDetails } = request;
  const income = randToCents(financialInfo.monthlyIncome);
  const expenses = randToCents(financialInfo.monthlyExpenses);
  const debt = randToCents(financialInfo.existingDebt);
  const requested = randToCents(loanDetails.requestedAmount);
  const term = loanDetails.loanTerm;
  const rateBp = annualRateBasisPoints(product, financialInfo.creditScore);
  const paymentFor = (cents: number) => buildSchedule(cents, term, rateBp).levelPayment;

  const disposable = income - expenses;
  const available = disposable - debt;
  const requestedPayment = paymentFor(requested);

  // The largest R1 000 step, within the product's range, whose repayment fits.
  let maxAmount = 0;
  const minCents = randToCents(product.minAmount);
  for (let cents = randToCents(product.maxAmount); cents >= minCents; cents -= AMOUNT_STEP_CENTS) {
    if (fits(paymentFor(cents), available)) {
      maxAmount = cents;
      break;
    }
  }

  const unemployed = personalInfo.employmentStatus === 'unemployed';
  let isEligible = !unemployed && available > 0 && maxAmount > 0;
  let decisionReason: string;
  if (unemployed) {
    decisionReason =
      'This demo needs an income from employment, self-employment or a pension, so it does not assess unemployed applicants.';
  } else if (available <= 0) {
    decisionReason =
      'Expenses and existing debt repayments use all of the monthly income, so no new repayment fits.';
  } else if (maxAmount === 0) {
    decisionReason = `Even the smallest loan of ${formatRand(minCents)} over ${String(term)} months would cost more than 40% of what is left each month.`;
  } else if (requested <= maxAmount) {
    decisionReason =
      'The estimated repayment fits within 40% of what is left each month after expenses and existing debt.';
  } else {
    decisionReason = `The requested amount would cost more than 40% of what is left each month; up to ${formatRand(maxAmount)} over ${String(term)} months would fit.`;
  }
  if (!isEligible) maxAmount = 0;
  isEligible = isEligible && maxAmount > 0;

  const score = affordabilityScore(requestedPayment, available);
  const employmentPoints = unemployed
    ? -30
    : (personalInfo.employmentStatus === 'employed' ||
          personalInfo.employmentStatus === 'self_employed') &&
        personalInfo.employmentDuration >= 12
      ? 5
      : 0;
  let likelihood =
    50 + creditPoints(financialInfo.creditScore) + AFFORDABILITY_POINTS[score] + employmentPoints;
  likelihood = Math.min(95, Math.max(5, likelihood));
  if (!isEligible) likelihood = Math.min(likelihood, 15);

  const recommended = isEligible ? Math.min(requested, maxAmount) : 0;
  const recommendedSchedule = recommended > 0 ? buildSchedule(recommended, term, rateBp) : null;

  return {
    eligibilityResult: {
      isEligible,
      approvalLikelihood: likelihood,
      riskCategory: riskFor(likelihood),
      decisionReason,
    },
    recommendedLoan: {
      maxAmount: centsToRand(maxAmount),
      recommendedAmount: centsToRand(recommended),
      interestRate: rateBp / 100,
      monthlyPayment: centsToRand(recommendedSchedule?.levelPayment ?? 0),
      totalRepayment: centsToRand(recommendedSchedule?.totalRepayment ?? 0),
    },
    affordabilityAnalysis: {
      disposableIncome: centsToRand(disposable),
      debtToIncomeRatio: percent(debt, income),
      // Requested amount ÷ annual income (12 × monthly income); the specification gives no formula.
      loanToIncomeRatio: percent(requested, 12 * income),
      affordabilityScore: score,
    },
  };
}
