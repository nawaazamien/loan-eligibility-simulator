import { parseAmount, parseWhole } from './amount';

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

/**
 * A display figure from integer cents: "R" + NBSP-grouped digits, with U+2212 for
 * negatives ("−R398"). Whole rand by default, rounded half-up away from zero on the
 * magnitude (R398.50 → R399); with `withCents`, exact to the cent ("R1 878.88").
 */
export function formatCents(cents: number, { withCents = false } = {}): string {
  const sign = cents < 0 ? MINUS : '';
  const magnitude = Math.abs(cents);
  if (withCents) {
    const whole = groupDigits(String(Math.floor(magnitude / 100)), NBSP);
    return `${sign}R${whole}.${String(magnitude % 100).padStart(2, '0')}`;
  }
  return `${sign}R${groupDigits(String(Math.floor((magnitude + 50) / 100)), NBSP)}`;
}

/** A whole-rand display figure ("R250 000"). */
export function formatRand(rand: number): string {
  return formatCents(rand * 100);
}

/** Tidies a whole-number field on blur ("035" → "35"); anything unreadable stays as typed. */
export function formatWholeOnBlur(raw: string): string {
  const parsed = parseWhole(raw);
  return parsed.kind === 'ok' ? String(parsed.value) : raw;
}

/** A percentage to one decimal place without a trailing ".0": 20 → "20%", 7.5 → "7.5%". */
export function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? String(value) : value.toFixed(1)}%`;
}
