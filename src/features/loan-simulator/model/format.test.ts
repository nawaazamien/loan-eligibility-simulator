import { centsToInputText, formatAmountOnBlur, formatRand } from './format';

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
