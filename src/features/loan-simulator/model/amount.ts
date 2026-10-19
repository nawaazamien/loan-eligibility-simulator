/**
 * The result of reading a rand amount typed by the customer. Missing and malformed text
 * stay distinct from a real amount: nothing here ever turns them into zero.
 */
export type ParsedAmount =
  | { readonly kind: 'empty' }
  | { readonly kind: 'malformed' }
  | { readonly kind: 'negative' }
  | { readonly kind: 'ok'; readonly cents: number };

const AMOUNT_PATTERN = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parses a rand amount as described in docs/SIMULATION_MODEL.md §1:
 * trim, drop a leading "R", remove spaces (including NBSP), remove commas used as
 * thousands separators, treat a remaining single comma as the decimal point, then accept
 * at most two decimal places. Cents are built from the digit strings, never via
 * parseFloat, so "0.29" is exactly 29 cents.
 */
export function parseAmount(raw: string): ParsedAmount {
  let text = raw.trim().replace(/^r/i, '').replace(/\s/g, '');
  if (text === '') return { kind: 'empty' };

  text = text.replace(/,(?=\d{3}(?!\d))/g, '').replace(',', '.');
  const match = AMOUNT_PATTERN.exec(text);
  if (!match) return { kind: 'malformed' };

  const [, sign = '', whole = '', fraction = ''] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (sign === '-' && cents > 0) return { kind: 'negative' };
  return { kind: 'ok', cents };
}
