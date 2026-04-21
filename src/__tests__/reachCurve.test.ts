import { describe, it, expect } from "vitest";
import {
  estimateReachPercent,
  estimateTVReach,
  getReachCurveK,
  getChannelConfig,
  isAutoEstimateChannel,
  CHANNEL_CONFIG,
  TV_CALIBRATION_DEFAULT,
  RADIO_CALIBRATION_DEFAULT,
  PRINT_CALIBRATION_DEFAULT,
  OOH_CALIBRATION_DEFAULT,
  type TVCalibration,
} from "@/lib/math/reachCurve";
import { CHANNELS } from "@/lib/schemas";

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

  it("returns k for Print", () => {
    expect(getReachCurveK("Print")).toBe(PRINT_CALIBRATION_DEFAULT.k);
  });

  it("returns k for OOH", () => {
    expect(getReachCurveK("OOH")).toBe(OOH_CALIBRATION_DEFAULT.k);
  });

  it("returns null for Social", () => {
    expect(getReachCurveK("Social")).toBeNull();
  });

  it("returns null for Other", () => {
    expect(getReachCurveK("Other")).toBeNull();
  });

  it("returns null for unknown channels", () => {
    expect(getReachCurveK("Carrier Pigeon")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Print reach model (uses same function with Print calibration)
// ---------------------------------------------------------------------------

describe("estimateTVReach with Print calibration", () => {
  it("produces lower reach than TV at same GRPs", () => {
    const tvResult = estimateTVReach(200);
    const printResult = estimateTVReach(200, PRINT_CALIBRATION_DEFAULT);
    expect(printResult.reachPercent).toBeLessThan(tvResult.reachPercent);
  });

  it("produces higher frequency than TV at same GRPs", () => {
    const tvResult = estimateTVReach(200);
    const printResult = estimateTVReach(200, PRINT_CALIBRATION_DEFAULT);
    expect(printResult.frequency).toBeGreaterThan(tvResult.frequency);
  });

  it("asymptotes at a low reach ceiling (~50-55%) — Print saturates early", () => {
    const r1000 = estimateTVReach(1000, PRINT_CALIBRATION_DEFAULT).reachPercent;
    const r5000 = estimateTVReach(5000, PRINT_CALIBRATION_DEFAULT).reachPercent;
    // Well below maxReach ceiling due to duplication
    expect(r1000).toBeLessThan(55);
    expect(r5000).toBeLessThan(55);
    // Bounded by maxReach
    expect(r5000).toBeLessThan(PRINT_CALIBRATION_DEFAULT.maxReach * 100);
  });

  it("builds frequency steeply at high GRPs", () => {
    const r500 = estimateTVReach(500, PRINT_CALIBRATION_DEFAULT);
    expect(r500.frequency).toBeGreaterThan(8);
  });

  it("produces reasonable reach at typical Print GRP levels", () => {
    const r100 = estimateTVReach(100, PRINT_CALIBRATION_DEFAULT);
    const r200 = estimateTVReach(200, PRINT_CALIBRATION_DEFAULT);
    // Reference estimates from docstring
    expect(r100.reachPercent).toBeGreaterThan(20);
    expect(r100.reachPercent).toBeLessThan(32);
    expect(r200.reachPercent).toBeGreaterThan(32);
    expect(r200.reachPercent).toBeLessThan(45);
  });
});

// ---------------------------------------------------------------------------
// OOH reach model (uses same function with OOH calibration)
// ---------------------------------------------------------------------------

describe("estimateTVReach with OOH calibration", () => {
  it("produces higher reach than Print at low-to-mid GRPs (OOH builds fast)", () => {
    const oohLow = estimateTVReach(100, OOH_CALIBRATION_DEFAULT).reachPercent;
    const printLow = estimateTVReach(100, PRINT_CALIBRATION_DEFAULT).reachPercent;
    expect(oohLow).toBeGreaterThan(printLow);
  });

  it("frequency climbs aggressively at high GRPs (heavy duplication)", () => {
    const r500 = estimateTVReach(500, OOH_CALIBRATION_DEFAULT);
    const r1000 = estimateTVReach(1000, OOH_CALIBRATION_DEFAULT);
    expect(r500.frequency).toBeGreaterThan(5);
    expect(r1000.frequency).toBeGreaterThan(r500.frequency);
    expect(r1000.frequency).toBeGreaterThan(10);
  });

  it("reach flattens/bounded well under ceiling at high GRPs", () => {
    const r1000 = estimateTVReach(1000, OOH_CALIBRATION_DEFAULT).reachPercent;
    // Bounded by maxReach × (1 - duplication growth saturation)
    expect(r1000).toBeLessThan(OOH_CALIBRATION_DEFAULT.maxReach * 100);
    // Ceiling ends up around 64% due to ~30% duplication at saturation
    expect(r1000).toBeLessThan(75);
  });

  it("produces reasonable reach at typical OOH GRP levels", () => {
    const r100 = estimateTVReach(100, OOH_CALIBRATION_DEFAULT);
    const r200 = estimateTVReach(200, OOH_CALIBRATION_DEFAULT);
    // Reference estimates from docstring: 100 GRPs → ~56%, 200 GRPs → ~64%
    expect(r100.reachPercent).toBeGreaterThan(48);
    expect(r100.reachPercent).toBeLessThan(62);
    expect(r200.reachPercent).toBeGreaterThan(55);
    expect(r200.reachPercent).toBeLessThan(70);
  });

  it("duplication ramps faster than TV (shorter halfLife)", () => {
    // At 100 GRPs, OOH has already realized more duplication than TV
    const tvDup = estimateTVReach(100).duplicationPenalty;
    const oohDup = estimateTVReach(100, OOH_CALIBRATION_DEFAULT).duplicationPenalty;
    expect(oohDup).toBeGreaterThan(tvDup);
  });
});

// ---------------------------------------------------------------------------
// Channel registry — getChannelConfig / isAutoEstimateChannel / coverage
// ---------------------------------------------------------------------------

describe("getChannelConfig", () => {
  it("returns curve config for TV with TV calibration", () => {
    const cfg = getChannelConfig("TV");
    expect(cfg).not.toBeNull();
    expect(cfg!.mode).toBe("curve");
    expect(cfg!.calibration).toBe(TV_CALIBRATION_DEFAULT);
  });

  it("returns curve config for Radio with Radio calibration", () => {
    const cfg = getChannelConfig("Radio");
    expect(cfg!.mode).toBe("curve");
    expect(cfg!.calibration).toBe(RADIO_CALIBRATION_DEFAULT);
  });

  it("returns curve config for Print with Print calibration", () => {
    const cfg = getChannelConfig("Print");
    expect(cfg!.mode).toBe("curve");
    expect(cfg!.calibration).toBe(PRINT_CALIBRATION_DEFAULT);
  });

  it("returns curve config for OOH with OOH calibration", () => {
    const cfg = getChannelConfig("OOH");
    expect(cfg!.mode).toBe("curve");
    expect(cfg!.calibration).toBe(OOH_CALIBRATION_DEFAULT);
  });

  it("returns manual config for Digital with manualOnlyReason", () => {
    const cfg = getChannelConfig("Digital");
    expect(cfg!.mode).toBe("manual");
    expect(cfg!.calibration).toBeUndefined();
    expect(cfg!.manualOnlyReason).toBeTruthy();
    expect(cfg!.manualOnlyReason!.length).toBeGreaterThan(0);
  });

  it("returns manual config for Social with manualOnlyReason", () => {
    const cfg = getChannelConfig("Social");
    expect(cfg!.mode).toBe("manual");
    expect(cfg!.manualOnlyReason).toBeTruthy();
  });

  it("returns manual config for Other with manualOnlyReason", () => {
    const cfg = getChannelConfig("Other");
    expect(cfg!.mode).toBe("manual");
    expect(cfg!.manualOnlyReason).toBeTruthy();
  });

  it("returns null for unknown channels", () => {
    expect(getChannelConfig("Carrier Pigeon")).toBeNull();
    expect(getChannelConfig("")).toBeNull();
  });
});

describe("isAutoEstimateChannel", () => {
  it("returns true for curve channels (TV, Radio, Print, OOH)", () => {
    expect(isAutoEstimateChannel("TV")).toBe(true);
    expect(isAutoEstimateChannel("Radio")).toBe(true);
    expect(isAutoEstimateChannel("Print")).toBe(true);
    expect(isAutoEstimateChannel("OOH")).toBe(true);
  });

  it("returns false for manual channels (Digital, Social, Other)", () => {
    expect(isAutoEstimateChannel("Digital")).toBe(false);
    expect(isAutoEstimateChannel("Social")).toBe(false);
    expect(isAutoEstimateChannel("Other")).toBe(false);
  });

  it("returns false for unknown channels", () => {
    expect(isAutoEstimateChannel("Carrier Pigeon")).toBe(false);
  });
});

describe("CHANNEL_CONFIG registry coverage (regression)", () => {
  it("every channel declared in schemas.CHANNELS has a registry entry", () => {
    // CRITICAL: if this fails, a channel is being shown in the UI but the
    // resolver won't know what to do with it — silent broken behavior.
    for (const channel of CHANNELS) {
      const cfg = CHANNEL_CONFIG[channel];
      expect(cfg, `Missing CHANNEL_CONFIG entry for "${channel}"`).toBeDefined();
      expect(cfg.channel).toBe(channel);
    }
  });

  it("every curve-mode entry has a calibration", () => {
    for (const channel of CHANNELS) {
      const cfg = CHANNEL_CONFIG[channel];
      if (cfg.mode === "curve") {
        expect(cfg.calibration, `curve channel "${channel}" missing calibration`).toBeDefined();
        expect(cfg.calibration!.maxReach).toBeGreaterThan(0);
        expect(cfg.calibration!.maxReach).toBeLessThanOrEqual(1);
        expect(cfg.calibration!.k).toBeGreaterThan(0);
      }
    }
  });

  it("every manual-mode entry has a manualOnlyReason explaining why", () => {
    for (const channel of CHANNELS) {
      const cfg = CHANNEL_CONFIG[channel];
      if (cfg.mode === "manual") {
        expect(cfg.manualOnlyReason, `manual channel "${channel}" missing manualOnlyReason`).toBeTruthy();
        expect(cfg.manualOnlyReason!.length).toBeGreaterThan(20);
      }
    }
  });

  it("each calibrated channel produces valid reach/frequency at 200 GRPs", () => {
    // Sanity check that every calibration is well-formed.
    for (const channel of CHANNELS) {
      const cfg = CHANNEL_CONFIG[channel];
      if (cfg.mode === "curve" && cfg.calibration) {
        const result = estimateTVReach(200, cfg.calibration);
        expect(result.reachPercent, `${channel}: invalid reach`).toBeGreaterThan(0);
        expect(result.reachPercent, `${channel}: reach > 100%`).toBeLessThan(100);
        expect(result.frequency, `${channel}: invalid freq`).toBeGreaterThan(0);
      }
    }
  });
});
