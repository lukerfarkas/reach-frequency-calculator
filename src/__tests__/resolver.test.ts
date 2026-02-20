import { describe, it, expect } from "vitest";
import { resolveTactic } from "@/lib/math/resolver";

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
    // Reach% = 100 * (1 - e^-2) ≈ 86.47%
    expect(result.reachPercent).toBeCloseTo(86.47, 1);
    expect(result.reachPercentEstimated).toBe(true);
    expect(result.frequency).toBeCloseTo(200 / 86.47, 0);
    expect(result.isFullyResolved).toBe(true);
    expect(result.effective3Plus).not.toBeNull();
  });

  it("does NOT auto-estimate Reach% for non-TV channels", () => {
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
    // GRPs = 160, Reach% = 100 * (1 - e^-1.6) ≈ 79.81%
    expect(result.grps).toBe(160);
    expect(result.reachPercent).toBeCloseTo(79.81, 1);
    expect(result.reachPercentEstimated).toBe(true);
    expect(result.isFullyResolved).toBe(true);
  });

  it("reachPercentEstimated is false when Reach%+Frequency provided for TV", () => {
    const result = resolveTactic({ ...tvInput, reachPercent: 60, frequency: 5 });
    expect(result.reachPercent).toBe(60);
    expect(result.reachPercentEstimated).toBe(false);
  });
});
