/**
 * Money is stored EVERYWHERE as an integer number of cents.
 *
 * Floating point cannot represent 0.1 exactly, so `0.1 + 0.2 !== 0.3`. In a
 * splitting app those errors compound across every participant until a balance
 * is off by a cent and nobody can settle up. Integers remove the whole class of
 * bug: we only convert to a decimal at the edges (parsing input, rendering).
 */

export const CURRENCY_CODE = 'LKR';
export const CURRENCY_SYMBOL = 'Rs';

/** "1234.5" -> 123450. Returns null when the text isn't a usable amount. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const parts = cleaned.split('.');
  if (parts.length > 2) return null;
  const whole = parts[0] || '0';
  const frac = (parts[1] || '').slice(0, 2).padEnd(2, '0');
  const cents = Number(whole) * 100 + Number(frac);
  if (!Number.isFinite(cents)) return null;
  return Math.round(cents);
}

/** 123450 -> "1,234.50" (grouped, always 2 decimals, no symbol). */
export function formatCents(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toString();
  const frac = (abs % 100).toString().padStart(2, '0');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${grouped}.${frac}`;
}

/** 123450 -> "Rs 1,234.50" */
export function formatMoney(cents: number): string {
  return `${CURRENCY_SYMBOL} ${formatCents(cents)}`;
}

/** Same as formatMoney but always drops the sign — for "you owe Rs 40" phrasing. */
export function formatMoneyAbs(cents: number): string {
  return formatMoney(Math.abs(cents));
}

/** 123450 -> "1234.50", for pre-filling a text input. */
export function centsToInput(cents: number): string {
  if (!cents) return '';
  const abs = Math.abs(Math.round(cents));
  return `${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, '0')}`;
}
