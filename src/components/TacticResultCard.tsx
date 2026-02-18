"use client";

import type { ResolvedTactic } from "@/lib/math/resolver";
import { fmt2, fmtInt, fmtCurrency } from "@/lib/formatters";

interface Props {
  tactic: ResolvedTactic;
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-unlock-medium-gray uppercase tracking-wide">{label}</span>
      <span className="text-lg font-semibold text-unlock-black">
        {value}
        {unit && <span className="text-sm font-normal text-unlock-medium-gray ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

export default function TacticResultCard({ tactic }: Props) {
  const hasErrors = tactic.errors.length > 0;

  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${
        hasErrors ? "border-unlock-salmon bg-red-50" : "border-unlock-light-gray bg-white"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-unlock-black">{tactic.tacticName}</h3>
          <p className="text-xs text-unlock-medium-gray">
            {tactic.channel} · {tactic.geoName} · {tactic.audienceName} · Pop:{" "}
            {fmtInt(tactic.audienceSize)}
          </p>
        </div>
        {tactic.isFullyResolved && (
          <span className="rounded-full bg-unlock-ice px-2 py-0.5 text-xs font-medium text-unlock-ocean">
            Resolved
          </span>
        )}
        {!tactic.isFullyResolved && !hasErrors && (
          <span className="rounded-full bg-unlock-alabaster px-2 py-0.5 text-xs font-medium text-unlock-dark-gray">
            Partial
          </span>
        )}
        {hasErrors && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-unlock-red">
            Error
          </span>
        )}
      </div>

      {/* Errors */}
      {hasErrors && (
        <div className="mb-3 rounded bg-red-100 p-2 text-sm text-unlock-barn-red">
          {tactic.errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {/* Warnings */}
      {tactic.warnings.length > 0 && (
        <div className="mb-3 rounded bg-unlock-alabaster p-2 text-sm text-unlock-dark-gray">
          {tactic.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {/* Derivation path */}
      {tactic.derivationPath && (
        <p className="mb-3 text-xs italic text-unlock-medium-gray">
          Derivation: {tactic.derivationPath}
        </p>
      )}

      {/* Input echo */}
      {(tactic.inputCost != null || tactic.inputCPM != null) && (
        <div className="mb-3 flex gap-4 text-xs text-unlock-medium-gray border-b border-unlock-light-gray pb-2">
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
