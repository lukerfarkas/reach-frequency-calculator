/**
 * Helpers for rendering per-channel result sections with subtotals.
 *
 * The full-program rollup and the per-channel subtotals both use the same
 * `computePlanSummary` math — they differ only in which tactics go in.
 * `computeGroupSummary` centralizes the "validate geo/audience + filter for
 * resolved reach + delegate to computePlanSummary" pipeline so the page and
 * each channel section call identical code.
 */

import {
  computePlanSummary,
  type PlanSummaryResult,
} from "./math/calculations";
import { validateCombinableGroup, CHANNELS, type Channel } from "./schemas";
import type { ResolvedTactic } from "./math/resolver";

/** Outcome of summarizing a group of tactics (full plan OR single channel). */
export interface GroupSummary {
  /** Non-null when a combined-reach summary is computable for the group. */
  summary: PlanSummaryResult | null;
  /** Non-null when reach can't be combined (mismatched geo/audience, etc.). */
  reachError: string | null;
  /** How many tactics were considered. */
  size: number;
}

/**
 * Compute a plan summary for an arbitrary group of resolved tactics.
 *
 * Behavior:
 *   - 0 or 1 tactic → `summary: null, reachError: null` (no panel rendered)
 *   - 2+ with matching geo/audience AND all with reach — returns a full summary
 *   - 2+ with a geo/audience mismatch — returns `reachError` (caller shows error panel)
 *   - 2+ but some without reach%/grps — cost-only rollup using zeros for missing reach
 *
 * Mirrors the logic previously inlined in `page.tsx` handleCalculate so the
 * full plan and each channel section go through exactly the same code path.
 */
export function computeGroupSummary(group: ResolvedTactic[]): GroupSummary {
  if (group.length < 2) {
    return { summary: null, reachError: null, size: group.length };
  }

  const combineCheck = validateCombinableGroup(group);
  const withReach = group.filter(
    (r) => r.reachPercent != null && r.grps != null
  );
  const canCombineReach =
    combineCheck.valid && withReach.length === group.length;

  // Mismatched geo/audience — no summary, just the error.
  if (!combineCheck.valid) {
    return {
      summary: null,
      reachError: combineCheck.error ?? "Cannot combine these tactics.",
      size: group.length,
    };
  }

  // Everyone resolved → full reach + cost summary.
  if (canCombineReach) {
    const summary = computePlanSummary(
      withReach.map((r) => ({
        tacticName: r.tacticName,
        reachPercent: r.reachPercent!,
        grps: r.grps!,
        inputCost: r.inputCost,
        grossImpressions: r.grossImpressions,
      })),
      withReach[0].audienceSize
    );
    return { summary, reachError: null, size: group.length };
  }

  // Some tactics missing reach% — render cost-only rollup with zeros for
  // reach (the panel hides reach metrics when reachError is set).
  const summary = computePlanSummary(
    group.map((r) => ({
      tacticName: r.tacticName,
      reachPercent: r.reachPercent ?? 0,
      grps: r.grps ?? 0,
      inputCost: r.inputCost,
      grossImpressions: r.grossImpressions,
    })),
    group[0].audienceSize
  );
  return {
    summary,
    reachError:
      "Some tactics do not have Reach% or GRPs computed. Cannot combine reach.",
    size: group.length,
  };
}

/**
 * Group resolved tactics by channel, preserving the display order declared
 * in `CHANNELS` (TV, Radio, OOH, Print, Social, Digital, Other). Channels
 * with no tactics are omitted from the returned array.
 */
export function groupResolvedByChannel(
  resolved: ResolvedTactic[]
): { channel: Channel; tactics: ResolvedTactic[] }[] {
  const buckets = new Map<Channel, ResolvedTactic[]>();
  for (const ch of CHANNELS) buckets.set(ch, []);
  for (const rt of resolved) {
    const ch = rt.channel as Channel;
    const bucket = buckets.get(ch);
    // Defensive: if a tactic has a channel outside the registry (shouldn't
    // happen — zod enforces the enum — but be resilient), skip it rather
    // than crash the render.
    if (bucket) bucket.push(rt);
  }
  return CHANNELS.filter((ch) => buckets.get(ch)!.length > 0).map((ch) => ({
    channel: ch,
    tactics: buckets.get(ch)!,
  }));
}
