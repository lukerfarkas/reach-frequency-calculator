import { describe, it, expect } from "vitest";
import {
  grossImpressionsFromCostCPM,
  grpsFromImpressions,
  grpsFromReachFrequency,
  averageFrequency,
  impressionsFromGRPs,
  reachNumber,
  effectiveReach3Plus,
  combinedReach,
  computePlanSummary,
} from "@/lib/math/calculations";

// ---------------------------------------------------------------------------
// grossImpressionsFromCostCPM
// ---------------------------------------------------------------------------

describe("grossImpressionsFromCostCPM", () => {
  it("computes impressions from cost and CPM", () => {
    // $5,000,000 / $25 CPM * 1000 = 200,000,000 impressions
    expect(grossImpressionsFromCostCPM(5_000_000, 25)).toBe(200_000_000);
  });

  it("handles small values", () => {
    expect(grossImpressionsFromCostCPM(100, 10)).toBe(10_000);
  });

  it("throws on zero CPM", () => {
    expect(() => grossImpressionsFromCostCPM(1000, 0)).toThrow("CPM must be greater than 0");
  });

  it("throws on negative cost", () => {
    expect(() => grossImpressionsFromCostCPM(-100, 10)).toThrow("Cost cannot be negative");
  });
});

// ---------------------------------------------------------------------------
// grpsFromImpressions
// ---------------------------------------------------------------------------

