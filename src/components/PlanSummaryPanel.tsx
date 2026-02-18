"use client";

import type { PlanSummaryResult } from "@/lib/math/calculations";
import { fmt2, fmtInt } from "@/lib/formatters";

interface Props {
  summary: PlanSummaryResult;
  audienceSize: number;
}

export default function PlanSummaryPanel({ summary, audienceSize }: Props) {
  return (
    <div className="rounded-lg border border-unlock-sky bg-unlock-ice p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-unlock-black">Plan Summary</h3>

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

      {/* Notes */}
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
    </div>
  );
}
