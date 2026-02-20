/**
 * TV Reach Curve — Exponential Saturation Model
 *
 * Estimates Reach% from GRPs using the formula:
 *   Reach% = 100 × (1 − e^(−k × GRPs / 100))
 *
 * This is an industry approximation. Actual reach curves vary by
 * daypart, network mix, audience composition, and market.
 * Results should be treated as estimates.
 */

/**
 * Estimate Reach% from GRPs using an exponential saturation curve.
 *
 * @param grps - Gross Rating Points (must be ≥ 0)
 * @param k - Curve steepness parameter (default 1.0 for general TV)
 * @returns Estimated Reach% (0–100, exclusive of 100)
 */
export function estimateReachPercent(grps: number, k: number = 1.0): number {
  if (grps < 0) throw new Error("GRPs cannot be negative");
  if (k <= 0) throw new Error("k must be positive");
  return 100 * (1 - Math.exp((-k * grps) / 100));
}

/**
 * Get the default reach curve k-parameter for a channel.
 * Returns null if no built-in curve is available for the channel.
 */
export function getReachCurveK(channel: string): number | null {
  switch (channel) {
    case "TV":
      return 1.0;
    default:
      return null;
  }
}
