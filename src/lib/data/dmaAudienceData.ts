/**
 * DMA Audience Data — re-exports raw cell data from the snapshot,
 * plus a computeAudienceSize() function that sums cells for any
 * arbitrary age × sex combination on the fly.
 */

export { DMA_LIST, AGE_CELL_RANGES, DMA_CELLS } from "./dmaAudienceData.snapshot";

import { AGE_CELL_RANGES, DMA_CELLS } from "./dmaAudienceData.snapshot";

export type Sex = "adults" | "males" | "females";

/**
 * The snapping points for the age slider, derived from the Census cell boundaries.
 * Each value is the ageMin of a cell, plus a final "85+" sentinel.
 * [18, 20, 21, 22, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85]
 */
export const AGE_SNAP_POINTS: number[] = AGE_CELL_RANGES.map(([min]) => min);

/**
 * Compute audience size for a DMA given an age range and sex filter.
 * Includes any cell whose age range overlaps with [ageMin, ageMax].
 *
 * @param dmaCode - DMA code ("0" for US National)
 * @param ageMin - Minimum age (inclusive), e.g. 25
 * @param ageMax - Maximum age (inclusive), e.g. 54. Use 999 or 85+ for no upper bound.
 * @param sex - "adults" (both), "males", or "females"
 * @returns population count, or null if DMA not found
 */
export function computeAudienceSize(
  dmaCode: string,
  ageMin: number,
  ageMax: number,
  sex: Sex
): number | null {
  const cells = DMA_CELLS[dmaCode];
  if (!cells) return null;

  let total = 0;
  for (let i = 0; i < AGE_CELL_RANGES.length; i++) {
    const [cellMin, cellMax] = AGE_CELL_RANGES[i];
    // Include this cell if it overlaps with the requested range
    if (cellMin <= ageMax && cellMax >= ageMin) {
      if (sex === "males") {
        total += cells.m[i];
      } else if (sex === "females") {
        total += cells.f[i];
      } else {
        total += cells.m[i] + cells.f[i];
      }
    }
  }
  return total;
}

/**
 * Get households count for a DMA.
 */
export function getHouseholds(dmaCode: string): number | null {
  const cells = DMA_CELLS[dmaCode];
  if (!cells) return null;
  return cells.hh;
}

/**
 * Format a demographic selection into a human-readable label.
 * e.g., "Adults 25-54", "Males 18+", "Females 35-64", "Households"
 */
export function formatDemoLabel(sex: Sex, ageMin: number, ageMax: number): string {
  const sexLabel = sex === "adults" ? "Adults" : sex === "males" ? "Males" : "Females";
  const maxLabel = ageMax >= 85 ? "+" : `-${ageMax}`;
  return `${sexLabel} ${ageMin}${maxLabel}`;
}
