/** Format a number with commas: 1234567 → "1,234,567" */
export function fmtInt(n: number | null): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/** Format to 2 decimal places */
export function fmt2(n: number | null): string {
  if (n == null) return "—";
  return n.toFixed(2);
}

/** Format currency */
export function fmtCurrency(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