describe("grpsFromImpressions", () => {
  it("computes GRPs from impressions and audience", () => {
    // 200,000,000 / 125,000,000 * 100 = 160 GRPs
    expect(grpsFromImpressions(200_000_000, 125_000_000)).toBe(160);
  });

  it("handles exact case", () => {
    // 1,000,000 / 10,000,000 * 100 = 10 GRPs
    expect(grpsFromImpressions(1_000_000, 10_000_000)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// GRPs from cost + CPM + audience (integration)
// ---------------------------------------------------------------------------

describe("GRPs from cost + CPM + audience (integration)", () => {
  it("$5M, $25 CPM, 125M audience → 160 GRPs", () => {
    const impressions = grossImpressionsFromCostCPM(5_000_000, 25);
    const grps = grpsFromImpressions(impressions, 125_000_000);
    expect(grps).toBe(160);
  });

  it("$1M, $10 CPM, 50M audience → 200 GRPs", () => {
    const impressions = grossImpressionsFromCostCPM(1_000_000, 10);
    const grps = grpsFromImpressions(impressions, 50_000_000);
    expect(grps).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// grpsFromReachFrequency
// ---------------------------------------------------------------------------

describe("grpsFromReachFrequency", () => {
  it("GRPs = Reach% × Frequency", () => {
    expect(grpsFromReachFrequency(60, 3)).toBe(180);
  });

  it("handles zero reach", () => {
    expect(grpsFromReachFrequency(0, 5)).toBe(0);
  });

  it("throws on reach > 100", () => {
    expect(() => grpsFromReachFrequency(101, 2)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// averageFrequency
// ---------------------------------------------------------------------------

describe("averageFrequency", () => {
  it("computes frequency from GRPs and reach", () => {
    expect(averageFrequency(180, 60)).toBe(3);
  });

  it("throws on zero reach", () => {
    expect(() => averageFrequency(100, 0)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// reachNumber
// ---------------------------------------------------------------------------

describe("reachNumber", () => {
  it("computes reach # from reach% and audience", () => {
    expect(reachNumber(60, 125_000_000)).toBe(75_000_000);
  });

  it("rounds to nearest integer", () => {
    expect(reachNumber(33.33, 100_000)).toBe(33_330);
  });
});

// ---------------------------------------------------------------------------
// effectiveReach3Plus (Poisson)
// ---------------------------------------------------------------------------

describe("effectiveReach3Plus", () => {
  it("λ=3 → ~57.68% effective 3+ reach", () => {
    // GRPs = 300 → λ = 3
    const result = effectiveReach3Plus(300);
    expect(result.lambda).toBe(3);
    // Known: 1 - e^-3 * (1 + 3 + 4.5) = 1 - 0.04979 * 8.5 = 1 - 0.42319 = 0.57681
    expect(result.effective3PlusPercent).toBeCloseTo(57.68, 1);
  });

  it("λ=0 → 0% effective 3+ reach", () => {
    const result = effectiveReach3Plus(0);
    expect(result.lambda).toBe(0);
    expect(result.effective3PlusPercent).toBe(0);
    expect(result.p0).toBe(1);
  });

  it("λ=1 → ~8.03% effective 3+ reach", () => {
    // GRPs = 100 → λ = 1
    const result = effectiveReach3Plus(100);
    expect(result.lambda).toBe(1);
    // P0 = e^-1 ≈ 0.3679, P1 = 1*e^-1 ≈ 0.3679, P2 = 0.5*e^-1 ≈ 0.1839
    // P3+ = 1 - 0.3679 - 0.3679 - 0.1839 ≈ 0.0803
    expect(result.effective3PlusPercent).toBeCloseTo(8.03, 1);
  });

  it("very high GRPs (λ=10) → near 100%", () => {
    const result = effectiveReach3Plus(1000);
    expect(result.effective3PlusPercent).toBeGreaterThan(99.7);
  });

  it("throws on negative GRPs", () => {
    expect(() => effectiveReach3Plus(-10)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// combinedReach (sequential remainder / dedup)
// ---------------------------------------------------------------------------

describe("combinedReach", () => {
  it("60% + 30% → 72% combined", () => {
    const result = combinedReach([
      { tacticName: "A", reachPercent: 60 },
      { tacticName: "B", reachPercent: 30 },
    ]);
    expect(result.combinedReachPercent).toBeCloseTo(72, 5);
  });

  it("single tactic returns its own reach", () => {
    const result = combinedReach([{ tacticName: "A", reachPercent: 50 }]);
    expect(result.combinedReachPercent).toBe(50);
    expect(result.steps).toHaveLength(1);
  });

  it("empty tactics → 0", () => {
    const result = combinedReach([]);
    expect(result.combinedReachPercent).toBe(0);
  });

  it("100% + anything → 100%", () => {
    const result = combinedReach([
      { tacticName: "A", reachPercent: 100 },
      { tacticName: "B", reachPercent: 50 },
    ]);
    expect(result.combinedReachPercent).toBe(100);
  });

  it("three tactics: 50% + 40% + 30%", () => {
    // 1 - (1-0.5)*(1-0.4)*(1-0.3) = 1 - 0.5*0.6*0.7 = 1 - 0.21 = 0.79 = 79%
    const result = combinedReach([
      { tacticName: "A", reachPercent: 50 },
      { tacticName: "B", reachPercent: 40 },
      { tacticName: "C", reachPercent: 30 },
    ]);
    expect(result.combinedReachPercent).toBeCloseTo(79, 5);
  });

  it("shows correct sequential steps", () => {
    const result = combinedReach([
      { tacticName: "A", reachPercent: 60 },
      { tacticName: "B", reachPercent: 30 },
    ]);

    // Sorted desc: A=60, B=30
    expect(result.steps).toHaveLength(2);

    // Step 1: A at 60%
    expect(result.steps[0].tacticName).toBe("A");
    expect(result.steps[0].runningTotal).toBe(60);

    // Step 2: remainder = 40, incremental = 40 * 0.30 = 12, total = 72
    expect(result.steps[1].tacticName).toBe("B");
    expect(result.steps[1].remainder).toBe(40);
    expect(result.steps[1].incremental).toBeCloseTo(12, 5);
    expect(result.steps[1].runningTotal).toBeCloseTo(72, 5);
  });

  it("throws on reach > 100", () => {
    expect(() =>
      combinedReach([{ tacticName: "A", reachPercent: 110 }])
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// computePlanSummary
// ---------------------------------------------------------------------------

describe("computePlanSummary", () => {
  it("computes plan summary for two tactics", () => {
    const summary = computePlanSummary(
      [
        { tacticName: "A", reachPercent: 60, grps: 180 },
        { tacticName: "B", reachPercent: 30, grps: 120 },
      ],
      125_000_000
    );

    expect(summary.totalGRPs).toBe(300);
    expect(summary.combinedReachPercent).toBeCloseTo(72, 5);
    expect(summary.combinedReachNumber).toBe(reachNumber(72, 125_000_000));
    // Avg freq = 300 / 72 ≈ 4.17
    expect(summary.combinedAvgFrequency).toBeCloseTo(4.1667, 2);
    // Effective 3+ with λ=3
    expect(summary.effective3Plus.effective3PlusPercent).toBeCloseTo(57.68, 1);
  });

  // -------------------------------------------------------------------------
  // Cost / Impressions Rollup
  // -------------------------------------------------------------------------

  it("computes cost rollup with cost and impressions data", () => {
    const summary = computePlanSummary(
      [
        { tacticName: "A", reachPercent: 60, grps: 180, inputCost: 5_000_000, grossImpressions: 200_000_000 },
        { tacticName: "B", reachPercent: 30, grps: 120, inputCost: 1_000_000, grossImpressions: 80_000_000 },
      ],
      125_000_000
    );

    expect(summary.totalNetCost).toBe(6_000_000);
    expect(summary.totalGrossImpressions).toBe(280_000_000);
    // Blended CPM = 6M / 280M * 1000 ≈ $21.43
    expect(summary.blendedCPM).toBeCloseTo(21.4286, 2);
  });

  it("treats null cost as 0 in rollup sums", () => {
    const summary = computePlanSummary(
      [
        { tacticName: "A", reachPercent: 60, grps: 180, inputCost: 5_000_000, grossImpressions: 200_000_000 },
        { tacticName: "B", reachPercent: 30, grps: 120, inputCost: null, grossImpressions: 80_000_000 },
      ],
      125_000_000
    );

    expect(summary.totalNetCost).toBe(5_000_000);
    expect(summary.totalGrossImpressions).toBe(280_000_000);
    expect(summary.blendedCPM).toBeCloseTo(17.8571, 2);
  });

  it("returns null blendedCPM when total impressions is 0", () => {
    const summary = computePlanSummary(
      [
        { tacticName: "A", reachPercent: 60, grps: 180, inputCost: 5_000_000, grossImpressions: null },
        { tacticName: "B", reachPercent: 30, grps: 120, inputCost: 1_000_000, grossImpressions: null },
      ],
      125_000_000
    );

    expect(summary.totalNetCost).toBe(6_000_000);
    expect(summary.totalGrossImpressions).toBe(0);
    expect(summary.blendedCPM).toBeNull();
  });

  it("backward compatible: works without cost fields", () => {
    const summary = computePlanSummary(
      [
        { tacticName: "A", reachPercent: 60, grps: 180 },
        { tacticName: "B", reachPercent: 30, grps: 120 },
      ],
      125_000_000
    );

    // Cost fields default to 0
    expect(summary.totalNetCost).toBe(0);
    expect(summary.totalGrossImpressions).toBe(0);
    expect(summary.blendedCPM).toBeNull();
    // Existing reach metrics still work
    expect(summary.totalGRPs).toBe(300);
    expect(summary.combinedReachPercent).toBeCloseTo(72, 5);
  });

  // -------------------------------------------------------------------------
  // Channel-subset usage (contract for per-channel subtotals in the UI)
  // -------------------------------------------------------------------------

  it("computes an isolated subtotal for a channel-subset of the plan", () => {
    // Simulate three tactics (two TV + one Digital) and verify that passing
    // just the two TV tactics returns a clean TV-only subtotal — no leakage
    // from the Digital tactic's numbers. This locks in the contract used by
    // the per-channel sections in page.tsx.
    const tvSubtotal = computePlanSummary(
      [
        {
          tacticName: "TV - Morning",
          reachPercent: 45,
          grps: 150,
          inputCost: 3_000_000,
          grossImpressions: 150_000_000,
        },
        {
          tacticName: "TV - Primetime",
          reachPercent: 55,
          grps: 200,
          inputCost: 5_000_000,
          grossImpressions: 180_000_000,
        },
      ],
      125_000_000
    );

    expect(tvSubtotal.totalGRPs).toBe(350);
    // Cost rollup uses ONLY the TV tactics, not the (excluded) Digital one.
    expect(tvSubtotal.totalNetCost).toBe(8_000_000);
    expect(tvSubtotal.totalGrossImpressions).toBe(330_000_000);
    // Blended CPM = 8M / 330M * 1000 ≈ $24.24 — reflects TV economics only.
    expect(tvSubtotal.blendedCPM).toBeCloseTo(24.24, 1);
  });
});
