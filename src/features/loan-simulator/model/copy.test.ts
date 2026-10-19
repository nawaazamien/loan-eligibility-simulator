import { calculateEstimate } from './calculate';
import type { Term } from './constants';
import { describeEstimate } from './copy';

/** Writes "R1_879" for "R1 879" with the NBSP used in display figures. */
const nb = (text: string) => text.replaceAll('_', ' ');

function describe_(income: number, expenses: number, debt: number, loan: number, term: Term) {
  return describeEstimate(
    calculateEstimate({
      incomeCents: Math.round(income * 100),
      expensesCents: Math.round(expenses * 100),
      debtCents: Math.round(debt * 100),
      loanCents: loan * 100,
      term,
    }),
  );
}

describe('describeEstimate', () => {
  it('describes an estimate within the limit (reference case 1)', () => {
    const copy = describe_(28_500, 14_200, 3_150, 60_000, 48);
    expect(copy.title).toBe('Within the demo affordability limit');
    expect(copy.repayment).toBe(nb('R1_878.88'));
    expect(copy.explanation).toBe(
      nb(
        "Your estimated repayment of R1_879 would use 17% of the R11_150 you have left each month after expenses and existing debt. That's within the demo limit of 40% (R4_460).",
      ),
    );
    expect(copy.summary).toEqual([
      { term: 'Loan amount', value: nb('R60_000') },
      { term: 'Repayment term', value: '48 months' },
      { term: 'Left after all repayments', value: nb('R9_271 a month') },
      { term: 'Total repayable', value: nb('R90_186') },
    ]);
    expect(copy.breakdown?.heading).toBe(nb('Where your R28_500 goes each month'));
    expect(copy.breakdown?.segments.map((s) => [s.label, s.value])).toEqual([
      ['Living expenses', nb('R14_200')],
      ['Existing debt', nb('R3_150')],
      ['New repayment', nb('R1_879')],
      ['Left over', nb('R9_271')],
    ]);
    expect(copy.breakdown?.shortfall).toBeNull();
    expect(copy.tips).toEqual([]);
    expect(copy.announcement).toBe(
      nb(
        'Estimate updated. Within the demo affordability limit. Estimated monthly repayment R1_878.88.',
      ),
    );
  });

  it('fills the bar with the income when everything fits', () => {
    const segments = describe_(28_500, 14_200, 3_150, 60_000, 48).breakdown?.segments ?? [];
    const total = segments.reduce((sum, s) => sum + s.percent, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it('describes an estimate above the limit, with a shortfall and next steps (case 2)', () => {
    const copy = describe_(18_000, 11_500, 2_400, 120_000, 36);
    expect(copy.title).toBe('Above the demo affordability limit');
    expect(copy.explanation).toBe(
      nb(
        'Your estimated repayment of R4_498 would use 110% of the R4_100 you have left each month after expenses and existing debt. The demo limit is 40% (R1_640), so this estimate is R2_858 a month above it.',
      ),
    );
    expect(copy.summary[2]).toEqual({
      term: 'Left after all repayments',
      value: nb('−R398 a month'),
    });
    // The bar cannot show a negative amount: no "Left over" segment, and the shortfall in words.
    const segments = copy.breakdown?.segments ?? [];
    expect(segments.map((s) => s.key)).toEqual(['expenses', 'debt', 'repayment']);
    expect(segments.every((s) => s.percent >= 0)).toBe(true);
    expect(segments.reduce((sum, s) => sum + s.percent, 0)).toBeCloseTo(100, 6);
    expect(copy.breakdown?.shortfall).toBe(
      nb('Your commitments and the new repayment would be R398 more than your income.'),
    );
    expect(copy.tips).toEqual([
      {
        title: 'Borrow less',
        text: nb(
          'Over 36 months, about R42_000 or less would keep the estimate within the demo limit.',
        ),
      },
      {
        title: 'Choose a longer term',
        text: nb(
          "Over 60 months the estimate is R3_214.97 a month, still above the demo limit. You'd pay more interest overall.",
        ),
      },
      {
        title: 'Review your commitments',
        text: 'Lowering regular expenses or paying down existing debt increases the money you have left each month.',
      },
    ]);
  });

  it('says when 60 months would bring the estimate within the limit', () => {
    const copy = describe_(10_000, 0, 0, 60_000, 12);
    expect(copy.tips[1]?.text).toContain('a month, within the demo limit.');
  });

  it('leaves out the longer-term tip when the term is already 60 months', () => {
    const copy = describe_(5_000, 0, 0, 250_000, 60);
    expect(copy.title).toBe('Above the demo affordability limit');
    expect(copy.tips.map((t) => t.title)).toEqual(['Borrow less', 'Review your commitments']);
  });

  it('leaves out the smaller-loan tip when even R1 000 would be above the limit', () => {
    const copy = describe_(1_000, 900, 0, 1_000, 36);
    expect(copy.title).toBe('Above the demo affordability limit');
    expect(copy.tips.map((t) => t.title)).toEqual([
      'Choose a longer term',
      'Review your commitments',
    ]);
  });

  it('shows a gap under R1 in cents, never as "R0" (case 6)', () => {
    const copy = describe_(2_705.09, 0, 0, 20_000, 24);
    expect(copy.title).toBe('Above the demo affordability limit');
    expect(copy.explanation).toContain(nb('so this estimate is R0.01 a month above it.'));
  });

  it('explains commitments that exceed income, with no bar (case 3)', () => {
    const copy = describe_(12_000, 9_800, 2_600, 20_000, 24);
    expect(copy.title).toBe('No room for an additional repayment');
    expect(copy.explanation).toBe(
      nb(
        "Your expenses and existing debt repayments (R12_400) are R400 more than your take-home income, so this demo can't fit an additional repayment.",
      ),
    );
    expect(copy.summary[2]?.value).toBe(nb('−R1_482 a month'));
    expect(copy.breakdown).toBeNull();
    expect(copy.tips.map((t) => t.title)).toEqual([
      'Check your figures',
      'Review your commitments',
    ]);
  });

  it('explains commitments that use all of the income (case 4)', () => {
    expect(describe_(12_000, 9_000, 3_000, 20_000, 24).explanation).toBe(
      nb(
        "Your expenses and existing debt repayments (R12_000) use all of your take-home income, so this demo can't fit an additional repayment.",
      ),
    );
  });

  it('uses estimate language only', () => {
    const all = [
      describe_(28_500, 14_200, 3_150, 60_000, 48),
      describe_(18_000, 11_500, 2_400, 120_000, 36),
      describe_(12_000, 9_800, 2_600, 20_000, 24),
    ]
      .map((copy) => JSON.stringify(copy))
      .join(' ');
    expect(all).not.toMatch(/approved|declined|rejected|qualify|offer|eligible/i);
  });
});
