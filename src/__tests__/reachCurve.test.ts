import { describe, it, expect } from "vitest";
import { estimateReachPercent, getReachCurveK } from "@/lib/math/reachCurve";

describe("estimateReachPercent", () => {
  it("returns 0% for 0 GRPs", () => {
    expect(estimateReachPercent(0)).toBe(0);
  });

  it("returns ~63.21% for 100 GRPs (1 - e^-1)", () => {
    expect(estimateReachPercent(100)).toBeCloseTo(63.21, 1);
  });

  it("returns ~86.47% for 200 GRPs (1 - e^-2)", () => {
    expect(estimateReachPercent(200)).toBeCloseTo(86.47, 1);
  });

  it("returns ~95.02% for 300 GRPs (1 - e^-3)", () => {
    expect(estimateReachPercent(300)).toBeCloseTo(95.02, 1);
  });

  it("approaches but never reaches 100%", () => {
    const result = estimateReachPercent(1000);
    expect(result).toBeGreaterThan(99);
    expect(result).toBeLessThan(100);
  });

  it("shows diminishing returns at higher GRPs", () => {
    const reach100 = estimateReachPercent(100);
    const reach200 = estimateReachPercent(200);
    const reach300 = estimateReachPercent(300);
    const gain1 = reach200 - reach100;
    const gain2 = reach300 - reach200;
    expect(gain1).toBeGreaterThan(gain2); // diminishing returns
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
    // Higher k = steeper curve = higher reach at same GRPs
    expect(k05).toBeLessThan(k10);
    expect(k10).toBeLessThan(k20);
  });
});

describe("getReachCurveK", () => {
  it("returns 1.0 for TV", () => {
    expect(getReachCurveK("TV")).toBe(1.0);
  });

  it("returns null for Digital", () => {
    expect(getReachCurveK("Digital")).toBeNull();
  });

  it("returns null for Radio", () => {
    expect(getReachCurveK("Radio")).toBeNull();
  });

  it("returns null for Social", () => {
    expect(getReachCurveK("Social")).toBeNull();
  });

  it("returns null for unknown channels", () => {
    expect(getReachCurveK("Carrier Pigeon")).toBeNull();
  });
});
