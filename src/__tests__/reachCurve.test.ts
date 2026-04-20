import { describe, it, expect } from "vitest";
import {
  estimateReachPercent,
  estimateTVReach,
  getReachCurveK,
  TV_CALIBRATION_DEFAULT,
  RADIO_CALIBRATION_DEFAULT,
  type TVCalibration,
} from "@/lib/math/reachCurve";

// ---------------------------------------------------------------------------
// Legacy estimateReachPercent (simple exponential, no ceiling)
// ---------------------------------------------------------------------------

describe("estimateReachPercent (legacy)", () => {
  it("returns 0% for 0 GRPs", () => {
    expect(estimateReachPercent(0)).toBe(0);
  });

  it("returns ~63.21% for 100 GRPs with k=1.0 (1 - e^-1)", () => {
    expect(estimateReachPercent(100, 1.0)).toBeCloseTo(63.21, 1);
  });

  it("shows diminishing returns at higher GRPs", () => {
    const reach100 = estimateReachPercent(100);
    const reach200 = estimateReachPercent(200);
    const reach300 = estimateReachPercent(300);
    const gain1 = reach200 - reach100;
    const gain2 = reach300 - reach200;
    expect(gain1).toBeGreaterThan(gain2);
  });

  it("throws on negative GRPs", () => {
    expect(() => estimateReachPercent(-10)).toThrow("GRPs cannot be negative");
  });

  it("throws on non-positive k", () => {
    expect(() => estimateReachPercent(100, 0)).toThrow("k must be positive");
    expect(() => estimateReachPercent(100, -1)).toThrow("k must be positive");
  });

  it("accepts a custom k parameter", () => {
    const k05 = estimateReachPercent(100, 0.5);
    const k10 = estimateReachPercent(100, 1.0);
    const k20 = estimateReachPercent(100, 2.0);
    expect(k05).toBeLessThan(k10);
    expect(k10).toBeLessThan(k20);
  });
});

// ---------------------------------------------------------------------------
// Calibrated TV Reach Model — estimateTVReach
// ---------------------------------------------------------------------------

