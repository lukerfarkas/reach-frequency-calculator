/**
 * Core media planning calculation functions.
 * All functions are pure — no side effects, no external dependencies.
 */

// ---------------------------------------------------------------------------
// Basic conversions
// ---------------------------------------------------------------------------

/** Gross Impressions from Cost and CPM: impressions = (cost / CPM) * 1000 */
export function grossImpressionsFromCostCPM(cost: number, cpm: number): number {
  if (cpm <= 0) throw new Error("CPM must be greater than 0");
  if (cost < 0) throw new Error("Cost cannot be negative");
  return (cost / cpm) * 1000;
}

/** GRPs from Gross Impressions and target population: GRPs = (impressions / pop) * 100 */
export function grpsFromImpressions(grossImpressions: number, audienceSize: number): number {
  if (audienceSize <= 0) throw new Error("Audience size must be greater than 0");
  if (grossImpressions < 0) throw new Error("Gross impressions cannot be negative");
  return (grossImpressions / audienceSize) * 100;
}

/** GRPs from Reach% and Frequency: GRPs = reach% * frequency */
export function grpsFromReachFrequency(reachPercent: number, frequency: number): number {
  if (reachPercent < 0 || reachPercent > 100)
    throw new Error("Reach% must be between 0 and 100");
  if (frequency < 0) throw new Error("Frequency cannot be negative");
  return reachPercent * frequency;
}

/** Average Frequency from GRPs and Reach%: frequency = GRPs / reach% */
export function averageFrequency(grps: number, reachPercent: number): number {
  if (reachPercent <= 0)
    throw new Error("Reach% must be greater than 0 to compute frequency");
  if (grps < 0) throw new Error("GRPs cannot be negative");
  return grps / reachPercent;
}

/** Gross Impressions from GRPs and audience: impressions = (GRPs / 100) * audienceSize */
export function impressionsFromGRPs(grps: number, audienceSize: number): number {
  return (grps / 100) * audienceSize;
}

/** Reach # from Reach% and audience size */
export function reachNumber(reachPercent: number, audienceSize: number): number {
  return Math.round((reachPercent / 100) * audienceSize);
}

// ---------------------------------------------------------------------------
// Effective Reach (Poisson approximation)
// ---------------------------------------------------------------------------

export interface EffectiveReachResult {
  lambda: number;
  p0: number;
  p1: number;
  p2: number;
  p3plus: number;
  effective3PlusPercent: number;
}

/**
 * Effective 3+ reach using Poisson approximation.
 * λ = GRPs / 100
 * P(0) = e^-λ
 * P(1) = λ * e^-λ
 * P(2) = (λ^2 / 2) * e^-λ
 * P(3+) = 1 - P(0) - P(1) - P(2)
 * Effective3+% = P(3+) * 100
 */
export function effectiveReach3Plus(grps: number): EffectiveReachResult {
  if (grps < 0) throw new Error("GRPs cannot be negative");

  const lambda = grps / 100;
  const expNegLambda = Math.exp(-lambda);

  const p0 = expNegLambda;
  const p1 = lambda * expNegLambda;
  const p2 = ((lambda * lambda) / 2) * expNegLambda;
  const p3plus = 1 - (p0 + p1 + p2);

  // Clamp p3plus to [0, 1] to handle floating-point edge cases
  const clamped = Math.max(0, Math.min(1, p3plus));

  return {
    lambda,
    p0,
    p1,
    p2,
    p3plus: clamped,
    effective3PlusPercent: clamped * 100,
  };
}

// ---------------------------------------------------------------------------
// Combined Reach (sequential remainder / dedup method)
// ---------------------------------------------------------------------------

export interface CombinedReachStep {
  tacticName: string;
  reachPercent: number;
  remainder: number;
  incremental: number;
  runningTotal: number;
}

export interface CombinedReachResult {
  steps: CombinedReachStep[];
  combinedReachPercent: number;
}

/**
 * Combine reach across tactics using the sequential remainder method.
 * Tactics are sorted by reach% descending.
 *
 * Algorithm:
 *   Start with highest reach%.
 *   For each subsequent tactic:
 *     remainder = 100 - runningTotal
 *     incremental = remainder * (nextReach% / 100)
 *     runningTotal += incremental
 *
 * Equivalently: runningTotal = 100 * (1 - Π(1 - ri/100))
 */
export function combinedReach(
  tactics: { tacticName: string; reachPercent: number }[]
): CombinedReachResult {
  if (tactics.length === 0) {
    return { steps: [], combinedReachPercent: 0 };
  }

  // Validate
  for (const t of tactics) {
    if (t.reachPercent < 0 || t.reachPercent > 100) {
      throw new Error(
        `Reach% for "${t.tacticName}" must be between 0 and 100, got ${t.reachPercent}`
      );
    }
  }

  // Sort descending by reach%
  const sorted = [...tactics].sort((a, b) => b.reachPercent - a.reachPercent);

  const steps: CombinedReachStep[] = [];
  let runningTotal = 0;

  for (let i = 0; i < sorted.length; i++) {
    const tactic = sorted[i];
    if (i === 0) {
      // First tactic: take full reach
      steps.push({
        tacticName: tactic.tacticName,
        reachPercent: tactic.reachPercent,
        remainder: 100,
        incremental: tactic.reachPercent,
        runningTotal: tactic.reachPercent,
      });
      runningTotal = tactic.reachPercent;
    } else {
      const remainder = 100 - runningTotal;
      const incremental = remainder * (tactic.reachPercent / 100);
      runningTotal += incremental;
      steps.push({
        tacticName: tactic.tacticName,
        reachPercent: tactic.reachPercent,
        remainder,
        incremental,
        runningTotal,
      });
    }
  }

  // Clamp to 100 max
  const combinedReachPercent = Math.min(100, runningTotal);

  return { steps, combinedReachPercent };
}

// ---------------------------------------------------------------------------
// Plan Summary
// ---------------------------------------------------------------------------

export interface PlanSummaryResult {
  totalGRPs: number;
  combinedReachPercent: number;
  combinedReachNumber: number;
  combinedAvgFrequency: number;
  effective3Plus: EffectiveReachResult;
  combinedReachSteps: CombinedReachStep[];
}

export function computePlanSummary(
  tactics: {
    tacticName: string;
    reachPercent: number;
    grps: number;
  }[],
  audienceSize: number
): PlanSummaryResult {
  const totalGRPs = tactics.reduce((sum, t) => sum + t.grps, 0);

  const combined = combinedReach(
    tactics.map((t) => ({ tacticName: t.tacticName, reachPercent: t.reachPercent }))
  );

  const combinedReachPercent = combined.combinedReachPercent;
  const combinedReachNum = reachNumber(combinedReachPercent, audienceSize);

  // Combined Avg Frequency = total GRPs / combined reach%
  const combinedAvgFrequency =
    combinedReachPercent > 0 ? totalGRPs / combinedReachPercent : 0;

  // Effective 3+ on total GRPs
  const eff3Plus = effectiveReach3Plus(totalGRPs);

  return {
    totalGRPs,
    combinedReachPercent,
    combinedReachNumber: combinedReachNum,
    combinedAvgFrequency,
    effective3Plus: eff3Plus,
    combinedReachSteps: combined.steps,
  };
}
