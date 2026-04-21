"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import TacticFormRow, {
  type TacticFormData,
  emptyTacticForm,
} from "@/components/TacticFormRow";
import TacticResultCard from "@/components/TacticResultCard";
import PlanSummaryPanel from "@/components/PlanSummaryPanel";
import CombinedReachSteps from "@/components/CombinedReachSteps";
import ShowMathPanel from "@/components/ShowMathPanel";
import { tacticInputSchema } from "@/lib/schemas";
import { resolveTactic, type ResolvedTactic } from "@/lib/math/resolver";
import {
  computeGroupSummary,
  groupResolvedByChannel,
} from "@/lib/channelGrouping";
import { SEED_TACTICS } from "@/lib/seedData";
import { parseNumeric } from "@/lib/parseNumeric";
import type { TacticInput } from "@/lib/schemas";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function tacticFormFromInput(t: TacticInput): TacticFormData {
  return {
    id: t.id,
    tacticName: t.tacticName,
    geoName: t.geoName,
    audienceName: t.audienceName,
    audienceSize: String(t.audienceSize),
    channel: t.channel,
    grps: t.grps != null ? String(t.grps) : "",
    grossImpressions: t.grossImpressions != null ? String(t.grossImpressions) : "",
    cost: t.cost != null ? String(t.cost) : "",
    cpm: t.cpm != null ? String(t.cpm) : "",
    reachPercent: t.reachPercent != null ? String(t.reachPercent) : "",
    frequency: t.frequency != null ? String(t.frequency) : "",
    dmaCode: "",
    demoSex: "adults" as const,
    demoAgeMin: 18,
    demoAgeMax: 999,
    demoIsHouseholds: false,
    audienceSizeOverridden: false,
    derivedCostField: null,
  };
}

function parseFormToInput(form: TacticFormData): Record<string, unknown> {
  // parseNumeric strips currency symbols, thousand separators, and trailing
  // percent signs — so pasting "$5,000,000" or "45%" from a spreadsheet
  // doesn't silently become NaN and break downstream validation.
  const audienceSizeParsed = parseNumeric(form.audienceSize);
  return {
    id: form.id,
    tacticName: form.tacticName.trim(),
    geoName: form.geoName.trim(),
    audienceName: form.audienceName.trim(),
    audienceSize: audienceSizeParsed ?? undefined,
    channel: form.channel,
    grps: parseNumeric(form.grps),
    grossImpressions: parseNumeric(form.grossImpressions),
    cost: parseNumeric(form.cost),
    cpm: parseNumeric(form.cpm),
    reachPercent: parseNumeric(form.reachPercent),
    frequency: parseNumeric(form.frequency),
  };
}

type FieldErrors = Record<string, Record<string, string[]>>;

// -------------------------------------------------------------------------
// Page
// -------------------------------------------------------------------------

