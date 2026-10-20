import { parseAmount, parseWhole } from './amount';

describe('parseAmount', () => {
  it.each([
    ['28 500', 2_850_000],
    ['28500', 2_850_000],
    ['R28,500', 2_850_000],
    ['r 28 500', 2_850_000],
    ['28 500', 2_850_000],
    ['28 500,50', 2_850_050],
    ['1,234,567', 123_456_700],
    ['0.29', 29],
    ['12.5', 1_250],
    [' 0 ', 0],
    ['-0', 0],
  ])('reads %j as %d cents', (raw, cents) => {
    expect(parseAmount(raw)).toEqual({ kind: 'ok', cents });
  });

  it.each(['', '   ', 'R', ' r '])('treats %j as empty, not zero', (raw) => {
    expect(parseAmount(raw)).toEqual({ kind: 'empty' });
  });

  it.each(['12,5,00', '1.234', 'abc', '1e5', '5.', '.5', '12-3', '--5', 'R 5 R'])(
    'treats %j as malformed, not zero',
    (raw) => {
      expect(parseAmount(raw)).toEqual({ kind: 'malformed' });
    },
  );

  it.each(['-5 000', '-0.01', 'R-200'])('flags %j as negative', (raw) => {
    expect(parseAmount(raw)).toEqual({ kind: 'negative' });
  });
});

describe('parseWhole', () => {
  it.each([
    ['35', 35],
    [' 035 ', 35],
    ['35.00', 35],
    ['1 000', 1000],
    ['0', 0],
  ])('reads %j as %d', (raw, value) => {
    expect(parseWhole(raw)).toEqual({ kind: 'ok', value });
  });

  it('keeps empty distinct from zero', () => {
    expect(parseWhole('')).toEqual({ kind: 'empty' });
    expect(parseWhole('  ')).toEqual({ kind: 'empty' });
  });

  it.each(['35.5', '35.01', 'abc', '3 5x', '1e2', '12,5,00'])('rejects %j as malformed', (raw) => {
    expect(parseWhole(raw)).toEqual({ kind: 'malformed' });
  });

  it('flags negatives and refuses numbers too large to hold exactly', () => {
    expect(parseWhole('-3')).toEqual({ kind: 'negative' });
    expect(parseWhole('9'.repeat(30))).toEqual({ kind: 'malformed' });
    expect(parseWhole('1' + '0'.repeat(20))).toEqual({ kind: 'malformed' });
  });
});
