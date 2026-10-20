import type { EligibilityRequest } from '../api/contract';
import { findProduct } from './catalogue';
import { assessEligibility } from './eligibility';

/**
 * Scenarios S1–S7 and the boundary case are cross-checked against
 * docs/validation/phase-6/verify_reference.py (decimal arithmetic, separate code).
 */
const product = findProduct('personal_loan');
if (!product) throw new Error('Expected the personal loan product');

function request(over: {
  status?: EligibilityRequest['personalInfo']['employmentStatus'];
  duration?: number;
  income: number;
  expenses: number;
  debt: number;
  score?: number | undefined;
  amount: number;
  term: number;
}): EligibilityRequest {
  return {
    personalInfo: {
      age: 35,
      employmentStatus: over.status ?? 'employed',
      employmentDuration: over.duration ?? 24,
    },
    financialInfo: {
      monthlyIncome: over.income,
      monthlyExpenses: over.expenses,
      existingDebt: over.debt,
      ...(over.score === undefined ? {} : { creditScore: over.score }),
    },
    loanDetails: {
      requestedAmount: over.amount,
      loanTerm: over.term,
      loanPurpose: 'home_improvement',
    },
  };
}

const assess = (over: Parameters<typeof request>[0]) => assessEligibility(request(over), product);

describe('assessEligibility: reference scenarios', () => {
  it('S1 the specification’s sample inputs: eligible for less than requested', () => {
    const result = assess({
      income: 25000,
      expenses: 15000,
      debt: 5000,
      score: 650,
      amount: 150000,
      term: 24,
    });
    const { decisionReason, ...eligibilityResult } = result.eligibilityResult;
    expect(decisionReason).toContain('up to R42 000 over 24 months would fit');
    expect(eligibilityResult).toEqual({
      isEligible: true,
      approvalLikelihood: 50,
      riskCategory: 'medium',
    });
    expect(result.recommendedLoan).toEqual({
      maxAmount: 42000,
      recommendedAmount: 42000,
      interestRate: 12.5,
      monthlyPayment: 1986.91,
      totalRepayment: 47685.77,
    });
    expect(result.affordabilityAnalysis).toEqual({
      disposableIncome: 10000,
      debtToIncomeRatio: 20,
      loanToIncomeRatio: 50,
      affordabilityScore: 'poor',
    });
  });

  it('S2 comfortable: recommends the requested amount', () => {
    const result = assess({
      income: 40000,
      expenses: 15000,
      debt: 3000,
      score: 720,
      amount: 100000,
      term: 36,
    });
    expect(result.eligibilityResult).toMatchObject({
      isEligible: true,
      approvalLikelihood: 95,
      riskCategory: 'low',
    });
    expect(result.recommendedLoan).toEqual({
      maxAmount: 266000,
      recommendedAmount: 100000,
      interestRate: 11.5,
      monthlyPayment: 3297.6,
      totalRepayment: 118713.62,
    });
    expect(result.affordabilityAnalysis).toEqual({
      disposableIncome: 25000,
      debtToIncomeRatio: 7.5,
      loanToIncomeRatio: 20.8,
      affordabilityScore: 'excellent',
    });
  });

  it('S3 no credit score: priced at the middle of the range', () => {
    const result = assess({
      status: 'self_employed',
      duration: 6,
      income: 30000,
      expenses: 12000,
      debt: 3000,
      amount: 80000,
      term: 48,
    });
    expect(result.recommendedLoan).toMatchObject({
      interestRate: 14.5,
      maxAmount: 217000,
      recommendedAmount: 80000,
      monthlyPayment: 2206.24,
      totalRepayment: 105899.28,
    });
    expect(result.eligibilityResult).toMatchObject({
      approvalLikelihood: 70,
      riskCategory: 'medium',
    });
  });

  it('S4 unemployed: not eligible, whatever the finances', () => {
    const result = assess({
      status: 'unemployed',
      duration: 6,
      income: 30000,
      expenses: 12000,
      debt: 3000,
      score: 700,
      amount: 80000,
      term: 48,
    });
    expect(result.eligibilityResult).toMatchObject({
      isEligible: false,
      approvalLikelihood: 15,
      riskCategory: 'high',
    });
    expect(result.eligibilityResult.decisionReason).toContain('does not assess unemployed');
    expect(result.recommendedLoan).toMatchObject({
      maxAmount: 0,
      recommendedAmount: 0,
      monthlyPayment: 0,
      totalRepayment: 0,
    });
  });

  it('S5 nothing left after expenses and debt: not eligible', () => {
    const result = assess({
      income: 12000,
      expenses: 9000,
      debt: 3000,
      score: 650,
      amount: 20000,
      term: 24,
    });
    expect(result.eligibilityResult).toMatchObject({ isEligible: false, riskCategory: 'high' });
    expect(result.eligibilityResult.decisionReason).toContain('use all of the monthly income');
    expect(result.affordabilityAnalysis).toMatchObject({
      disposableIncome: 3000,
      affordabilityScore: 'poor',
    });
  });

  it('S6 not enough left even for the smallest loan', () => {
    const result = assess({
      income: 5000,
      expenses: 4500,
      debt: 0,
      score: 650,
      amount: 20000,
      term: 6,
    });
    expect(result.eligibilityResult.isEligible).toBe(false);
    expect(result.eligibilityResult.decisionReason).toContain('Even the smallest loan of R5 000');
    expect(result.recommendedLoan.maxAmount).toBe(0);
  });

  it('S7 retired with a low score: eligible at the top of the range', () => {
    const result = assess({
      status: 'retired',
      duration: 12,
      income: 18000,
      expenses: 8000,
      debt: 2000,
      score: 540,
      amount: 30000,
      term: 36,
    });
    expect(result.recommendedLoan).toEqual({
      maxAmount: 87000,
      recommendedAmount: 30000,
      interestRate: 18.5,
      monthlyPayment: 1092.11,
      totalRepayment: 39316.05,
    });
    expect(result.eligibilityResult).toMatchObject({
      approvalLikelihood: 55,
      riskCategory: 'medium',
    });
  });
});

