import { parseAmount } from './amount';
import { loanSliderPosition } from './loanSlider';

const position = (raw: string) => loanSliderPosition(parseAmount(raw));

describe('loanSliderPosition', () => {
  it('follows a valid amount, rounded to the R1 000 step', () => {
    expect(position('60 000')).toBe(60_000);
    expect(position('52 400')).toBe(52_000);
    expect(position('52 500')).toBe(53_000);
  });

  it('clamps valid amounts outside the slider range', () => {
    expect(position('400 000')).toBe(250_000);
    expect(position('200')).toBe(1_000);
    expect(position('0')).toBe(1_000);
  });

  it.each(['', 'abc', '-5 000'])('has no position for %j (the slider keeps its place)', (raw) => {
    expect(position(raw)).toBeNull();
  });
});
