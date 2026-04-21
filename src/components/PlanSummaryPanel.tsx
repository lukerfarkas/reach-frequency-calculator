"use client";

import type { PlanSummaryResult } from "@/lib/math/calculations";
import { fmt2, fmtInt, fmtCurrency } from "@/lib/formatters";

interface Props {
  /**
   * The computed plan summary. `null` is valid when `reachError` is set and
   * no cost rollup is available either (e.g. geo/audience mismatch) — the
   * panel then renders only the error notice.
   */
  summary: PlanSummaryResult | null;
  audienceSize: number;
  /** When set, reach metrics cannot be combined — only cost rollup is shown. */
  reachError?: string | null;
  /**
   * Optional heading override. Defaults to "Plan Summary" / "Program Rollup"
   * for backward compatibility with the full-plan rollup. Channel-level
   * subtotals pass a label like "TV Subtotal".
   */
  title?: string;
}

export default function PlanSummaryPanel({
  summary,
  audienceSize,
  reachError,
  title,
}: Props) {
  const showReach = !reachError && summary != null;
  const hasCostData =
    summary != null &&
    (summary.totalNetCost > 0 || summary.totalGrossImpressions > 0);
  const heading = title ?? (showReach ? "Plan Summary" : "Program Rollup");

  return (
    <div className="rounded-lg border border-unlock-sky bg-unlock-ice p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-unlock-black">{heading}</h3>

      {/* Reach metrics — only when all tactics can be combined */}
      {showReach && summary && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-unlock-ocean">
                Combined Reach %
              </p>
              <p className="text-2xl font-bold text-unlock-black">
                {fmt2(summary.combinedReachPercent)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-unlock-ocean">
                Combined Reach #
              </p>
              <p className="text-2xl font-bold text-unlock-black">
                {fmtInt(summary.combinedReachNumber)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-unlock-ocean">
                Total GRPs
              </p>
              <p className="text-2xl font-bold text-unlock-black">
                {fmt2(summary.totalGRPs)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-unlock-ocean">
                Avg Frequency
              </p>
              <p className="text-2xl font-bold text-unlock-black">
                {fmt2(summary.combinedAvgFrequency)}×
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-unlock-ocean">
                Eff. 3+ Reach %
              </p>
              <p className="text-2xl font-bold text-unlock-black">
                {fmt2(summary.effective3Plus.effective3PlusPercent)}%
              </p>
            </div>
          </div>

          {/* Effective 3+ Reach # */}
          <div className="mt-3">
            <p className="text-xs text-unlock-ocean">
              Eff. 3+ Reach #:{" "}
              <span className="font-semibold text-unlock-black">
                {fmtInt(
                  Math.round(
                    (summary.effective3Plus.effective3PlusPercent / 100) * audienceSize
                  )
                )}
              </span>
            </p>
          </div>
        </>
      )}

      {/* Reach error notice */}
      {reachError && (
        <div className="mb-3 rounded border border-unlock-salmon bg-red-50 px-3 py-2 text-xs text-unlock-barn-red">
          {reachError}
        </div>
      )}

      {/* Cost / Impressions Rollup */}
      {hasCostData && summary && (
        <div className={showReach ? "mt-4 border-t border-unlock-sky pt-4" : ""}>
          {showReach && (
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-unlock-ocean">
              Cost &amp; Impressions Rollup
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-unlock-ocean">
                Total Net Cost
              </p>
              <p className="text-2xl font-bold text-unlock-black">
                {fmtCurrency(summary.totalNetCost)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-unlock-ocean">
                Total Impressions
              </p>
              <p className="text-2xl font-bold text-unlock-black">
                {fmtInt(summary.totalGrossImpressions)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-unlock-ocean">
                Blended CPM
              </p>
              <p className="text-2xl font-bold text-unlock-black">
                {summary.blendedCPM != null ? `$${summary.blendedCPM.toFixed(2)}` : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {showReach && summary && (
        <div className="mt-4 space-y-1 text-xs text-unlock-dark-gray">
          <p>
            * Combined Avg Frequency = Total GRPs / Combined Reach%. This assumes
            comparable GRPs within the same geo/audience.
          </p>
          <p>
            * Effective 3+ Reach is a Poisson approximation using total GRPs (λ ={" "}
            {fmt2(summary.effective3Plus.lambda)}).
          </p>
        </div>
      )}
    </div>
  );
}
