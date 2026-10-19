import { parseAmount } from './amount';

const NBSP = ' ';
const MINUS = '−';

function groupDigits(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Text for an editable amount field: digits grouped with ordinary spaces, as in the
 * design ("28 500"), with cents only when they are not zero ("28 500.50").
 */
export function centsToInputText(cents: number): string {
  const whole = groupDigits(String(Math.floor(cents / 100)), ' ');
  const fraction = cents % 100;
  return fraction === 0 ? whole : `${whole}.${String(fraction).padStart(2, '0')}`;
}

/**
 * Tidies a field when the customer leaves it. A valid amount is regrouped; anything else
 * (empty, malformed, negative, or too large to represent exactly) is left exactly as typed.
 */
export function formatAmountOnBlur(raw: string): string {
  const parsed = parseAmount(raw);
  if (parsed.kind !== 'ok' || !Number.isSafeInteger(parsed.cents)) return raw;
  return centsToInputText(parsed.cents);
}

/** A whole-rand display figure: "R" + NBSP-grouped digits, negatives with U+2212 ("−R398"). */
export function formatRand(rand: number): string {
  const sign = rand < 0 ? MINUS : '';
  return `${sign}R${groupDigits(String(Math.abs(Math.round(rand))), NBSP)}`;
}
