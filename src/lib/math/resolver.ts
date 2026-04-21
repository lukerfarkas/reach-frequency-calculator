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
  effectiveReach3PlusFromLambda,
  type EffectiveReachResult,
} from "./calculations";
import {
  estimateTVReach,
  getChannelConfig,
  type TVReachResult,
} from "./reachCurve";

export interface TacticInputs {
  /**
   * Optional form-row id passed through to `ResolvedTactic.id` so the
   * UI can map resolved results back to the form row (for selection,
   * removal, etc.). Optional because tests and scripted callers don't
   * always carry one.
   */
  id?: string;
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
  /** Form-row id, propagated from TacticInputs.id. */
  id?: string;
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
    id: input.id,
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
      // Have GRPs but no reach or frequency — look up the channel config.
      const channelConfig = getChannelConfig(input.channel);

      if (channelConfig?.mode === "curve" && channelConfig.calibration && grps > 0) {
        // Calibrated reach curve (TV, Radio, Print, OOH).
        const curveResult: TVReachResult = estimateTVReach(grps, channelConfig.calibration);
        result.reachPercent = curveResult.reachPercent;
        result.frequency = curveResult.frequency;
        result.reachPercentEstimated = true;
        result.derivationPath += ` → Reach% estimated via calibrated ${input.channel} reach curve`;
        result.warnings.push(
          `Reach% (${curveResult.reachPercent.toFixed(1)}%) was auto-estimated using a calibrated ${input.channel} reach model (ceiling: ${(curveResult.calibration.maxReach * 100).toFixed(0)}%, duplication: ${(curveResult.duplicationPenalty * 100).toFixed(1)}%). Actual reach varies by daypart, inventory mix, and audience — override by entering Reach% or Frequency directly.`
        );
      } else if (channelConfig?.mode === "manual") {
        // Manual-only channel (Digital, Social, Other). Don't fabricate a
        // reach number — tell the user explicitly that they need to provide
        // Reach% or Frequency for this channel.
        result.warnings.push(
          `Reach% and Frequency cannot be auto-estimated for ${input.channel}. ${channelConfig.manualOnlyReason ?? ""} Enter Reach% or Frequency manually to complete the calculation.`.trim()
        );
      } else {
        // Unknown channel — fall back to the legacy message.
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
    // For channels whose Reach% was auto-estimated via a calibrated reach
    // model (TV, Radio, Print, OOH), use the adjusted frequency as the
    // Poisson lambda rather than naive GRPs/100. This keeps effective 3+
    // internally consistent with the duplication-adjusted reach model —
    // viewers who ARE reached see more impressions on average.
    if (result.reachPercentEstimated && result.frequency != null) {
      result.effective3Plus = effectiveReach3PlusFromLambda(result.frequency);
    } else {
      result.effective3Plus = effectiveReach3Plus(grps);
    }

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
