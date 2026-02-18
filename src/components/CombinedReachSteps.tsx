"use client";

import type { CombinedReachStep } from "@/lib/math/calculations";
import { fmt2 } from "@/lib/formatters";

interface Props {
  steps: CombinedReachStep[];
}

export default function CombinedReachSteps({ steps }: Props) {
  if (steps.length === 0) return null;

  return (
    <div className="rounded-lg border border-unlock-light-gray bg-gray-50 p-4">
      <h4 className="mb-3 text-sm font-semibold text-unlock-dark-gray">
        Combined Reach — Sequential Remainder Method
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-unlock-light-gray text-left text-xs uppercase tracking-wide text-unlock-medium-gray">
              <th className="pb-2 pr-4">Step</th>
              <th className="pb-2 pr-4">Tactic</th>
              <th className="pb-2 pr-4 text-right">Reach %</th>
              <th className="pb-2 pr-4 text-right">Remainder</th>
              <th className="pb-2 pr-4 text-right">Incremental</th>
              <th className="pb-2 text-right">Running Total</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5 pr-4 text-unlock-medium-gray">{i + 1}</td>
                <td className="py-1.5 pr-4 font-medium text-unlock-black">
                  {step.tacticName}
                </td>
                <td className="py-1.5 pr-4 text-right">{fmt2(step.reachPercent)}%</td>
                <td className="py-1.5 pr-4 text-right">{fmt2(step.remainder)}%</td>
                <td className="py-1.5 pr-4 text-right">{fmt2(step.incremental)}%</td>
                <td className="py-1.5 text-right font-semibold">
                  {fmt2(step.runningTotal)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-unlock-medium-gray">
        Formula: remainder = 100 − runningTotal; incremental = remainder × (reach% / 100);
        runningTotal += incremental
      </p>
    </div>
  );
}
