import {
  calculateEstimate,
  instalmentCents,
  outcomeFor,
  percentOf,
  repaymentCents,
  roundHalfUp,
  type Outcome,
} from './calculate';
import { MONTHLY_FEE_CENTS, TERMS, type Term } from './constants';
import type { SimulationInputs } from './validate';

const rand = (value: number) => Math.round(value * 100);

function inputs(
  income: number,
  expenses: number,
  debt: number,
  loan: number,
  term: Term,
): SimulationInputs {
  return {
    incomeCents: rand(income),
    expensesCents: rand(expenses),
    debtCents: rand(debt),
    loanCents: rand(loan),
    term,
  };
}

/**
 * docs/SIMULATION_MODEL.md §6, independently re-derived with 50-digit decimal arithmetic
 * (Python `decimal`) before this implementation existed. Values in rand.
 */
const REFERENCE_CASES: readonly {
  case: number;
  in: [number, number, number, number, Term];
  available: number;
  instalment: number;
  repayment: number;
  limit: number;
  outcome: Outcome;
  remaining: number;
  total: number;
}[] = [
  {
    case: 1,
    in: [28_500, 14_200, 3_150, 60_000, 48],
    available: 11_150,
    instalment: 1_809.88,
    repayment: 1_878.88,
    limit: 4_460,
    outcome: 'within',
    remaining: 9_271.12,
    total: 90_186.24,
  },
  {
    case: 2,
    in: [18_000, 11_500, 2_400, 120_000, 36],
    available: 4_100,
    instalment: 4_429.12,
    repayment: 4_498.12,
    limit: 1_640,
    outcome: 'above',
    remaining: -398.12,
    total: 161_932.32,
  },
  {
    case: 3,
    in: [12_000, 9_800, 2_600, 20_000, 24],
    available: -400,
    instalment: 1_013.04,
    repayment: 1_082.04,
    limit: 0,
    outcome: 'none',
    remaining: -1_482.04,
    total: 25_968.96,
  },
  {
    case: 4,
    in: [12_000, 9_000, 3_000, 20_000, 24],
    available: 0,
    instalment: 1_013.04,
    repayment: 1_082.04,
    limit: 0,
    outcome: 'none',
    remaining: -1_082.04,
    total: 25_968.96,
  },
  {
    case: 5,
    in: [2_705.1, 0, 0, 20_000, 24],
    available: 2_705.1,
    instalment: 1_013.04,
    repayment: 1_082.04,
    limit: 1_082.04,
    outcome: 'within',
    remaining: 1_623.06,
    total: 25_968.96,
  },
  {
    case: 6,
    in: [2_705.09, 0, 0, 20_000, 24],
    available: 2_705.09,
    instalment: 1_013.04,
    repayment: 1_082.04,
    limit: 1_082.03,
    outcome: 'above',
    remaining: 1_623.05,
    total: 25_968.96,
  },
  {
    case: 7,
    in: [1_000, 0, 0, 1_000, 12],
    available: 1_000,
    instalment: 92.4,
    repayment: 161.4,
    limit: 400,
    outcome: 'within',
    remaining: 838.6,
    total: 1_936.8,
  },
  {
    case: 8,
    in: [1_000_000, 0, 0, 250_000, 60],
    available: 1_000_000,
    instalment: 6_554.11,
    repayment: 6_623.11,
    limit: 400_000,
    outcome: 'within',
    remaining: 993_376.89,
    total: 397_386.6,
  },
];

describe('calculateEstimate: reference cases', () => {
  it.each(REFERENCE_CASES)('case $case', (expected) => {
    const estimate = calculateEstimate(inputs(...expected.in));
    expect({
      available: estimate.availableCents,
      instalment: estimate.instalmentCents,
      repayment: estimate.repaymentCents,
      limit: estimate.limitCents,
      outcome: estimate.outcome,
      remaining: estimate.remainingCents,
      total: estimate.totalRepayableCents,
    }).toEqual({
      available: rand(expected.available),
      instalment: rand(expected.instalment),
      repayment: rand(expected.repayment),
      limit: rand(expected.limit),
      outcome: expected.outcome,
      remaining: rand(expected.remaining),
      total: rand(expected.total),
    });
  });

  it('derives the case 2 suggestions from the same rule', () => {
    const estimate = calculateEstimate(inputs(18_000, 11_500, 2_400, 120_000, 36));
    expect(estimate.maxLoanCents).toBe(rand(42_000));
    expect(repaymentCents(rand(42_000), 36)).toBe(rand(1_619.19));
    expect(repaymentCents(rand(43_000), 36)).toBe(rand(1_656.1));
    expect(estimate.longestTerm).toEqual({ repaymentCents: rand(3_214.97), outcome: 'above' });
  });

  it('only suggests alternatives for an estimate above the limit', () => {
    for (const reference of REFERENCE_CASES.filter((c) => c.outcome !== 'above')) {
      const estimate = calculateEstimate(inputs(...reference.in));
      expect(estimate.maxLoanCents).toBeNull();
      expect(estimate.longestTerm).toBeNull();
    }
  });

  it('offers no longer term when the term is already 60 months', () => {
    const estimate = calculateEstimate(inputs(5_000, 0, 0, 250_000, 60));
    expect(estimate.outcome).toBe('above');
    expect(estimate.longestTerm).toBeNull();
  });

  it('offers no smaller loan when even R1 000 is above the limit', () => {
    // R100 available: the R69 fee alone is more than 40% of it.
    const estimate = calculateEstimate(inputs(1_000, 900, 0, 1_000, 60));
    expect(estimate.outcome).toBe('above');
    expect(estimate.maxLoanCents).toBeNull();
  });
});

