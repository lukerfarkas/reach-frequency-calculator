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

import { getChannelConfig } from "./math/reachCurve";

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
    // Have volume but no breakdown. Behavior depends on channel:
    //   - "curve" channels (TV, Radio, Print, OOH) auto-estimate Reach%.
    //   - "manual" channels (Digital, Social, Other) require the user to
    //     enter Reach% / Frequency — we coach them explicitly.
    const channelConfig = form.channel ? getChannelConfig(form.channel) : null;
    const mode = channelConfig?.mode;
    const channelLabel = form.channel ?? "this channel";

    if (mode === "curve") {
      if (has.grps) {
        guidanceMessage = `GRPs are in for ${channelLabel}. Reach% will be auto-estimated from the reach curve, or add your own Reach%/Frequency to override.`;
      } else if (has.grossImpressions) {
        guidanceMessage = `Got your impressions for ${channelLabel}. Reach% will be auto-estimated, or add your own to override.`;
      } else {
        guidanceMessage = `Net Cost + CPM locked in for ${channelLabel}. Reach% will be auto-estimated, or add your own to override.`;
      }
      overallStatus = "ready";
    } else if (mode === "manual") {
      // Manual-only channel: explicit that R/F is required.
      if (has.grps) {
        guidanceMessage = `GRPs are in, but ${channelLabel} reach cannot be auto-estimated — add Reach% or Frequency from your platform data to complete the calculation.`;
      } else if (has.grossImpressions) {
        guidanceMessage = `Got your impressions, but ${channelLabel} reach cannot be auto-estimated — add Reach% or Frequency to complete the calculation.`;
      } else {
        guidanceMessage = `Net Cost + CPM locked in, but ${channelLabel} reach cannot be auto-estimated — add Reach% or Frequency to finish.`;
      }
      overallStatus = "partial";
    } else {
      // Unknown channel (or no channel selected yet): generic coaching.
      if (has.grps) {
        guidanceMessage =
          "Good, GRPs are in. Now add Reach% or Frequency so we can break that down.";
      } else if (has.grossImpressions) {
        guidanceMessage =
          "Got your impressions. Now add Reach% or Frequency to complete the picture.";
      } else {
        guidanceMessage =
          "Net Cost + CPM locked in. Now add Reach% or Frequency and you're done.";
      }
      overallStatus = "partial";
    }
  } else if (has.reachPercent && !has.frequency && !anyVolumePath) {
    // Path E: Reach% only — can compute reach# but nothing else
    overallStatus = "partial";
    guidanceMessage =
      "Have your Reach%. Add Frequency to complete the pair, or enter GRPs/Impressions/Net Cost+CPM for volume.";
  } else if (has.frequency && !has.reachPercent && !anyVolumePath) {
    overallStatus = "insufficient";
    guidanceMessage =
      "Frequency alone isn't enough. Pair it with Reach%, or enter GRPs/Impressions/Net Cost+CPM.";
  } else if (pathCPartial) {
    const missing = !has.cost ? "Net Cost" : "CPM";
    overallStatus = "insufficient";
    guidanceMessage = `Almost there — enter any two of Net Cost, Impressions, or CPM and the third will be calculated automatically. Add ${missing} to continue.`;
  } else if (!hasStartedInput) {
    overallStatus = "insufficient";
    guidanceMessage =
      "Enter any two of Net Cost, Impressions, or CPM — the third is calculated automatically. Or start with GRPs or Reach%+Frequency.";
  } else {
    overallStatus = "insufficient";
    guidanceMessage =
      "Enter any two of Net Cost, Impressions, or CPM — the third is calculated automatically. Or start with GRPs or Reach%+Frequency.";
  }

  return {
    overallStatus,
    guidanceMessage,
    activeGroups,
    hasStartedInput,
  };
}
