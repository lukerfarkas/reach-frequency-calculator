import { describe, it, expect } from "vitest";
import {
  DMA_LIST,
  DEMO_LIST,
  AUDIENCE_SIZE_MAP,
  lookupAudienceSize,
} from "@/lib/data/dmaAudienceData";

describe("DMA Audience Data", () => {
  it("has US National as the first DMA entry", () => {
    expect(DMA_LIST[0]).toEqual({ code: "0", name: "US National" });
  });

  it("has at least 200 DMA entries", () => {
    expect(DMA_LIST.length).toBeGreaterThanOrEqual(200);
  });

  it("has 12 demographic breaks", () => {
    expect(DEMO_LIST).toHaveLength(12);
  });

  it("every DMA has entries for all demos in the map", () => {
    for (const dma of DMA_LIST) {
      for (const demo of DEMO_LIST) {
        const key = `${dma.code}|${demo.id}`;
        expect(AUDIENCE_SIZE_MAP[key]).toBeDefined();
        expect(AUDIENCE_SIZE_MAP[key]).toBeGreaterThan(0);
      }
    }
  });

  it("all audience sizes are positive integers", () => {
    for (const [key, value] of Object.entries(AUDIENCE_SIZE_MAP)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it("US National Adults 18+ is reasonable (200M-350M)", () => {
    const val = lookupAudienceSize("0", "a18plus");
    expect(val).not.toBeNull();
    expect(val!).toBeGreaterThan(200_000_000);
    expect(val!).toBeLessThan(350_000_000);
  });

  it("US National Households is reasonable (100M-180M)", () => {
    const val = lookupAudienceSize("0", "hh");
    expect(val).not.toBeNull();
    expect(val!).toBeGreaterThan(100_000_000);
    expect(val!).toBeLessThan(180_000_000);
  });

  it("lookupAudienceSize returns correct values", () => {
    const key = `${DMA_LIST[0].code}|${DEMO_LIST[0].id}`;
    expect(lookupAudienceSize(DMA_LIST[0].code, DEMO_LIST[0].id)).toBe(
      AUDIENCE_SIZE_MAP[key]
    );
  });

  it("lookupAudienceSize returns null for unknown combos", () => {
    expect(lookupAudienceSize("99999", "a18plus")).toBeNull();
    expect(lookupAudienceSize("0", "nonexistent")).toBeNull();
  });

  it("DMA names are properly title-cased", () => {
    for (const dma of DMA_LIST) {
      // First character should be uppercase
      expect(dma.name.charAt(0)).toBe(dma.name.charAt(0).toUpperCase());
    }
  });
});
