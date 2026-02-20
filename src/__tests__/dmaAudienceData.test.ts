import { describe, it, expect } from "vitest";
import {
  DMA_LIST,
  AGE_CELL_RANGES,
  DMA_CELLS,
  AGE_SNAP_POINTS,
  computeAudienceSize,
  getHouseholds,
  formatDemoLabel,
} from "@/lib/data/dmaAudienceData";

describe("DMA Audience Data", () => {
  it("has US National as the first DMA entry", () => {
    expect(DMA_LIST[0]).toEqual({ code: "0", name: "US National" });
  });

  it("has at least 200 DMA entries", () => {
    expect(DMA_LIST.length).toBeGreaterThanOrEqual(200);
  });

  it("has 17 age cell ranges", () => {
    expect(AGE_CELL_RANGES).toHaveLength(17);
  });

  it("age cell ranges start at 18 and end at 999 (85+)", () => {
    expect(AGE_CELL_RANGES[0][0]).toBe(18);
    expect(AGE_CELL_RANGES[AGE_CELL_RANGES.length - 1][1]).toBe(999);
  });

  it("every DMA has male, female, and household data", () => {
    for (const dma of DMA_LIST) {
      const cells = DMA_CELLS[dma.code];
      expect(cells).toBeDefined();
      expect(cells.m).toHaveLength(AGE_CELL_RANGES.length);
      expect(cells.f).toHaveLength(AGE_CELL_RANGES.length);
      expect(cells.hh).toBeGreaterThan(0);
    }
  });

  it("all cell values are non-negative integers", () => {
    for (const dma of DMA_LIST) {
      const cells = DMA_CELLS[dma.code];
      for (let i = 0; i < AGE_CELL_RANGES.length; i++) {
        expect(Number.isInteger(cells.m[i])).toBe(true);
        expect(cells.m[i]).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(cells.f[i])).toBe(true);
        expect(cells.f[i]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("US National Adults 18+ is reasonable (200M-350M)", () => {
    const val = computeAudienceSize("0", 18, 999, "adults");
    expect(val).not.toBeNull();
    expect(val!).toBeGreaterThan(200_000_000);
    expect(val!).toBeLessThan(350_000_000);
  });

  it("US National Households is reasonable (100M-180M)", () => {
    const val = getHouseholds("0");
    expect(val).not.toBeNull();
    expect(val!).toBeGreaterThan(100_000_000);
    expect(val!).toBeLessThan(180_000_000);
  });

  it("computeAudienceSize returns null for unknown DMA", () => {
    expect(computeAudienceSize("99999", 18, 999, "adults")).toBeNull();
  });

  it("males + females = adults for any range", () => {
    const males = computeAudienceSize("0", 25, 54, "males");
    const females = computeAudienceSize("0", 25, 54, "females");
    const adults = computeAudienceSize("0", 25, 54, "adults");
    expect(males! + females!).toBe(adults!);
  });

  it("narrower age range returns smaller audience", () => {
    const wide = computeAudienceSize("0", 18, 999, "adults")!;
    const narrow = computeAudienceSize("0", 25, 54, "adults")!;
    expect(narrow).toBeLessThan(wide);
    expect(narrow).toBeGreaterThan(0);
  });

  it("AGE_SNAP_POINTS matches cell range boundaries", () => {
    expect(AGE_SNAP_POINTS).toHaveLength(AGE_CELL_RANGES.length);
    for (let i = 0; i < AGE_CELL_RANGES.length; i++) {
      expect(AGE_SNAP_POINTS[i]).toBe(AGE_CELL_RANGES[i][0]);
    }
  });

  it("DMA names are properly title-cased", () => {
    for (const dma of DMA_LIST) {
      expect(dma.name.charAt(0)).toBe(dma.name.charAt(0).toUpperCase());
    }
  });
});

describe("formatDemoLabel", () => {
  it("formats adults range", () => {
    expect(formatDemoLabel("adults", 18, 999)).toBe("Adults 18+");
    expect(formatDemoLabel("adults", 25, 54)).toBe("Adults 25-54");
  });

  it("formats males range", () => {
    expect(formatDemoLabel("males", 18, 49)).toBe("Males 18-49");
  });

  it("formats females range", () => {
    expect(formatDemoLabel("females", 25, 54)).toBe("Females 25-54");
  });

  it("formats 85+ correctly", () => {
    expect(formatDemoLabel("adults", 85, 999)).toBe("Adults 85+");
  });
});