describe("estimateTVReach", () => {
  it("returns 0% reach and 0 frequency for 0 GRPs", () => {
    const result = estimateTVReach(0);
    expect(result.reachPercent).toBe(0);
    expect(result.frequency).toBe(0);
    expect(result.effectiveLambda).toBe(0);
  });

  it("produces lower reach than legacy model at 100 GRPs", () => {
    const tvResult = estimateTVReach(100);
    const legacyReach = estimateReachPercent(100, 1.0);
    expect(tvResult.reachPercent).toBeLessThan(legacyReach);
    expect(tvResult.reachPercent).toBeCloseTo(46.7, 0);
  });

  it("produces lower reach than legacy model at 200 GRPs", () => {
    const tvResult = estimateTVReach(200);
    const legacyReach = estimateReachPercent(200, 1.0);
    expect(tvResult.reachPercent).toBeLessThan(legacyReach);
    expect(tvResult.reachPercent).toBeCloseTo(64.8, 0);
  });

  it("produces higher frequency than legacy model at 200 GRPs", () => {
    const tvResult = estimateTVReach(200);
    const legacyReach = estimateReachPercent(200, 1.0);
    const legacyFreq = 200 / legacyReach;
    expect(tvResult.frequency).toBeGreaterThan(legacyFreq);
    expect(tvResult.frequency).toBeCloseTo(3.09, 1);
  });

  // --- Diminishing returns ---

  it("reach increases with GRPs but flattens over time", () => {
    const r100 = estimateTVReach(100).reachPercent;
    const r200 = estimateTVReach(200).reachPercent;
    const r300 = estimateTVReach(300).reachPercent;
    const r500 = estimateTVReach(500).reachPercent;

    // All increasing
    expect(r200).toBeGreaterThan(r100);
    expect(r300).toBeGreaterThan(r200);
    expect(r500).toBeGreaterThan(r300);

    // Diminishing gains
    const gain1 = r200 - r100;
    const gain2 = r300 - r200;
    const gain3 = r500 - r300;
    expect(gain1).toBeGreaterThan(gain2);
    expect(gain2).toBeGreaterThan(gain3);
  });

  it("frequency increases as GRPs rise", () => {
    const f100 = estimateTVReach(100).frequency;
    const f200 = estimateTVReach(200).frequency;
    const f300 = estimateTVReach(300).frequency;
    const f500 = estimateTVReach(500).frequency;

    expect(f200).toBeGreaterThan(f100);
    expect(f300).toBeGreaterThan(f200);
    expect(f500).toBeGreaterThan(f300);
  });

  // --- Reach ceiling ---

  it("reach does not approach 100% unrealistically", () => {
    const r500 = estimateTVReach(500).reachPercent;
    const r1000 = estimateTVReach(1000).reachPercent;

    // Should be well below 100% even at very high GRPs
    expect(r500).toBeLessThan(90);
    expect(r1000).toBeLessThan(90);

    // Should be bounded by maxReach ceiling
    expect(r1000).toBeLessThan(TV_CALIBRATION_DEFAULT.maxReach * 100);
  });

  it("reach is bounded by maxReach × (1 - duplication)", () => {
    const result = estimateTVReach(10000); // extreme GRPs
    const maxPossible = TV_CALIBRATION_DEFAULT.maxReach * 100;
    expect(result.reachPercent).toBeLessThan(maxPossible);
    expect(result.reachPercent).toBeGreaterThan(0);
  });

  // --- Duplication ---

  it("duplication penalty increases with GRPs", () => {
    const d100 = estimateTVReach(100).duplicationPenalty;
    const d300 = estimateTVReach(300).duplicationPenalty;
    const d500 = estimateTVReach(500).duplicationPenalty;

    expect(d300).toBeGreaterThan(d100);
    expect(d500).toBeGreaterThan(d300);
  });

  it("raw reach is always higher than adjusted reach", () => {
    for (const grps of [50, 100, 200, 500]) {
      const result = estimateTVReach(grps);
      expect(result.rawReachPercent).toBeGreaterThan(result.reachPercent);
    }
  });

  // --- Calibration tuning ---

  it("changing maxReach materially changes output", () => {
    const defaultResult = estimateTVReach(200);
    const lowerCeiling: TVCalibration = { ...TV_CALIBRATION_DEFAULT, maxReach: 0.75 };
    const higherCeiling: TVCalibration = { ...TV_CALIBRATION_DEFAULT, maxReach: 0.95 };

    const lower = estimateTVReach(200, lowerCeiling);
    const higher = estimateTVReach(200, higherCeiling);

    expect(lower.reachPercent).toBeLessThan(defaultResult.reachPercent);
    expect(higher.reachPercent).toBeGreaterThan(defaultResult.reachPercent);
  });

  it("changing k materially changes output", () => {
    const defaultResult = estimateTVReach(200);
    const slowerK: TVCalibration = { ...TV_CALIBRATION_DEFAULT, k: 0.005 };
    const fasterK: TVCalibration = { ...TV_CALIBRATION_DEFAULT, k: 0.012 };

    const slower = estimateTVReach(200, slowerK);
    const faster = estimateTVReach(200, fasterK);

    expect(slower.reachPercent).toBeLessThan(defaultResult.reachPercent);
    expect(faster.reachPercent).toBeGreaterThan(defaultResult.reachPercent);
  });

  it("changing duplication parameters shifts output toward lower reach / higher frequency", () => {
    const baseline = estimateTVReach(200);
    const moreDuplication: TVCalibration = {
      ...TV_CALIBRATION_DEFAULT,
      duplicationBase: 0.08,
      duplicationGrowth: 0.20,
    };

    const adjusted = estimateTVReach(200, moreDuplication);

    expect(adjusted.reachPercent).toBeLessThan(baseline.reachPercent);
    expect(adjusted.frequency).toBeGreaterThan(baseline.frequency);
  });

  // --- Effective lambda ---

  it("effective lambda equals average frequency", () => {
    const result = estimateTVReach(200);
    expect(result.effectiveLambda).toBeCloseTo(result.frequency, 5);
  });

  it("effective lambda is higher than naive GRPs/100", () => {
    const result = estimateTVReach(200);
    const naiveLambda = 200 / 100;
    expect(result.effectiveLambda).toBeGreaterThan(naiveLambda);
  });

  // --- TV vs old model comparison ---

  it("TV outputs shift toward lower reach / higher frequency relative to prior logic", () => {
    // Compare at multiple GRP levels
    for (const grps of [100, 160, 200, 300]) {
      const tv = estimateTVReach(grps);
      const oldReach = estimateReachPercent(grps, 1.0); // old model
      const oldFreq = grps / oldReach;

      expect(tv.reachPercent).toBeLessThan(oldReach);
      expect(tv.frequency).toBeGreaterThan(oldFreq);
    }
  });

  // --- Validation ---

  it("throws on negative GRPs", () => {
    expect(() => estimateTVReach(-10)).toThrow("GRPs cannot be negative");
  });

  it("throws on invalid maxReach", () => {
    expect(() => estimateTVReach(100, { ...TV_CALIBRATION_DEFAULT, maxReach: 0 })).toThrow();
    expect(() => estimateTVReach(100, { ...TV_CALIBRATION_DEFAULT, maxReach: 1.5 })).toThrow();
  });

  it("throws on non-positive k", () => {
    expect(() => estimateTVReach(100, { ...TV_CALIBRATION_DEFAULT, k: 0 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Radio reach model (uses same function with Radio calibration)
// ---------------------------------------------------------------------------

describe("estimateTVReach with Radio calibration", () => {
  it("produces lower reach than TV at same GRPs", () => {
    const tvResult = estimateTVReach(200);
    const radioResult = estimateTVReach(200, RADIO_CALIBRATION_DEFAULT);
    expect(radioResult.reachPercent).toBeLessThan(tvResult.reachPercent);
  });

  it("produces higher frequency than TV at same GRPs", () => {
    const tvResult = estimateTVReach(200);
    const radioResult = estimateTVReach(200, RADIO_CALIBRATION_DEFAULT);
    expect(radioResult.frequency).toBeGreaterThan(tvResult.frequency);
  });

  it("has a lower effective ceiling than TV", () => {
    const radioHigh = estimateTVReach(1000, RADIO_CALIBRATION_DEFAULT);
    const tvHigh = estimateTVReach(1000);
    expect(radioHigh.reachPercent).toBeLessThan(tvHigh.reachPercent);
    expect(radioHigh.reachPercent).toBeLessThan(75); // Radio ceiling is lower
  });

  it("produces reasonable reach at typical Radio GRP levels", () => {
    const r719 = estimateTVReach(719, RADIO_CALIBRATION_DEFAULT);
    expect(r719.reachPercent).toBeGreaterThan(60);
    expect(r719.reachPercent).toBeLessThan(80);
    expect(r719.frequency).toBeGreaterThan(8);
  });
});

// ---------------------------------------------------------------------------
// getReachCurveK
// ---------------------------------------------------------------------------

describe("getReachCurveK", () => {
  it("returns calibrated k for TV", () => {
    expect(getReachCurveK("TV")).toBe(TV_CALIBRATION_DEFAULT.k);
  });

  it("returns null for Digital", () => {
    expect(getReachCurveK("Digital")).toBeNull();
  });

  it("returns k for Radio", () => {
    expect(getReachCurveK("Radio")).toBe(0.008);
  });

  it("returns null for Social", () => {
    expect(getReachCurveK("Social")).toBeNull();
  });

  it("returns null for unknown channels", () => {
    expect(getReachCurveK("Carrier Pigeon")).toBeNull();
  });
});
