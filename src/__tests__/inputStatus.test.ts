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

  it("empty form → insufficient with coaching prompt", () => {
    const result = analyzeRowInputs(empty);
    expect(result.overallStatus).toBe("insufficient");
    expect(result.hasStartedInput).toBe(false);
    expect(result.guidanceMessage).toContain("Start with what you know");
  });

  it("only Cost filled → insufficient, asks for CPM", () => {
    const result = analyzeRowInputs({ ...empty, cost: "5000000" });
    expect(result.overallStatus).toBe("insufficient");
    expect(result.guidanceMessage).toContain("CPM");
    expect(result.guidanceMessage).toContain("Almost there");
  });

  it("only CPM filled → insufficient, asks for Cost", () => {
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

  it("GRPs only → partial, coaches to add breakdown", () => {
    const result = analyzeRowInputs({ ...empty, grps: "160" });
    expect(result.overallStatus).toBe("partial");
    expect(result.guidanceMessage).toContain("GRPs are in");
    expect(result.guidanceMessage).toContain("Reach%");
    expect(result.guidanceMessage).toContain("Frequency");
  });

  it("Gross Impressions only → partial, coaches to add breakdown", () => {
    const result = analyzeRowInputs({ ...empty, grossImpressions: "80000000" });
    expect(result.overallStatus).toBe("partial");
    expect(result.guidanceMessage).toContain("impressions");
    expect(result.guidanceMessage).toContain("Reach%");
  });

  it("Cost + CPM → partial, coaches to add breakdown", () => {
    const result = analyzeRowInputs({ ...empty, cost: "5000000", cpm: "25" });
    expect(result.overallStatus).toBe("partial");
    expect(result.guidanceMessage).toContain("Cost + CPM locked in");
  });

  it("Reach% only → partial, coaches next steps", () => {
    const result = analyzeRowInputs({ ...empty, reachPercent: "45" });
    expect(result.overallStatus).toBe("partial");
    expect(result.guidanceMessage).toContain("Reach%");
    expect(result.guidanceMessage).toContain("Frequency");
  });

  // -----------------------------------------------------------------------
  // Ready cases
  // -----------------------------------------------------------------------

  it("Reach% + Frequency → ready with confirmation", () => {
    const result = analyzeRowInputs({ ...empty, reachPercent: "30", frequency: "4" });
    expect(result.overallStatus).toBe("ready");
    expect(result.guidanceMessage).toContain("All set");
  });

  it("GRPs + Reach% → ready", () => {
    const result = analyzeRowInputs({ ...empty, grps: "160", reachPercent: "60" });
    expect(result.overallStatus).toBe("ready");
    expect(result.guidanceMessage).toContain("All set");
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

  // -----------------------------------------------------------------------
  // TV reach curve coaching
  // -----------------------------------------------------------------------

  it("TV + GRPs only → ready (reach curve available)", () => {
    const result = analyzeRowInputs({ ...empty, grps: "160", channel: "TV" });
    expect(result.overallStatus).toBe("ready");
    expect(result.guidanceMessage).toContain("auto-estimated");
  });

  it("TV + Impressions only → ready (reach curve available)", () => {
    const result = analyzeRowInputs({ ...empty, grossImpressions: "80000000", channel: "TV" });
    expect(result.overallStatus).toBe("ready");
    expect(result.guidanceMessage).toContain("auto-estimated");
  });

  it("TV + Cost+CPM → ready (reach curve available)", () => {
    const result = analyzeRowInputs({ ...empty, cost: "5000000", cpm: "25", channel: "TV" });
    expect(result.overallStatus).toBe("ready");
    expect(result.guidanceMessage).toContain("auto-estimated");
  });

  it("Digital + GRPs only → still partial (no reach curve)", () => {
    const result = analyzeRowInputs({ ...empty, grps: "160", channel: "Digital" });
    expect(result.overallStatus).toBe("partial");
    expect(result.guidanceMessage).not.toContain("auto-estimated");
  });

  it("no channel (backward compat) + GRPs → still partial", () => {
    const result = analyzeRowInputs({ ...empty, grps: "160" });
    expect(result.overallStatus).toBe("partial");
  });
});
