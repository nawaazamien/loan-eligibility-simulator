/**
 * Where a slider should sit for the text in its field, which is the source of truth. A valid
 * value is rounded to the slider's step (counted from its minimum) and clamped to its range,
 * so a value such as R52 500 can be typed although the slider moves in R1 000 steps. Any
 * other text returns null: the slider keeps its last position rather than inventing a value.
 */
export function sliderPosition(
  value: number | null,
  range: { min: number; max: number; step: number },
): number | null {
  if (value === null) return null;
  const stepped = Math.round((value - range.min) / range.step) * range.step + range.min;
  return Math.min(range.max, Math.max(range.min, stepped));
}