describe('affordability rule', () => {
  it('is within at exactly 40% and above one cent beyond it', () => {
    // 2 × 270 510 = 5 × 108 204: repayment R1 082.04 is exactly 40% of R2 705.10.
    expect(outcomeFor(108_204, 270_510)).toBe('within');
    expect(outcomeFor(108_204, 270_509)).toBe('above');
    expect(outcomeFor(108_204, 270_511)).toBe('within');
    expect(outcomeFor(108_205, 270_510)).toBe('above');
    expect(outcomeFor(108_203, 270_510)).toBe('within');
  });

  it('finds no room when nothing, or less than nothing, is available', () => {
    expect(outcomeFor(16_140, 0)).toBe('none');
    expect(outcomeFor(16_140, -1)).toBe('none');
    expect(outcomeFor(0, 0)).toBe('none');
  });

  it('never suggests a loan that the rule would put above the limit', () => {
    for (const term of TERMS) {
      for (const available of [5_000, 120_000, 410_000, 999_999, 3_000_000]) {
        const estimate = calculateEstimate({
          incomeCents: available,
          expensesCents: 0,
          debtCents: 0,
          loanCents: 25_000_000,
          term,
        });
        if (estimate.maxLoanCents === null) continue;
        expect(outcomeFor(repaymentCents(estimate.maxLoanCents, term), available)).toBe('within');
        if (estimate.maxLoanCents < 25_000_000) {
          const next = estimate.maxLoanCents + 100_000;
          expect(outcomeFor(repaymentCents(next, term), available)).toBe('above');
        }
      }
    }
  });
});

describe('repayment', () => {
  it('always includes the R69 monthly fee on top of the instalment', () => {
    for (const term of TERMS) {
      expect(repaymentCents(rand(60_000), term) - instalmentCents(rand(60_000), term)).toBe(
        MONTHLY_FEE_CENTS,
      );
    }
  });

  it('defines the zero-interest case as principal divided by months', () => {
    expect(instalmentCents(rand(12_000), 12, 0)).toBe(rand(1_000));
    expect(instalmentCents(100, 3, 0)).toBe(33);
    expect(instalmentCents(200, 3, 0)).toBe(67);
  });

  it('returns whole cents for every supported term at the loan limits', () => {
    for (const term of TERMS) {
      for (const loan of [1_000, 250_000]) {
        expect(Number.isInteger(repaymentCents(rand(loan), term))).toBe(true);
      }
    }
  });

  it('falls as the term lengthens and rises with the loan amount', () => {
    const byTerm = TERMS.map((term) => repaymentCents(rand(100_000), term));
    expect(byTerm).toEqual([...byTerm].sort((a, b) => b - a));
    expect(repaymentCents(rand(100_001), 36)).toBeGreaterThan(repaymentCents(rand(100_000), 36));
  });

  it('costs more in total over a longer term', () => {
    const totals = TERMS.map((term) => repaymentCents(rand(100_000), term) * term);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  it('rounds half-up exactly once', () => {
    expect(roundHalfUp(10.5)).toBe(11);
    expect(roundHalfUp(10.49)).toBe(10);
    expect(roundHalfUp(0)).toBe(0);
  });
});

describe('percentOf', () => {
  it('rounds half-up for display', () => {
    expect(percentOf(187_888, 1_115_000)).toBe(17);
    expect(percentOf(449_812, 410_000)).toBe(110);
    expect(percentOf(1, 200)).toBe(1);
    expect(percentOf(1, 201)).toBe(0);
  });
});
