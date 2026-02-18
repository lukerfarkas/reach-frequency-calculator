import { describe, it, expect } from "vitest";
import { analyzeRowInputs } from "@/lib/inputStatus";

const empty = {
  grps: "",
  grossImpressions: "",
  cost: "",
  cpm: "",
  reachPercent: "",
  frequency: "",
};

describe("analyzeRowInputs", () => {
  // -----------------------------------------------------------------------
  // Insufficient cases
  // -----------------------------------------------------------------------

  it("empty form → insufficient", () => {
    const result = analyzeRowInputs(empty);
    expect(result.overallStatus).toBe("insufficient");
    expect(result.hasStartedInput).toBe(false);
  });

  it("only Cost filled → insufficient (partial Cost+CPM)", () => {
    const result = analyzeRowInputs({ ...empty, cost: "5000000" });
    expect(result.overallStatus).toBe("insufficient");
    expect(result.guidanceMessage).toContain("CPM");
  });

  it("only CPM filled → insufficient (partial Cost+CPM)", () => {
    const result = analyzeRowInputs({ ...empty, cpm: "25" });
    expect(result.overallStatus).toBe("insufficient");
    expect(result.guidanceMessage).toContain("Cost");
  });

  it("only Frequency filled → insufficient", () => {
    const result = analyzeRowInputs({ ...empty, frequency: "3" });
    expect(result.overallStatus).toBe("insufficient");
    expect(result.guidanceMessage).toContain("Reach%");
  });

  it("invalid number string → treated as empty", () => {
    const result = analyzeRowInputs({ ...empty, grps: "abc" });
    expect(result.overallStatus).toBe("insufficient");
    expect(result.hasStartedInput).toBe(false);
  });

  it("negative number → treated as empty", () => {
    const result = analyzeRowInputs({ ...empty, grps: "-10" });
    expect(result.overallStatus).toBe("insufficient");
    expect(result.hasStartedInput).toBe(false);
  });

  it("CPM of 0 → treated as empty (must be > 0)", () => {
    const result = analyzeRowInputs({ ...empty, cost: "1000", cpm: "0" });
    expect(result.overallStatus).toBe("insufficient");
    expect(result.guidanceMessage).toContain("CPM");
  });

  // -----------------------------------------------------------------------
  // Partial cases
  // -----------------------------------------------------------------------

  it("GRPs only → partial (need breakdown)", () => {
    const result = analyzeRowInputs({ ...empty, grps: "160" });
    expect(result.overallStatus).toBe("partial");
    expect(result.guidanceMessage).toContain("Reach%");
    expect(result.guidanceMessage).toContain("Frequency");
  });

  it("Gross Impressions only → partial", () => {
    const result = analyzeRowInputs({ ...empty, grossImpressions: "80000000" });
    expect(result.overallStatus).toBe("partial");
    expect(result.guidanceMessage).toContain("Reach%");
  });

  it("Cost + CPM → partial (need breakdown)", () => {
    const result = analyzeRowInputs({ ...empty, cost: "5000000", cpm: "25" });
    expect(result.overallStatus).toBe("partial");
    expect(result.guidanceMessage).toContain("Reach%");
  });

  it("Reach% only → partial (Path E)", () => {
    const result = analyzeRowInputs({ ...empty, reachPercent: "45" });
    expect(result.overallStatus).toBe("partial");
    expect(result.guidanceMessage).toContain("Reach% only");
  });

  // -----------------------------------------------------------------------
  // Ready cases
  // -----------------------------------------------------------------------

  it("Reach% + Frequency → ready (Path D)", () => {
    const result = analyzeRowInputs({ ...empty, reachPercent: "30", frequency: "4" });
    expect(result.overallStatus).toBe("ready");
  });

  it("GRPs + Reach% → ready", () => {
    const result = analyzeRowInputs({ ...empty, grps: "160", reachPercent: "60" });
    expect(result.overallStatus).toBe("ready");
  });

  it("GRPs + Frequency → ready", () => {
    const result = analyzeRowInputs({ ...empty, grps: "160", frequency: "3" });
    expect(result.overallStatus).toBe("ready");
  });

  it("Cost + CPM + Reach% → ready", () => {
    const result = analyzeRowInputs({
      ...empty,
      cost: "5000000",
      cpm: "25",
      reachPercent: "60",
    });
    expect(result.overallStatus).toBe("ready");
  });

  it("Cost + CPM + Frequency → ready", () => {
    const result = analyzeRowInputs({
      ...empty,
      cost: "5000000",
      cpm: "25",
      frequency: "3",
    });
    expect(result.overallStatus).toBe("ready");
  });

  it("Gross Impressions + Frequency → ready", () => {
    const result = analyzeRowInputs({
      ...empty,
      grossImpressions: "80000000",
      frequency: "4",
    });
    expect(result.overallStatus).toBe("ready");
  });

  it("Gross Impressions + Reach% → ready", () => {
    const result = analyzeRowInputs({
      ...empty,
      grossImpressions: "80000000",
      reachPercent: "30",
    });
    expect(result.overallStatus).toBe("ready");
  });

  // -----------------------------------------------------------------------
  // Active groups
  // -----------------------------------------------------------------------

  it("Cost field activates volume_costcpm group", () => {
    const result = analyzeRowInputs({ ...empty, cost: "5000000" });
    expect(result.activeGroups).toContain("volume_costcpm");
  });

  it("Reach% activates breakdown_reachfreq group", () => {
    const result = analyzeRowInputs({ ...empty, reachPercent: "30" });
    expect(result.activeGroups).toContain("breakdown_reachfreq");
  });

  it("GRPs activates volume_grps group", () => {
    const result = analyzeRowInputs({ ...empty, grps: "160" });
    expect(result.activeGroups).toContain("volume_grps");
  });

  it("multiple groups can be active", () => {
    const result = analyzeRowInputs({
      ...empty,
      cost: "5000000",
      cpm: "25",
      reachPercent: "60",
    });
    expect(result.activeGroups).toContain("volume_costcpm");
    expect(result.activeGroups).toContain("breakdown_reachfreq");
  });
});
