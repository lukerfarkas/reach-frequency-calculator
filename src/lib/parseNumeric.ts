/**
 * Shared numeric parsing helpers.
 *
 * Users routinely paste values from spreadsheets, media plans, and
 * emails — so inputs arrive with currency symbols, thousand separators,
 * percent signs, and whitespace. A naive `Number("$5,000,000")` returns
 * `NaN`, which would silently blow up every downstream calculation.
 *
 * Every user-facing numeric parse in the app should go through these
 * helpers instead of calling `Number()` directly.
 */

/**
 * Strip UI noise (currency symbols, commas, trailing %, whitespace) from
 * a string before numeric parsing. Pure string transform — does NOT
 * validate that the result is numeric.
 *
 * Examples:
 *   "$5,000,000" → "5000000"
 *   "1,234.56 "  → "1234.56"
 *   "45%"        → "45"
 *   "  -5 "      → "-5"
 *   "£1,000"     → "1000"
 */
export function cleanNumericString(value: string): string {
  return value
    .trim()
    // Leading currency symbols ($, £, €, ¥). One pass is enough — a user
    // pasting "$$5" is almost certainly a typo and Number() will reject it.
    .replace(/^[$£€¥]/, "")
    // Thousand separators (also protects against stray spaces mid-number).
    .replace(/[,\s]/g, "")
    // Trailing percent — we store the raw number; the UI labels the unit.
    .replace(/%$/, "");
}

/**
 * Parse a string to a finite number after stripping currency/comma/%
 * noise. Returns null for empty strings, whitespace, or anything that
 * doesn't resolve to a finite number.
 *
 * Intentionally permissive: it preserves sign and decimals, so callers
 * that need positivity or integer constraints should apply them on top.
 */
export function parseNumeric(value: string): number | null {
  const cleaned = cleanNumericString(value);
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

/** Parse and require a finite number > 0. Returns null otherwise. */
export function parsePositive(value: string): number | null {
  const n = parseNumeric(value);
  return n != null && n > 0 ? n : null;
}

/** Parse and require a finite number ≥ 0. Returns null otherwise. */
export function parseNonNeg(value: string): number | null {
  const n = parseNumeric(value);
  return n != null && n >= 0 ? n : null;
}
