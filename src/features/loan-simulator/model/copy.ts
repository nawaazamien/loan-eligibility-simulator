import { percentOf, type Estimate, type Outcome } from './calculate';
import { AFFORDABILITY_PERCENT, LONGEST_TERM } from './constants';
import { formatCents } from './format';

/**
 * Customer-facing wording for an estimate, built from one Estimate so that every figure
 * on screen comes from the same calculation. Templates are verbatim from the design
 * (HANDOFF §5) unless DECISIONS.md says otherwise. Estimate language only.
 */

export const OUTCOME_TITLES: Record<Outcome, string> = {
  within: 'Within the demo affordability limit',
  above: 'Above the demo affordability limit',
  none: 'No room for an additional repayment',
};

export const OUTCOME_NOTE =
  'An illustration based on fictional assumptions — not a credit decision.';
export const STALE_NOTE = 'Previous estimate — recalculate to update.';

const R = (cents: number) => formatCents(cents);
const RC = (cents: number) => formatCents(cents, { withCents: true });

export interface BreakdownSegment {
  readonly key: 'expenses' | 'debt' | 'repayment' | 'leftOver';
  readonly label: string;
  readonly value: string;
  /** Share of the bar, 0–100. Never negative. */
  readonly percent: number;
}

export interface Tip {
  readonly title: string;
  readonly text: string;
}

export interface EstimateCopy {
  readonly title: string;
  readonly repayment: string;
  readonly explanation: string;
  readonly summary: readonly { readonly term: string; readonly value: string }[];
  /** Absent for "none": there is no budget left to divide. */
  readonly breakdown: {
    readonly heading: string;
    readonly segments: readonly BreakdownSegment[];
    readonly shortfall: string | null;
  } | null;
  readonly tips: readonly Tip[];
  readonly announcement: string;
}

/**
 * How far above the limit, as a figure. Whole rand as in the design, except that a gap
 * under R1 is shown in cents: "R0 a month above it" would contradict the outcome (D-028).
 */
function aboveBy(cents: number): string {
  return cents < 100 ? RC(cents) : R(cents);
}

function explanation(e: Estimate): string {
  if (e.outcome === 'none') {
    const relation = e.availableCents < 0 ? `are ${R(-e.availableCents)} more than` : 'use all of';
    return `Your expenses and existing debt repayments (${R(e.committedCents)}) ${relation} your take-home income, so this demo can't fit an additional repayment.`;
  }
  const share = `Your estimated repayment of ${R(e.repaymentCents)} would use ${String(percentOf(e.repaymentCents, e.availableCents))}% of the ${R(e.availableCents)} you have left each month after expenses and existing debt.`;
  const limit = `${String(AFFORDABILITY_PERCENT)}% (${R(e.limitCents)})`;
  return e.outcome === 'within'
    ? `${share} That's within the demo limit of ${limit}.`
    : `${share} The demo limit is ${limit}, so this estimate is ${aboveBy(e.repaymentCents - e.limitCents)} a month above it.`;
}

function breakdown(e: Estimate): EstimateCopy['breakdown'] {
  if (e.outcome === 'none') return null;
  const { incomeCents, expensesCents, debtCents } = e.inputs;
  // The bar's 100% is income, or everything owed if that is larger, so it never overflows.
  const base = Math.max(incomeCents, e.committedCents + e.repaymentCents);
  const share = (cents: number) => (Math.max(0, cents) / base) * 100;
  const segments: BreakdownSegment[] = [
    {
      key: 'expenses',
      label: 'Living expenses',
      value: R(expensesCents),
      percent: share(expensesCents),
    },
    { key: 'debt', label: 'Existing debt', value: R(debtCents), percent: share(debtCents) },
    {
      key: 'repayment',
      label: 'New repayment',
      value: R(e.repaymentCents),
      percent: share(e.repaymentCents),
    },
  ];
  if (e.remainingCents > 0) {
    segments.push({
      key: 'leftOver',
      label: 'Left over',
      value: R(e.remainingCents),
      percent: share(e.remainingCents),
    });
  }
  return {
    heading: `Where your ${R(incomeCents)} goes each month`,
    segments,
    shortfall:
      e.remainingCents < 0
        ? `Your commitments and the new repayment would be ${R(-e.remainingCents)} more than your income.`
        : null,
  };
}

const REVIEW_COMMITMENTS: Tip = {
  title: 'Review your commitments',
  text: 'Lowering regular expenses or paying down existing debt increases the money you have left each month.',
};

function tips(e: Estimate): Tip[] {
  if (e.outcome === 'none') {
    return [
      {
        title: 'Check your figures',
        text: "Make sure income is your take-home amount and expenses don't also include debt repayments.",
      },
      REVIEW_COMMITMENTS,
    ];
  }
  if (e.outcome === 'within') return [];
  const list: Tip[] = [];
  if (e.maxLoanCents !== null) {
    list.push({
      title: 'Borrow less',
      text: `Over ${String(e.inputs.term)} months, about ${R(e.maxLoanCents)} or less would keep the estimate within the demo limit.`,
    });
  }
  if (e.longestTerm) {
    const status = e.longestTerm.outcome === 'within' ? 'within' : 'still above';
    list.push({
      title: 'Choose a longer term',
      text: `Over ${String(LONGEST_TERM)} months the estimate is ${RC(e.longestTerm.repaymentCents)} a month, ${status} the demo limit. You'd pay more interest overall.`,
    });
  }
  list.push(REVIEW_COMMITMENTS);
  return list;
}

export function describeEstimate(e: Estimate): EstimateCopy {
  return {
    title: OUTCOME_TITLES[e.outcome],
    repayment: RC(e.repaymentCents),
    explanation: explanation(e),
    summary: [
      { term: 'Loan amount', value: R(e.inputs.loanCents) },
      { term: 'Repayment term', value: `${String(e.inputs.term)} months` },
      { term: 'Left after all repayments', value: `${R(e.remainingCents)} a month` },
      { term: 'Total repayable', value: R(e.totalRepayableCents) },
    ],
    breakdown: breakdown(e),
    tips: tips(e),
    announcement: `Estimate updated. ${OUTCOME_TITLES[e.outcome]}. Estimated monthly repayment ${RC(e.repaymentCents)}.`,
  };
}
