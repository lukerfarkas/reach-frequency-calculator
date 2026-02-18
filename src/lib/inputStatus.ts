/**
 * Real-time input status analysis for tactic form rows.
 *
 * This is a lightweight, pure function that checks which fields the user
 * has filled in and determines:
 *   - Whether the row is "ready" (fully resolvable), "partial", or "insufficient"
 *   - A guidance message explaining what's needed
 *   - Which field groups are actively being used
 *
 * This mirrors the resolver's 5 input paths (A–E) but does NO math —
 * only string presence checks. Safe to call on every keystroke.
 */

export type OverallStatus = "insufficient" | "partial" | "ready";

export type ActiveGroup =
  | "volume_costcpm"
  | "volume_impressions"
  | "volume_grps"
  | "breakdown_reachfreq";

export interface RowInputStatus {
  overallStatus: OverallStatus;
  guidanceMessage: string;
  activeGroups: ActiveGroup[];
  hasStartedInput: boolean;
}

/** Check if a string form field holds a valid non-negative number */
function isPresent(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  const n = Number(trimmed);
  return isFinite(n) && n >= 0;
}

/** CPM specifically must be > 0 */
function isCPMPresent(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  const n = Number(trimmed);
  return isFinite(n) && n > 0;
}

export function analyzeRowInputs(form: {
  grps: string;
  grossImpressions: string;
  cost: string;
  cpm: string;
  reachPercent: string;
  frequency: string;
}): RowInputStatus {
  const has = {
    grps: isPresent(form.grps),
    grossImpressions: isPresent(form.grossImpressions),
    cost: isPresent(form.cost),
    cpm: isCPMPresent(form.cpm),
    reachPercent: isPresent(form.reachPercent),
    frequency: isPresent(form.frequency),
  };

  // Track which groups have any input
  const activeGroups: ActiveGroup[] = [];
  if (has.cost || has.cpm) activeGroups.push("volume_costcpm");
  if (has.grossImpressions) activeGroups.push("volume_impressions");
  if (has.grps) activeGroups.push("volume_grps");
  if (has.reachPercent || has.frequency) activeGroups.push("breakdown_reachfreq");

  const hasStartedInput =
    has.grps ||
    has.grossImpressions ||
    has.cost ||
    has.cpm ||
    has.reachPercent ||
    has.frequency;

  // Volume paths (give GRPs / impressions)
  const pathCComplete = has.cost && has.cpm;
  const pathCPartial = (has.cost || has.cpm) && !pathCComplete;
  const anyVolumePath = has.grps || has.grossImpressions || pathCComplete;

  // Breakdown (gives reach% / frequency split)
  const pathDComplete = has.reachPercent && has.frequency;
  const hasAnyBreakdown = has.reachPercent || has.frequency;

  // Determine overall status
  let overallStatus: OverallStatus;
  let guidanceMessage: string;

  if (pathDComplete) {
    // Path D: Reach% + Frequency → fully resolved on its own
    overallStatus = "ready";
    guidanceMessage = "Ready — full resolution from Reach% + Frequency";
  } else if (anyVolumePath && hasAnyBreakdown) {
    // Volume path + at least one breakdown field → resolver can derive the other
    overallStatus = "ready";
    guidanceMessage = "Ready — full resolution possible";
  } else if (anyVolumePath && !hasAnyBreakdown) {
    // Have volume but no breakdown → can compute GRPs/impressions but not reach/freq
    overallStatus = "partial";
    guidanceMessage = "Add Reach% or Frequency for full resolution";
  } else if (has.reachPercent && !has.frequency && !anyVolumePath) {
    // Path E: Reach% only
    overallStatus = "partial";
    guidanceMessage =
      "Reach% only — add Frequency, GRPs, Impressions, or Cost+CPM for more";
  } else if (has.frequency && !has.reachPercent && !anyVolumePath) {
    // Frequency alone isn't a recognized path
    overallStatus = "insufficient";
    guidanceMessage = "Add Reach% with Frequency, or provide GRPs/Impressions/Cost+CPM";
  } else if (pathCPartial) {
    // Started Cost+CPM but incomplete
    const missing = !has.cost ? "Cost" : "CPM";
    overallStatus = "insufficient";
    guidanceMessage = `Add ${missing} to use the Cost + CPM path`;
  } else if (!hasStartedInput) {
    overallStatus = "insufficient";
    guidanceMessage = "Enter GRPs, Impressions, Cost+CPM, or Reach%+Frequency";
  } else {
    overallStatus = "insufficient";
    guidanceMessage = "Enter GRPs, Impressions, Cost+CPM, or Reach%+Frequency";
  }

  return {
    overallStatus,
    guidanceMessage,
    activeGroups,
    hasStartedInput,
  };
}
