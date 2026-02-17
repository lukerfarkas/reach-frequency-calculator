"use client";

import type { ResolvedTactic } from "@/lib/math/resolver";
import { fmt2, fmtInt, fmtCurrency } from "@/lib/formatters";

interface Props {
  tactic: ResolvedTactic;
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-lg font-semibold text-gray-900">
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

export default function TacticResultCard({ tactic }: Props) {
  const hasErrors = tactic.errors.length > 0;

  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${
        hasErrors ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{tactic.tacticName}</h3>
          <p className="text-xs text-gray-500">
            {tactic.channel} · {tactic.geoName} · {tactic.audienceName} · Pop:{" "}
            {fmtInt(tactic.audienceSize)}
          </p>
        </div>
        {tactic.isFullyResolved && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Resolved
          </span>
        )}
        {!tactic.isFullyResolved && !hasErrors && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
            Partial
          </span>
        )}
        {hasErrors && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            Error
          </span>
        )}
      </div>

      {/* Errors */}
      {hasErrors && (
        <div className="mb-3 rounded bg-red-100 p-2 text-sm text-red-800">
          {tactic.errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {/* Warnings */}
      {tactic.warnings.length > 0 && (
        <div className="mb-3 rounded bg-yellow-100 p-2 text-sm text-yellow-800">
          {tactic.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {/* Derivation path */}
      {tactic.derivationPath && (
        <p className="mb-3 text-xs italic text-gray-400">
          Derivation: {tactic.derivationPath}
        </p>
      )}

      {/* Input echo */}
      {(tactic.inputCost != null || tactic.inputCPM != null) && (
        <div className="mb-3 flex gap-4 text-xs text-gray-500 border-b border-gray-100 pb-2">
          {tactic.inputCost != null && (
            <span>Cost: {fmtCurrency(tactic.inputCost)}</span>
          )}
          {tactic.inputCPM != null && (
            <span>CPM: {fmtCurrency(tactic.inputCPM)}</span>
          )}
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="GRPs" value={tactic.grps != null ? fmt2(tactic.grps) : "—"} />
        <Stat
          label="Gross Impressions"
          value={tactic.grossImpressions != null ? fmtInt(tactic.grossImpressions) : "—"}
        />
        <Stat
          label="Reach %"
          value={tactic.reachPercent != null ? fmt2(tactic.reachPercent) : "—"}
          unit="%"
        />
        <Stat
          label="Reach #"
          value={tactic.reachNum != null ? fmtInt(tactic.reachNum) : "—"}
        />
        <Stat
          label="Avg Frequency"
          value={tactic.frequency != null ? fmt2(tactic.frequency) : "—"}
          unit="×"
        />
        <Stat
          label="Eff. 3+ Reach %"
          value={
            tactic.effective3Plus
              ? fmt2(tactic.effective3Plus.effective3PlusPercent)
              : "—"
          }
          unit="%"
        />
        <Stat
          label="Eff. 3+ Reach #"
          value={
            tactic.effective3Plus && tactic.audienceSize
              ? fmtInt(
                  Math.round(
                    (tactic.effective3Plus.effective3PlusPercent / 100) *
                      tactic.audienceSize
                  )
                )
              : "—"
          }
        />
      </div>
    </div>
  );
}
