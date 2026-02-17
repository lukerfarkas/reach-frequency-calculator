import { describe, it, expect } from "vitest";
import { tacticInputSchema, validateCombinableGroup } from "@/lib/schemas";

describe("tacticInputSchema", () => {
  const validBase = {
    id: "test-1",
    tacticName: "TV Spot",
    geoName: "US National",
    audienceName: "Adults 25-54",
    audienceSize: 125_000_000,
    channel: "TV",
    grps: 160,
  };

  it("accepts valid input with GRPs", () => {
    const result = tacticInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("accepts valid input with Cost + CPM", () => {
    const result = tacticInputSchema.safeParse({
      ...validBase,
      grps: null,
      cost: 5_000_000,
      cpm: 25,
    });
    expect(result.success).toBe(true);
  });

  it("accepts Reach% only", () => {
    const result = tacticInputSchema.safeParse({
      ...validBase,
      grps: null,
      reachPercent: 45,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing tactic name", () => {
    const result = tacticInputSchema.safeParse({
      ...validBase,
      tacticName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing geo", () => {
    const result = tacticInputSchema.safeParse({
      ...validBase,
      geoName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero audience size", () => {
    const result = tacticInputSchema.safeParse({
      ...validBase,
      audienceSize: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative CPM", () => {
    const result = tacticInputSchema.safeParse({
      ...validBase,
      grps: null,
      cost: 1000,
      cpm: -5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects reach > 100", () => {
    const result = tacticInputSchema.safeParse({
      ...validBase,
      grps: null,
      reachPercent: 110,
    });
    expect(result.success).toBe(false);
  });

  it("rejects no input set provided", () => {
    const result = tacticInputSchema.safeParse({
      id: "test-1",
      tacticName: "TV Spot",
      geoName: "US National",
      audienceName: "Adults 25-54",
      audienceSize: 125_000_000,
      channel: "TV",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid channel", () => {
    const result = tacticInputSchema.safeParse({
      ...validBase,
      channel: "Podcast",
    });
    expect(result.success).toBe(false);
  });
});

describe("validateCombinableGroup", () => {
  it("allows tactics with same geo and audience size", () => {
    const result = validateCombinableGroup([
      { geoName: "US", audienceName: "A25-54", audienceSize: 125_000_000, tacticName: "TV" },
      { geoName: "US", audienceName: "A25-54", audienceSize: 125_000_000, tacticName: "Digital" },
    ]);
    expect(result.valid).toBe(true);
  });

  it("blocks tactics with different geos", () => {
    const result = validateCombinableGroup([
      { geoName: "US National", audienceName: "A25-54", audienceSize: 125_000_000, tacticName: "TV" },
      { geoName: "NY DMA", audienceName: "A25-54", audienceSize: 125_000_000, tacticName: "Radio" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("different geographies");
    expect(result.error).toContain("US National");
    expect(result.error).toContain("NY DMA");
  });

  it("blocks tactics with different audience sizes", () => {
    const result = validateCombinableGroup([
      { geoName: "US", audienceName: "A25-54", audienceSize: 125_000_000, tacticName: "TV" },
      { geoName: "US", audienceName: "A18-49", audienceSize: 100_000_000, tacticName: "Digital" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("different audience sizes");
  });

  it("allows single tactic", () => {
    const result = validateCombinableGroup([
      { geoName: "US", audienceName: "A25-54", audienceSize: 125_000_000, tacticName: "TV" },
    ]);
    expect(result.valid).toBe(true);
  });

  it("allows empty array", () => {
    const result = validateCombinableGroup([]);
    expect(result.valid).toBe(true);
  });
});
