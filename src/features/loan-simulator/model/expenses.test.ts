import { checkCategory, EMPTY_EXPENSE_DRAFT, mapDraft, totalDraft } from './expenses';

describe('checkCategory', () => {
  it('counts a blank category as R0, and accepts a typed zero', () => {
    expect(checkCategory('')).toEqual({ ok: true, cents: 0 });
    expect(checkCategory('   ')).toEqual({ ok: true, cents: 0 });
    expect(checkCategory('0')).toEqual({ ok: true, cents: 0 });
  });

  it.each([
    ['4 500', 450_000],
    ['R4,500', 450_000],
    ['4500.5', 450_050],
    ['0.29', 29],
  ])('reads %j as %d cents', (raw, cents) => {
    expect(checkCategory(raw)).toEqual({ ok: true, cents });
  });

  it.each(['abc', '12,5,00', '10.005', '1e3', '4 500x'])(
    'rejects %j as a whole, with no partial reading',
    (raw) => {
      expect(checkCategory(raw)).toEqual({
        ok: false,
        message: 'Use numbers only, for example 18 500.',
      });
    },
  );

  it('rejects negative and out-of-range amounts without clamping', () => {
    expect(checkCategory('-200')).toEqual({ ok: false, message: 'Enter an amount of R0 or more.' });
    expect(checkCategory('1 000 000')).toEqual({ ok: true, cents: 100_000_000 });
    expect(checkCategory('1 000 000.01')).toEqual({
      ok: false,
      message: 'Enter an amount up to R1 000 000.',
    });
    expect(checkCategory('9'.repeat(30))).toMatchObject({ ok: false });
  });
});

describe('totalDraft', () => {
  it('adds categories exactly in integer cents', () => {
    // 0.10 + 0.20 is 0.30000000000000004 in floating point; in cents it is exactly 30.
    const draft = { ...EMPTY_EXPENSE_DRAFT, food: '0.10', transport: '0.20' };
    expect(totalDraft(draft)).toEqual({ ok: true, cents: 30 });

    const full = mapDraft((key) => (key === 'other' ? '' : '1 234.56'));
    expect(totalDraft(full)).toEqual({ ok: true, cents: 7 * 123_456 });
  });

  it('totals an all-blank draft as R0', () => {
    expect(totalDraft(EMPTY_EXPENSE_DRAFT)).toEqual({ ok: true, cents: 0 });
  });

  it('gives no total while any category is invalid, and names each one', () => {
    const draft = { ...EMPTY_EXPENSE_DRAFT, housing: '6 000', food: 'abc', other: '-5' };
    expect(totalDraft(draft)).toEqual({
      ok: false,
      reason: 'invalid',
      errors: {
        food: 'Use numbers only, for example 18 500.',
        other: 'Enter an amount of R0 or more.',
      },
    });
  });

  it('rejects a combined total above the monthly-expenses limit', () => {
    const draft = { ...EMPTY_EXPENSE_DRAFT, housing: '600 000', other: '400 000.01' };
    const total = totalDraft(draft);
    if (total.ok || total.reason !== 'tooLarge') throw new Error('Expected a too-large total');
    expect(total.cents).toBe(100_000_001);
    expect(total.message).toContain('more than the R1 000 000 limit');
    expect(totalDraft({ ...draft, other: '400 000' })).toEqual({ ok: true, cents: 100_000_000 });
  });
});
