import { centsToInputText, formatAmountOnBlur, formatCents, formatRand } from './format';

describe('centsToInputText', () => {
  it.each([
    [0, '0'],
    [99_900, '999'],
    [100_000, '1 000'],
    [2_850_000, '28 500'],
    [2_850_050, '28 500.50'],
    [2_850_005, '28 500.05'],
    [100_000_000, '1 000 000'],
  ])('writes %d cents as %j', (cents, text) => {
    expect(centsToInputText(cents)).toBe(text);
  });
});

describe('formatAmountOnBlur', () => {
  it.each([
    ['28500', '28 500'],
    ['R28,500', '28 500'],
    ['28500.5', '28 500.50'],
    ['28500.00', '28 500'],
    ['007', '7'],
  ])('tidies the valid amount %j to %j', (raw, text) => {
    expect(formatAmountOnBlur(raw)).toBe(text);
  });

  it.each(['', 'abc', '12,5,00', '-5 000', '1.234', '9'.repeat(20)])(
    'leaves %j exactly as typed',
    (raw) => {
      expect(formatAmountOnBlur(raw)).toBe(raw);
    },
  );
});

describe('formatRand', () => {
  it('groups digits with non-breaking spaces', () => {
    expect(formatRand(1_000)).toBe('R1 000');
    expect(formatRand(250_000)).toBe('R250 000');
    expect(formatRand(999)).toBe('R999');
  });

  it('uses a true minus sign for negative amounts', () => {
    expect(formatRand(-398)).toBe('−R398');
  });
});

describe('formatCents', () => {
  it('shows repayments to the cent', () => {
    expect(formatCents(187_888, { withCents: true })).toBe('R1 878.88');
    expect(formatCents(16_140, { withCents: true })).toBe('R161.40');
    expect(formatCents(1, { withCents: true })).toBe('R0.01');
  });

  it('rounds other figures half-up to whole rand on the magnitude', () => {
    expect(formatCents(927_112)).toBe('R9 271');
    expect(formatCents(39_850)).toBe('R399');
    expect(formatCents(39_849)).toBe('R398');
    expect(formatCents(-39_812)).toBe('−R398');
    expect(formatCents(-39_850)).toBe('−R399');
    expect(formatCents(0)).toBe('R0');
  });
});
