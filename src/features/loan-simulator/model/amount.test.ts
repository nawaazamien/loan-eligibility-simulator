import { parseAmount } from './amount';

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
