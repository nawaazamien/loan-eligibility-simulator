import { sliderPosition } from './slider';

const amount = { min: 5000, max: 300000, step: 1000 };
const term = { min: 6, max: 60, step: 1 };

describe('sliderPosition', () => {
  it('follows a valid value, rounded to the step counted from the minimum', () => {
    expect(sliderPosition(60000, amount)).toBe(60000);
    expect(sliderPosition(52400, amount)).toBe(52000);
    expect(sliderPosition(52500, amount)).toBe(53000);
    expect(sliderPosition(36, term)).toBe(36);
  });

  it('clamps values outside the range to its ends', () => {
    expect(sliderPosition(400000, amount)).toBe(300000);
    expect(sliderPosition(200, amount)).toBe(5000);
    expect(sliderPosition(0, term)).toBe(6);
    expect(sliderPosition(99, term)).toBe(60);
  });

  it('counts steps from the minimum, not from zero', () => {
    expect(sliderPosition(5400, { min: 5250, max: 20000, step: 500 })).toBe(5250);
    expect(sliderPosition(5600, { min: 5250, max: 20000, step: 500 })).toBe(5750);
  });

  it('has no position for a value that cannot be read, so the slider keeps its place', () => {
    expect(sliderPosition(null, amount)).toBeNull();
  });
});
