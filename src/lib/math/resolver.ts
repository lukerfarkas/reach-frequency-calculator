/**
 * Resolver: given partial inputs for a tactic, derive all computable values.
 *
 * Input sets the user can provide:
 *   A) GRPs directly
 *   B) Gross Impressions directly
 *   C) Cost + CPM
 *   D) Reach% + Frequency
 *   E) Reach% only (cannot compute frequency/GRPs without more data)
 *
 * We attempt to derive: grossImpressions, grps, reachPercent, frequency,
 *   effective3Plus, reachNumber.
 */

import {
  grossImpressionsFromCostCPM,
  grpsFromImpressions,
  grpsFromReachFrequency,
  averageFrequency,
  impressionsFromGRPs,
  reachNumber,
  effectiveReach3Plus,
  type EffectiveReachResult,
} from "./calculations";
import { estimateReachPercent, getReachCurveK } from "./reachCurve";

export interface TacticInputs {
  tacticName: string;
  geoName: string;
  audienceName: string;
  audienceSize: number;
  channel: string;

  // Optional inputs — user provides whichever set they have
  grps?: number;
  grossImpressions?: number;
  cost?: number;
  cpm?: number;
  reachPercent?: number;
  frequency?: number;
}

export interface ResolvedTactic {
  tacticName: string;
  geoName: string;
  audienceName: string;
  audienceSize: number;
  channel: string;

  // Derived (or directly provided) values
  grossImpressions: number | null;
  grps: number | null;
  reachPercent: number | null;
  frequency: number | null;
  reachNum: number | null;
  effective3Plus: EffectiveReachResult | null;

  // Original inputs for display
  inputCost: number | null;
  inputCPM: number | null;

  // What was resolved
  derivationPath: string; // describes which input set was used
  warnings: string[];
  errors: string[];
  isFullyResolved: boolean;
  reachPercentEstimated: boolean; // true when Reach% was auto-estimated via reach curve
}

export function resolveTactic(input: TacticInputs): ResolvedTactic {
  const result: ResolvedTactic = {
    tacticName: input.tacticName,
    geoName: input.geoName,
    audienceName: input.audienceName,
    audienceSize: input.audienceSize,
    channel: input.channel,
    grossImpressions: null,
    grps: null,
    reachPercent: null,
    frequency: null,
    reachNum: null,
    effective3Plus: null,
    inputCost: input.cost ?? null,
    inputCPM: input.cpm ?? null,
    derivationPath: "",
    warnings: [],
    errors: [],
    isFullyResolved: false,
    reachPercentEstimated: false,
  };

  try {
    // Step 1: Derive GRPs from whatever inputs we have
    let grps: number | null = null;
    let grossImps: number | null = null;

    // Path C: Cost + CPM → impressions → GRPs
    if (input.cost != null && input.cpm != null) {
      grossImps = grossImpressionsFromCostCPM(input.cost, input.cpm);
      grps = grpsFromImpressions(grossImps, input.audienceSize);
      result.derivationPath = "Cost + CPM → Impressions → GRPs";
    }

    // Path B: Gross Impressions → GRPs (can override/supplement)
    if (input.grossImpressions != null) {
      grossImps = input.grossImpressions;
      grps = grpsFromImpressions(grossImps, input.audienceSize);
      if (result.derivationPath) {
        result.derivationPath = "Gross Impressions → GRPs (overrides Cost+CPM)";
      } else {
        result.derivationPath = "Gross Impressions → GRPs";
      }
    }

    // Path A: GRPs directly
    if (input.grps != null) {
      grps = input.grps;
      if (!grossImps) {
        grossImps = impressionsFromGRPs(grps, input.audienceSize);
      }
      result.derivationPath = "GRPs provided directly";
    }

    // Path D: Reach% + Frequency → GRPs
    if (input.reachPercent != null && input.frequency != null) {
      const derivedGRPs = grpsFromReachFrequency(input.reachPercent, input.frequency);
      if (grps != null && Math.abs(grps - derivedGRPs) > 0.01) {
        result.warnings.push(
          `GRPs derived from Reach×Frequency (${derivedGRPs.toFixed(2)}) differ from other inputs (${grps.toFixed(2)}). Using Reach×Frequency value.`
        );
      }
      grps = derivedGRPs;
      grossImps = impressionsFromGRPs(grps, input.audienceSize);
      result.derivationPath = "Reach% + Frequency → GRPs";
    }

    // Path E: Reach% only
    if (input.reachPercent != null && input.frequency == null && grps == null) {
      result.reachPercent = input.reachPercent;
      result.reachNum = reachNumber(input.reachPercent, input.audienceSize);
      result.derivationPath = "Reach% only (insufficient to compute GRPs/Frequency)";
      result.warnings.push(
        "Only Reach% provided. Cannot compute Frequency, GRPs, or Effective 3+ Reach without additional inputs (Frequency, GRPs, Impressions, or Cost+CPM)."
      );
      result.isFullyResolved = false;
      return result;
    }

    // If we still have no GRPs, we can't proceed further
    if (grps == null) {
      result.errors.push(
        "Insufficient inputs to compute GRPs. Provide one of: GRPs, Gross Impressions, Cost+CPM, or Reach%+Frequency."
      );
      return result;
    }

    result.grps = grps;
    result.grossImpressions = grossImps;

    // Step 2: Derive reach and frequency
    if (input.reachPercent != null) {
      result.reachPercent = input.reachPercent;
      result.frequency = averageFrequency(grps, input.reachPercent);
    } else if (input.frequency != null) {
      // Have frequency and GRPs, derive reach
      if (input.frequency > 0) {
        result.reachPercent = grps / input.frequency;
        result.frequency = input.frequency;
      } else {
        result.errors.push("Frequency must be > 0 to derive Reach%.");
        return result;
      }
    } else {
      // Have GRPs but no reach or frequency — try reach curve if available
      const curveK = getReachCurveK(input.channel);
      if (curveK != null && grps > 0) {
        const estimated = estimateReachPercent(grps, curveK);
        result.reachPercent = estimated;
        result.frequency = averageFrequency(grps, estimated);
        result.reachPercentEstimated = true;
        result.derivationPath += " → Reach% estimated via reach curve";
        result.warnings.push(
          `Reach% (${estimated.toFixed(1)}%) was auto-estimated using a ${input.channel} reach curve. This is an approximation — actual reach varies by daypart, network mix, and audience.`
        );
      } else {
        result.warnings.push(
          "GRPs computed but Reach% and Frequency cannot be individually determined without at least one of them being provided."
        );
      }
    }

    // Validate reach
    if (result.reachPercent != null && result.reachPercent > 100) {
      result.errors.push(
        `Computed Reach% (${result.reachPercent.toFixed(2)}%) exceeds 100%. Check your inputs.`
      );
      return result;
    }

    // Compute reach #
    if (result.reachPercent != null) {
      result.reachNum = reachNumber(result.reachPercent, input.audienceSize);
    }

    // Step 3: Effective 3+ reach
    result.effective3Plus = effectiveReach3Plus(grps);

    result.isFullyResolved =
      result.grps != null &&
      result.reachPercent != null &&
      result.frequency != null &&
      result.effective3Plus != null;
  } catch (e: unknown) {
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  return result;
}
