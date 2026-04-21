import { describe, it, expect } from "vitest";
import { resolveTactic } from "@/lib/math/resolver";
import { CHANNELS } from "@/lib/schemas";

describe("resolveTactic", () => {
  const baseInput = {
    tacticName: "Test Tactic",
    geoName: "US National",
    audienceName: "Adults 25-54",
    audienceSize: 125_000_000,
    channel: "Digital" as const,
  };

  it("resolves from Cost + CPM", () => {
    const result = resolveTactic({
      ...baseInput,
      cost: 5_000_000,
      cpm: 25,
    });

    // Impressions = 5M / 25 * 1000 = 200M
    expect(result.grossImpressions).toBe(200_000_000);
    // GRPs = 200M / 125M * 100 = 160
    expect(result.grps).toBe(160);
    expect(result.errors).toHaveLength(0);
    // No reach/frequency since we don't have either
    expect(result.reachPercent).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("resolves from Gross Impressions", () => {
    const result = resolveTactic({
      ...baseInput,
      grossImpressions: 80_000_000,
    });

    // GRPs = 80M / 125M * 100 = 64
    expect(result.grps).toBe(64);
    expect(result.grossImpressions).toBe(80_000_000);
    expect(result.errors).toHaveLength(0);
  });

  it("resolves from GRPs directly", () => {
    const result = resolveTactic({
      ...baseInput,
      grps: 160,
    });

    expect(result.grps).toBe(160);
    expect(result.grossImpressions).toBe(200_000_000);
  });

  it("resolves from Reach% + Frequency", () => {
    const result = resolveTactic({
      ...baseInput,
      reachPercent: 30,
      frequency: 4,
    });

    // GRPs = 30 * 4 = 120
    expect(result.grps).toBe(120);
    expect(result.reachPercent).toBe(30);
    expect(result.frequency).toBe(4);
    expect(result.reachNum).toBe(37_500_000);
    expect(result.isFullyResolved).toBe(true);
    expect(result.effective3Plus).not.toBeNull();
  });

  it("resolves from Reach% only (partial)", () => {
    const result = resolveTactic({
      ...baseInput,
      reachPercent: 45,
    });

    expect(result.reachPercent).toBe(45);
    expect(result.reachNum).toBe(56_250_000);
    expect(result.grps).toBeNull();
    expect(result.frequency).toBeNull();
    expect(result.isFullyResolved).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("errors when no inputs provided", () => {
    const result = resolveTactic(baseInput);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("errors when reach exceeds 100%", () => {
    // frequency = 0.5, GRPs from cost = 160 → reach = 160 / 0.5 = 320%
    const result = resolveTactic({
      ...baseInput,
      cost: 5_000_000,
      cpm: 25,
      frequency: 0.5,
    });
    expect(result.errors.some((e) => e.includes("exceeds 100%"))).toBe(true);
  });

  it("computes effective 3+ with GRPs + reach", () => {
    const result = resolveTactic({
      ...baseInput,
      reachPercent: 60,
      frequency: 5,
    });

    // GRPs = 300, λ = 3
    expect(result.grps).toBe(300);
    expect(result.effective3Plus).not.toBeNull();
    expect(result.effective3Plus!.effective3PlusPercent).toBeCloseTo(57.68, 1);
  });

  // --- TV Reach Curve tests ---

  const tvInput = { ...baseInput, channel: "TV" };

  it("auto-estimates Reach% for TV when GRPs known but no Reach/Frequency", () => {
    const result = resolveTactic({ ...tvInput, grps: 200 });
    // Calibrated TV model: 200 GRPs → ~64.8% reach, ~3.09× freq
    // (lower reach / higher frequency than legacy exponential model)
    expect(result.reachPercent).toBeCloseTo(64.8, 0);
    expect(result.reachPercentEstimated).toBe(true);
    expect(result.frequency).toBeCloseTo(3.09, 0);
    expect(result.isFullyResolved).toBe(true);
    expect(result.effective3Plus).not.toBeNull();
    // Effective 3+ should use adjusted lambda (= frequency), not naive GRPs/100
    expect(result.effective3Plus!.lambda).toBeCloseTo(result.frequency!, 1);
  });

  it("does NOT auto-estimate Reach% for Digital channel", () => {
    const result = resolveTactic({ ...baseInput, grps: 200 });
    expect(result.reachPercent).toBeNull();
    expect(result.reachPercentEstimated).toBe(false);
    expect(result.isFullyResolved).toBe(false);
  });

  it("uses user-provided Reach% over estimate for TV", () => {
    const result = resolveTactic({ ...tvInput, grps: 200, reachPercent: 75 });
    expect(result.reachPercent).toBe(75);
    expect(result.reachPercentEstimated).toBe(false);
    expect(result.frequency).toBeCloseTo(200 / 75, 1);
  });

  it("auto-estimates Reach% for TV from Cost+CPM derived GRPs", () => {
    const result = resolveTactic({ ...tvInput, cost: 5_000_000, cpm: 25 });
    // GRPs = 160, Calibrated TV model: ~59.4% reach
    expect(result.grps).toBe(160);
    expect(result.reachPercent).toBeCloseTo(59.4, 0);
    expect(result.reachPercentEstimated).toBe(true);
    expect(result.isFullyResolved).toBe(true);
  });

  it("reachPercentEstimated is false when Reach%+Frequency provided for TV", () => {
    const result = resolveTactic({ ...tvInput, reachPercent: 60, frequency: 5 });
    expect(result.reachPercent).toBe(60);
    expect(result.reachPercentEstimated).toBe(false);
  });

  // --- Radio Reach Curve tests ---

  const radioInput = { ...baseInput, channel: "Radio" };

  it("auto-estimates Reach% for Radio when GRPs known", () => {
    const result = resolveTactic({ ...radioInput, grps: 200 });
    expect(result.reachPercent).toBeCloseTo(58.5, 0);
    expect(result.reachPercentEstimated).toBe(true);
    expect(result.frequency).toBeCloseTo(3.42, 0);
    expect(result.isFullyResolved).toBe(true);
    // Effective 3+ uses adjusted frequency as lambda
    expect(result.effective3Plus).not.toBeNull();
    expect(result.effective3Plus!.lambda).toBeCloseTo(result.frequency!, 1);
  });

  it("Radio reach is lower than TV reach at same GRPs", () => {
    const tvResult = resolveTactic({ ...tvInput, grps: 200 });
    const radioResult = resolveTactic({ ...radioInput, grps: 200 });
    expect(radioResult.reachPercent!).toBeLessThan(tvResult.reachPercent!);
    expect(radioResult.frequency!).toBeGreaterThan(tvResult.frequency!);
  });

  it("uses user-provided Reach% over estimate for Radio", () => {
    const result = resolveTactic({ ...radioInput, grps: 200, reachPercent: 50 });
    expect(result.reachPercent).toBe(50);
    expect(result.reachPercentEstimated).toBe(false);
  });

  // --- Print Reach Curve tests ---

  const printInput = { ...baseInput, channel: "Print" };

  it("auto-estimates Reach% for Print when GRPs known", () => {
    const result = resolveTactic({ ...printInput, grps: 200 });
    expect(result.reachPercent).not.toBeNull();
    expect(result.reachPercent!).toBeGreaterThan(32);
    expect(result.reachPercent!).toBeLessThan(45);
    expect(result.reachPercentEstimated).toBe(true);
    expect(result.isFullyResolved).toBe(true);
    // Effective 3+ uses adjusted frequency as lambda
    expect(result.effective3Plus).not.toBeNull();
    expect(result.effective3Plus!.lambda).toBeCloseTo(result.frequency!, 1);
  });

  it("Print reach is lower than TV reach at same GRPs", () => {
    const tvResult = resolveTactic({ ...tvInput, grps: 200 });
    const printResult = resolveTactic({ ...printInput, grps: 200 });
    expect(printResult.reachPercent!).toBeLessThan(tvResult.reachPercent!);
    expect(printResult.frequency!).toBeGreaterThan(tvResult.frequency!);
  });

  it("auto-estimates Reach% for Print from Cost+CPM derived GRPs", () => {
    const result = resolveTactic({ ...printInput, cost: 5_000_000, cpm: 25 });
    // GRPs = 160
    expect(result.grps).toBe(160);
    expect(result.reachPercentEstimated).toBe(true);
    expect(result.isFullyResolved).toBe(true);
  });

  it("uses user-provided Reach% over estimate for Print", () => {
    const result = resolveTactic({ ...printInput, grps: 200, reachPercent: 25 });
    expect(result.reachPercent).toBe(25);
    expect(result.reachPercentEstimated).toBe(false);
  });

  // --- OOH Reach Curve tests ---

  const oohInput = { ...baseInput, channel: "OOH" };

  it("auto-estimates Reach% for OOH when GRPs known", () => {
    const result = resolveTactic({ ...oohInput, grps: 200 });
    expect(result.reachPercent).not.toBeNull();
    expect(result.reachPercent!).toBeGreaterThan(55);
    expect(result.reachPercent!).toBeLessThan(70);
    expect(result.reachPercentEstimated).toBe(true);
    expect(result.isFullyResolved).toBe(true);
    // Effective 3+ uses adjusted frequency as lambda
    expect(result.effective3Plus).not.toBeNull();
    expect(result.effective3Plus!.lambda).toBeCloseTo(result.frequency!, 1);
  });

  it("OOH reach builds fast at low GRPs", () => {
    // At 100 GRPs OOH should have high reach due to steep k and high ceiling
    const r100 = resolveTactic({ ...oohInput, grps: 100 });
    expect(r100.reachPercent!).toBeGreaterThan(45);
  });

  it("uses user-provided Reach% over estimate for OOH", () => {
    const result = resolveTactic({ ...oohInput, grps: 200, reachPercent: 80 });
    expect(result.reachPercent).toBe(80);
    expect(result.reachPercentEstimated).toBe(false);
  });

  // --- Manual-only channels (Digital, Social, Other) ---

  it("Digital with GRPs-only produces explicit manual-only warning", () => {
    const result = resolveTactic({ ...baseInput, channel: "Digital", grps: 200 });
    expect(result.reachPercent).toBeNull();
    expect(result.reachPercentEstimated).toBe(false);
    expect(result.isFullyResolved).toBe(false);
    // Warning must mention both the channel AND "cannot be auto-estimated"
    expect(
      result.warnings.some(
        (w) => w.includes("Digital") && w.includes("cannot be auto-estimated")
      )
    ).toBe(true);
  });

  it("Social with GRPs-only produces explicit manual-only warning", () => {
    const result = resolveTactic({ ...baseInput, channel: "Social", grps: 200 });
    expect(result.reachPercent).toBeNull();
    expect(result.isFullyResolved).toBe(false);
    expect(
      result.warnings.some(
        (w) => w.includes("Social") && w.includes("cannot be auto-estimated")
      )
    ).toBe(true);
  });

  it("Other with GRPs-only produces explicit manual-only warning", () => {
    const result = resolveTactic({ ...baseInput, channel: "Other", grps: 200 });
    expect(result.reachPercent).toBeNull();
    expect(result.isFullyResolved).toBe(false);
    expect(
      result.warnings.some(
        (w) => w.includes("Other") && w.includes("cannot be auto-estimated")
      )
    ).toBe(true);
  });

  it("manual-only channel with user-provided Reach%+Frequency still resolves fully", () => {
    const result = resolveTactic({
      ...baseInput,
      channel: "Social",
      reachPercent: 40,
      frequency: 3,
    });
    expect(result.reachPercent).toBe(40);
    expect(result.frequency).toBe(3);
    expect(result.grps).toBe(120);
    expect(result.isFullyResolved).toBe(true);
    expect(result.reachPercentEstimated).toBe(false);
  });

  // --- Registry coverage regression ---

  describe("every declared channel is handled by resolver (coverage regression)", () => {
    // For each channel in CHANNELS, the resolver MUST either:
    //   - auto-estimate Reach% (for curve channels), or
    //   - emit an explicit manual-only warning (for manual channels).
    // No channel should silently produce null reach with no guidance.
    for (const channel of CHANNELS) {
      it(`${channel}: GRPs-only either resolves R&F or warns explicitly`, () => {
        const result = resolveTactic({ ...baseInput, channel, grps: 200 });
        const didAutoEstimate =
          result.reachPercentEstimated && result.reachPercent != null;
        const hasExplicitManualWarning = result.warnings.some(
          (w) => w.includes(channel) && w.includes("cannot be auto-estimated")
        );
        expect(
          didAutoEstimate || hasExplicitManualWarning,
          `channel "${channel}" neither auto-estimates R&F nor warns explicitly`
        ).toBe(true);
      });
    }
  });
});