export default function HomePage() {
  // Tactic form rows
  const [tactics, setTactics] = useState<TacticFormData[]>([]);

  // Validation errors per row
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Selection for plan calculation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Results
  const [resolvedTactics, setResolvedTactics] = useState<ResolvedTactic[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Full-plan summary — derived reactively from selection so deselecting a
  // tactic post-Calculate live-updates the rollup. `id` is optional on
  // ResolvedTactic (tests/scripted callers don't set one), so a tactic
  // with no id is treated as unselected in the UI — which is safe
  // because this page always threads id through.
  const selectedResolved = useMemo(
    () => resolvedTactics.filter((t) => t.id != null && selectedIds.has(t.id)),
    [resolvedTactics, selectedIds]
  );
  const { summary: planSummary, reachError: planError } = useMemo(
    () => computeGroupSummary(selectedResolved),
    [selectedResolved]
  );

  // Per-channel groups + subtotals. All resolved tactics appear (so every
  // card renders), but each subtotal is computed over just the SELECTED
  // tactics in that channel — matching the full-plan rollup's behavior.
  // Same code path (`computeGroupSummary`) keeps subtotals and the full
  // plan consistent: geo/audience mismatches in one channel don't affect
  // another, and deselecting a tactic live-updates its channel subtotal.
  const channelGroups = useMemo(() => {
    const groups = groupResolvedByChannel(resolvedTactics);
    return groups.map((g) => {
      const selectedInGroup = g.tactics.filter(
        (t) => t.id != null && selectedIds.has(t.id)
      );
      const { summary, reachError } = computeGroupSummary(selectedInGroup);
      return {
        channel: g.channel,
        tactics: g.tactics,
        selectedCount: selectedInGroup.length,
        summary,
        reachError,
      };
    });
  }, [resolvedTactics, selectedIds]);

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleFieldChange = useCallback(
    (id: string, field: keyof TacticFormData, value: string) => {
      setTactics((prev) =>
        prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
      );
      // Clear errors for this row on edit
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    []
  );

  const handleBatchChange = useCallback(
    (id: string, updates: Partial<TacticFormData>) => {
      setTactics((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    []
  );

  const handleRemove = useCallback((id: string) => {
    setTactics((prev) => prev.filter((t) => t.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleAddRow = useCallback(() => {
    setTactics((prev) => [...prev, emptyTacticForm()]);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === tactics.length) return new Set();
      return new Set(tactics.map((t) => t.id));
    });
  }, [tactics]);

  // -----------------------------------------------------------------------
  // Calculate
  // -----------------------------------------------------------------------

  const handleCalculate = useCallback(() => {
    // Validate all rows
    const newErrors: FieldErrors = {};
    const validInputs: TacticInput[] = [];
    let hasError = false;

    for (const form of tactics) {
      const raw = parseFormToInput(form);
      const result = tacticInputSchema.safeParse(raw);

      if (!result.success) {
        hasError = true;
        const rowErrors: Record<string, string[]> = {};
        for (const issue of result.error.issues) {
          const path = issue.path[0]?.toString() ?? "_form";
          if (!rowErrors[path]) rowErrors[path] = [];
          rowErrors[path].push(issue.message);
        }
        newErrors[form.id] = rowErrors;
      } else {
        validInputs.push(result.data);
      }
    }

    setFieldErrors(newErrors);

    if (hasError) {
      setShowResults(false);
      return;
    }

    // Resolve each tactic. `id` is threaded through so the UI can map
    // resolved results back to form rows for selection / per-channel
    // subtotals that respect the selection checkboxes.
    const resolved = validInputs.map((input) =>
      resolveTactic({
        id: input.id,
        tacticName: input.tacticName,
        geoName: input.geoName,
        audienceName: input.audienceName,
        audienceSize: input.audienceSize,
        channel: input.channel,
        grps: input.grps,
        grossImpressions: input.grossImpressions,
        cost: input.cost,
        cpm: input.cpm,
        reachPercent: input.reachPercent,
        frequency: input.frequency,
      })
    );

    setResolvedTactics(resolved);

    // Auto-select all tactics so the full-plan and per-channel rollups
    // appear by default. `planSummary` / `planError` / `channelGroups` are
    // derived via useMemo from `resolvedTactics + selectedIds`, so toggling
    // selection after Calculate live-updates every summary.
    setSelectedIds(new Set(validInputs.map((t) => t.id)));

    setShowResults(true);
  }, [tactics]);

  // -----------------------------------------------------------------------
  // Export / Import
  // -----------------------------------------------------------------------

  const handleExport = useCallback(() => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tactics: tactics.map((form) => parseFormToInput(form)),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reach-frequency-plan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tactics]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.version !== 1 || !Array.isArray(json.tactics)) {
          alert("Invalid plan file format.");
          return;
        }
        const imported: TacticFormData[] = json.tactics.map(
          (t: Record<string, unknown>) => {
            const form: TacticFormData = {
              id: typeof t.id === "string" ? t.id : crypto.randomUUID(),
              tacticName: typeof t.tacticName === "string" ? t.tacticName : "",
              geoName: typeof t.geoName === "string" ? t.geoName : "",
              audienceName: typeof t.audienceName === "string" ? t.audienceName : "",
              audienceSize: t.audienceSize != null ? String(t.audienceSize) : "",
              channel: (typeof t.channel === "string" ? t.channel : "Digital") as TacticFormData["channel"],
              grps: t.grps != null ? String(t.grps) : "",
              grossImpressions: t.grossImpressions != null ? String(t.grossImpressions) : "",
              cost: t.cost != null ? String(t.cost) : "",
              cpm: t.cpm != null ? String(t.cpm) : "",
              reachPercent: t.reachPercent != null ? String(t.reachPercent) : "",
              frequency: t.frequency != null ? String(t.frequency) : "",
              dmaCode: typeof t.dmaCode === "string" ? t.dmaCode : "",
              demoSex: (t.demoSex === "adults" || t.demoSex === "males" || t.demoSex === "females") ? t.demoSex : "adults",
              demoAgeMin: typeof t.demoAgeMin === "number" ? t.demoAgeMin : 18,
              demoAgeMax: typeof t.demoAgeMax === "number" ? t.demoAgeMax : 999,
              demoIsHouseholds: typeof t.demoIsHouseholds === "boolean" ? t.demoIsHouseholds : false,
              audienceSizeOverridden: typeof t.audienceSizeOverridden === "boolean" ? t.audienceSizeOverridden : false,
              derivedCostField: null,
            };
            return form;
          }
        );
        setTactics(imported);
        setFieldErrors({});
        setShowResults(false);
        setSelectedIds(new Set());
      } catch {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = "";
  }, []);

  const handleLoadSeed = useCallback(() => {
    setTactics(SEED_TACTICS.map(tacticFormFromInput));
    setFieldErrors({});
    setShowResults(false);
    setSelectedIds(new Set());
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      {/* Header */}
      <header className="mb-6 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/unlock-logo.svg`}
          alt="Unlock Health"
          className="h-10 w-auto"
        />
        <div>
          <h1 className="text-2xl font-bold text-unlock-black">
            Reach &amp; Frequency Calculator
          </h1>
          <p className="mt-0.5 text-sm text-unlock-medium-gray">
            Enter media tactics, calculate reach/frequency/GRPs/CPM, and combine
            across tactics with deduplication.
          </p>
        </div>
      </header>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={handleAddRow}
          className="rounded bg-unlock-red px-3 py-1.5 text-sm font-medium text-white hover:bg-unlock-barn-red transition-colors"
        >
          + Add Tactic
        </button>
        <button
          onClick={handleLoadSeed}
          className="rounded bg-unlock-light-gray px-3 py-1.5 text-sm font-medium text-unlock-dark-gray hover:bg-unlock-medium-gray hover:text-white transition-colors"
        >
          Load Demo Data
        </button>
        <button
          onClick={handleExport}
          className="rounded bg-unlock-light-gray px-3 py-1.5 text-sm font-medium text-unlock-dark-gray hover:bg-unlock-medium-gray hover:text-white transition-colors"
        >
          Export JSON
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded bg-unlock-light-gray px-3 py-1.5 text-sm font-medium text-unlock-dark-gray hover:bg-unlock-medium-gray hover:text-white transition-colors"
        >
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {/* Tactic Input Table */}
      <div className="mb-6 overflow-x-auto rounded-lg border border-unlock-light-gray bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            {/* Group labels row */}
            <tr className="bg-gray-50 text-[10px] text-unlock-medium-gray uppercase tracking-wider">
              <th colSpan={6}></th>
              <th colSpan={2} className="px-2 pt-1.5 pb-0 text-center text-unlock-ocean border-l-2 border-l-unlock-sky">
                Net Cost + CPM
              </th>
              <th colSpan={2}></th>
              <th colSpan={2} className="px-2 pt-1.5 pb-0 text-center text-unlock-barn-red border-l-2 border-l-unlock-salmon">
                Reach + Freq
              </th>
              <th></th>
            </tr>
            {/* Column headers */}
            <tr className="border-b border-unlock-light-gray bg-gray-50 text-left text-xs uppercase tracking-wider text-unlock-medium-gray">
              <th className="px-2 py-2 text-center w-8">#</th>
              <th className="px-2 py-2">Tactic Name</th>
              <th className="px-2 py-2">Geo</th>
              <th className="px-2 py-2">Audience</th>
              <th className="px-2 py-2">Audience Size</th>
              <th className="px-2 py-2">Channel</th>
              <th className="px-2 py-2 border-l-2 border-l-unlock-sky">Net Cost ($)</th>
              <th className="px-2 py-2">CPM ($)</th>
              <th className="px-2 py-2">Gross Impr.</th>
              <th className="px-2 py-2">GRPs</th>
              <th className="px-2 py-2 border-l-2 border-l-unlock-salmon">Reach %</th>
              <th className="px-2 py-2">Frequency</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {tactics.map((t, i) => (
              <TacticFormRow
                key={t.id}
                data={t}
                index={i}
                errors={fieldErrors[t.id] ?? {}}
                onChange={handleFieldChange}
                onBatchChange={handleBatchChange}
                onRemove={handleRemove}
              />
            ))}
            {tactics.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-unlock-medium-gray">
                  No tactics added. Click &quot;+ Add Tactic&quot; or &quot;Load Demo Data&quot; to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Plan Selection & Calculate */}
      {tactics.length > 0 && (
        <div className="mb-6 rounded-lg border border-unlock-light-gray bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-unlock-black">
            Calculate Plan
          </h2>
          <p className="mb-3 text-xs text-unlock-medium-gray">
            Select 2+ tactics to combine reach (must share same geo and audience
            size). Single tactics are calculated individually.
          </p>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={handleSelectAll}
              className="rounded border border-unlock-light-gray px-2 py-1 text-xs text-unlock-dark-gray hover:bg-gray-100"
            >
              {selectedIds.size === tactics.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {tactics.map((t) => {
              const isSelected = selectedIds.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => handleToggleSelect(t.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? "border-unlock-ocean bg-unlock-ice text-unlock-ocean"
                      : "border-unlock-light-gray bg-white text-unlock-dark-gray hover:bg-gray-50"
                  }`}
                >
                  {t.tacticName || `Tactic ${tactics.indexOf(t) + 1}`}
                  {isSelected && " \u2713"}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCalculate}
            className="rounded bg-unlock-ocean px-5 py-2 text-sm font-semibold text-white hover:brightness-110 transition-all"
          >
            Calculate
          </button>
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-unlock-black">Results</h2>

          {/* Show Math toggle */}
          <ShowMathPanel />

          {/* Per-channel sections: each channel gets its own block of
              tactic cards + (optional) channel-level subtotal panel. */}
          {channelGroups.map((group) => (
            <section key={group.channel} className="space-y-3">
              <div className="flex items-baseline gap-2 border-b border-unlock-light-gray pb-1">
                <h3 className="text-base font-semibold text-unlock-black">
                  {group.channel}
                </h3>
                <span className="text-xs text-unlock-medium-gray">
                  {group.tactics.length}{" "}
                  {group.tactics.length === 1 ? "tactic" : "tactics"}
                  {group.selectedCount < group.tactics.length &&
                    ` · ${group.selectedCount} selected`}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.tactics.map((rt, i) => (
                  <TacticResultCard
                    key={rt.id ?? `${rt.tacticName}-${rt.geoName}-${i}`}
                    tactic={rt}
                  />
                ))}
              </div>

              {/* Channel subtotal — shown only when 2+ selected tactics in
                  this channel can be meaningfully combined (or explain why
                  they can't via reachError). */}
              {(group.summary || group.reachError) && (
                <PlanSummaryPanel
                  summary={group.summary}
                  audienceSize={group.tactics[0]?.audienceSize ?? 0}
                  reachError={group.reachError}
                  title={`${group.channel} Subtotal`}
                />
              )}
            </section>
          ))}

          {/* Full program rollup — sums across every channel. */}
          {planSummary && (
            <div className="space-y-4 border-t-2 border-unlock-sky pt-6">
              <PlanSummaryPanel
                summary={planSummary}
                audienceSize={selectedResolved[0]?.audienceSize ?? 0}
                reachError={planError}
                title="Full Program Rollup"
              />
              {!planError && (
                <CombinedReachSteps steps={planSummary.combinedReachSteps} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 border-t border-unlock-light-gray pt-4 text-xs text-unlock-medium-gray">
        <p>
          Reach &amp; Frequency Calculator — Uses Poisson approximation for Effective 3+
          and sequential remainder method for combined reach. No proprietary reach
          curves.
        </p>
      </footer>
    </div>
  );
}
