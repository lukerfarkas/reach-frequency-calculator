/**
 * Real-time input status analysis for tactic form rows.
 *
 * This is a lightweight, pure function that checks which fields the user
 * has filled in and determines:
 *   - Whether the row is "ready" (fully resolvable), "partial", or "insufficient"
 *   - A coaching-style guidance message explaining what to do next
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
  channel?: string;
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

  // Determine overall status and coaching message
  let overallStatus: OverallStatus;
  let guidanceMessage: string;

  if (pathDComplete) {
    overallStatus = "ready";
    guidanceMessage = "All set! Reach% + Frequency is enough to calculate everything.";
  } else if (anyVolumePath && hasAnyBreakdown) {
    overallStatus = "ready";
    guidanceMessage = "All set! You have enough data for a full calculation.";
  } else if (anyVolumePath && !hasAnyBreakdown) {
    // Have volume but no breakdown — for TV, reach curve will auto-estimate
    if (form.channel === "TV") {
      if (has.grps) {
        guidanceMessage =
          "GRPs are in for TV. Reach% will be auto-estimated from the reach curve, or add your own Reach%/Frequency.";
      } else if (has.grossImpressions) {
        guidanceMessage =
          "Got your impressions for TV. Reach% will be auto-estimated, or add your own.";
      } else {
        guidanceMessage =
          "Cost + CPM locked in for TV. Reach% will be auto-estimated, or add your own.";
      }
      overallStatus = "ready";
    } else {
      // Non-TV: coach them to add breakdown
      if (has.grps) {
        guidanceMessage =
          "Good, GRPs are in. Now add Reach% or Frequency so we can break that down.";
      } else if (has.grossImpressions) {
        guidanceMessage =
          "Got your impressions. Now add Reach% or Frequency to complete the picture.";
      } else {
        guidanceMessage =
          "Cost + CPM locked in. Now add Reach% or Frequency and you're done.";
      }
      overallStatus = "partial";
    }
  } else if (has.reachPercent && !has.frequency && !anyVolumePath) {
    // Path E: Reach% only — can compute reach# but nothing else
    overallStatus = "partial";
    guidanceMessage =
      "Have your Reach%. Add Frequency to complete the pair, or enter GRPs/Impressions/Cost+CPM for volume.";
  } else if (has.frequency && !has.reachPercent && !anyVolumePath) {
    overallStatus = "insufficient";
    guidanceMessage =
      "Frequency alone isn't enough. Pair it with Reach%, or enter GRPs/Impressions/Cost+CPM.";
  } else if (pathCPartial) {
    const missing = !has.cost ? "Cost" : "CPM";
    overallStatus = "insufficient";
    guidanceMessage = `Almost there — add ${missing} to complete the Cost + CPM pair.`;
  } else if (!hasStartedInput) {
    overallStatus = "insufficient";
    guidanceMessage =
      "Start with what you know: Cost+CPM, GRPs, Impressions, or Reach%+Frequency.";
  } else {
    overallStatus = "insufficient";
    guidanceMessage =
      "Start with what you know: Cost+CPM, GRPs, Impressions, or Reach%+Frequency.";
  }

  return {
    overallStatus,
    guidanceMessage,
    activeGroups,
    hasStartedInput,
  };
}