describe('assessEligibility: the 40% limit is exact', () => {
  // R50 000 over 12 months at 12.5% costs exactly R4 454.14, which is exactly 40% of R11 135.35.
  const at = (expenses: number) =>
    assess({ income: 20000, expenses, debt: 0, score: 650, amount: 50000, term: 12 });

  it('allows the amount at exactly 40%', () => {
    const result = at(8864.65); // available R11 135.35
    expect(result.recommendedLoan.maxAmount).toBe(50000);
    expect(result.recommendedLoan.monthlyPayment).toBe(4454.14);
    expect(result.affordabilityAnalysis.affordabilityScore).toBe('fair');
  });

  it('steps down to R49 000 one cent below', () => {
    const result = at(8864.66); // available R11 135.34
    expect(result.recommendedLoan.maxAmount).toBe(49000);
    expect(result.recommendedLoan.recommendedAmount).toBe(49000);
    expect(result.affordabilityAnalysis.affordabilityScore).toBe('poor');
  });

  it('keeps the requested amount one cent above', () => {
    expect(at(8864.64).recommendedLoan.maxAmount).toBe(50000);
  });
});

describe('assessEligibility: shape and ratios', () => {
  it('reports each ratio against its own denominator', () => {
    const result = assess({
      income: 25000,
      expenses: 15000,
      debt: 5000,
      score: 650,
      amount: 150000,
      term: 24,
    });
    // debt-to-income = existing monthly debt repayments ÷ monthly income
    expect(result.affordabilityAnalysis.debtToIncomeRatio).toBe(20);
    // loan-to-income = requested amount ÷ annual income (12 × monthly income)
    expect(result.affordabilityAnalysis.loanToIncomeRatio).toBe(50);
    // disposable income = monthly income − monthly expenses (before existing debt)
    expect(result.affordabilityAnalysis.disposableIncome).toBe(10000);
  });

  it('is deterministic', () => {
    const input = request({
      income: 33333.33,
      expenses: 11111.11,
      debt: 2222.22,
      score: 701,
      amount: 123456.78,
      term: 37,
    });
    expect(assessEligibility(input, product)).toEqual(assessEligibility(input, product));
  });

  it('keeps likelihood within 5–95 and ties risk to it', () => {
    for (const score of [undefined, 300, 550, 600, 650, 700, 750, 850]) {
      for (const status of ['employed', 'self_employed', 'retired', 'unemployed'] as const) {
        const { eligibilityResult } = assess({
          status,
          income: 30000,
          expenses: 10000,
          debt: 1000,
          score,
          amount: 60000,
          term: 24,
        });
        expect(eligibilityResult.approvalLikelihood).toBeGreaterThanOrEqual(5);
        expect(eligibilityResult.approvalLikelihood).toBeLessThanOrEqual(95);
        const expected =
          eligibilityResult.approvalLikelihood >= 75
            ? 'low'
            : eligibilityResult.approvalLikelihood >= 50
              ? 'medium'
              : 'high';
        expect(eligibilityResult.riskCategory).toBe(expected);
      }
    }
  });

  it('never recommends more than the maximum, more than requested, or below the product minimum', () => {
    for (const amount of [5000, 12345.67, 50000, 300000]) {
      const { recommendedLoan } = assess({
        income: 22000,
        expenses: 9000,
        debt: 1500,
        score: 640,
        amount,
        term: 36,
      });
      expect(recommendedLoan.recommendedAmount).toBeLessThanOrEqual(recommendedLoan.maxAmount);
      expect(recommendedLoan.recommendedAmount).toBeLessThanOrEqual(amount);
      if (recommendedLoan.recommendedAmount > 0) {
        expect(recommendedLoan.recommendedAmount).toBeGreaterThanOrEqual(product.minAmount);
      }
    }
  });
});
