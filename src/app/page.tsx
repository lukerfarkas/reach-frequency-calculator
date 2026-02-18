"use client";

import { useState, useCallback, useRef } from "react";
import TacticFormRow, {
  type TacticFormData,
  emptyTacticForm,
} from "@/components/TacticFormRow";
import TacticResultCard from "@/components/TacticResultCard";
import PlanSummaryPanel from "@/components/PlanSummaryPanel";
import CombinedReachSteps from "@/components/CombinedReachSteps";
import ShowMathPanel from "@/components/ShowMathPanel";
import { tacticInputSchema, validateCombinableGroup } from "@/lib/schemas";
import { resolveTactic, type ResolvedTactic } from "@/lib/math/resolver";
import { computePlanSummary, type PlanSummaryResult } from "@/lib/math/calculations";
import { SEED_TACTICS } from "@/lib/seedData";
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
  };
}

function parseFormToInput(form: TacticFormData): Record<string, unknown> {
  return {
    id: form.id,
    tacticName: form.tacticName.trim(),
    geoName: form.geoName.trim(),
    audienceName: form.audienceName.trim(),
    audienceSize: form.audienceSize ? Number(form.audienceSize) : undefined,
    channel: form.channel,
    grps: form.grps ? Number(form.grps) : null,
    grossImpressions: form.grossImpressions ? Number(form.grossImpressions) : null,
    cost: form.cost ? Number(form.cost) : null,
    cpm: form.cpm ? Number(form.cpm) : null,
    reachPercent: form.reachPercent ? Number(form.reachPercent) : null,
    frequency: form.frequency ? Number(form.frequency) : null,
  };
}

type FieldErrors = Record<string, Record<string, string[]>>;

// -------------------------------------------------------------------------
// Page
// -------------------------------------------------------------------------

export default function HomePage() {
  // Tactic form rows
  const [tactics, setTactics] = useState<TacticFormData[]>(() =>
    SEED_TACTICS.map(tacticFormFromInput)
  );

  // Validation errors per row
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Selection for plan calculation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Results
  const [resolvedTactics, setResolvedTactics] = useState<ResolvedTactic[]>([]);
  const [planSummary, setPlanSummary] = useState<PlanSummaryResult | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

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

    // Resolve each tactic
    const resolved = validInputs.map((input) =>
      resolveTactic({
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

    // Plan summary for selected tactics
    const selectedResolved = resolved.filter((r) =>
      selectedIds.has(tactics.find((t) => t.tacticName === r.tacticName)?.id ?? "")
    );

    // Match by id more reliably
    const selectedResolvedById = resolved.filter((_r, i) =>
      selectedIds.has(validInputs[i]?.id ?? "")
    );

    if (selectedResolvedById.length >= 2) {
      // Check geo/audience guardrail
      const combineCheck = validateCombinableGroup(selectedResolvedById);
      if (!combineCheck.valid) {
        setPlanError(combineCheck.error ?? "Cannot combine these tactics.");
        setPlanSummary(null);
      } else {
        // Check all selected have reach%
        const withReach = selectedResolvedById.filter(
          (r) => r.reachPercent != null && r.grps != null
        );
        if (withReach.length < selectedResolvedById.length) {
          setPlanError(
            "Some selected tactics do not have Reach% or GRPs computed. Cannot combine."
          );
          setPlanSummary(null);
        } else {
          setPlanError(null);
          const summary = computePlanSummary(
            withReach.map((r) => ({
              tacticName: r.tacticName,
              reachPercent: r.reachPercent!,
              grps: r.grps!,
            })),
            withReach[0].audienceSize
          );
          setPlanSummary(summary);
        }
      }
    } else if (selectedResolvedById.length === 1) {
      setPlanError(null);
      setPlanSummary(null);
    } else {
      setPlanError(null);
      setPlanSummary(null);
    }

    setShowResults(true);
  }, [tactics, selectedIds]);

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
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Reach &amp; Frequency Calculator
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter media tactics, calculate reach/frequency/GRPs, and combine across
          tactics with deduplication.
        </p>
      </header>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={handleAddRow}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Add Tactic
        </button>
        <button
          onClick={handleLoadSeed}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 transition-colors"
        >
          Load Demo Data
        </button>
        <button
          onClick={handleExport}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 transition-colors"
        >
          Export JSON
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 transition-colors"
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
      <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            {/* Group labels row */}
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase tracking-wider">
              <th colSpan={6}></th>
              <th colSpan={2} className="px-2 pt-1.5 pb-0 text-center text-blue-500 border-l-2 border-l-blue-200">
                Cost + CPM
              </th>
              <th colSpan={2}></th>
              <th colSpan={2} className="px-2 pt-1.5 pb-0 text-center text-purple-500 border-l-2 border-l-purple-200">
                Reach + Freq
              </th>
              <th></th>
            </tr>
            {/* Column headers */}
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-2 py-2 text-center w-8">#</th>
              <th className="px-2 py-2">Tactic Name</th>
              <th className="px-2 py-2">Geo</th>
              <th className="px-2 py-2">Audience</th>
              <th className="px-2 py-2">Audience Size</th>
              <th className="px-2 py-2">Channel</th>
              <th className="px-2 py-2 border-l-2 border-l-blue-200">Cost ($)</th>
              <th className="px-2 py-2">CPM ($)</th>
              <th className="px-2 py-2">Gross Impr.</th>
              <th className="px-2 py-2">GRPs</th>
              <th className="px-2 py-2 border-l-2 border-l-purple-200">Reach %</th>
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
                onRemove={handleRemove}
              />
            ))}
            {tactics.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                  No tactics added. Click &quot;+ Add Tactic&quot; or &quot;Load Demo Data&quot; to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Plan Selection & Calculate */}
      {tactics.length > 0 && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-gray-800">
            Calculate Plan
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Select 2+ tactics to combine reach (must share same geo and audience
            size). Single tactics are calculated individually.
          </p>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={handleSelectAll}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
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
                      ? "border-blue-500 bg-blue-100 text-blue-700"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t.tacticName || `Tactic ${tactics.indexOf(t) + 1}`}
                  {isSelected && " ✓"}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCalculate}
            className="rounded bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Calculate
          </button>
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Results</h2>

          {/* Show Math toggle */}
          <ShowMathPanel />

          {/* Tactic cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resolvedTactics.map((rt, i) => (
              <TacticResultCard key={i} tactic={rt} />
            ))}
          </div>

          {/* Plan Error */}
          {planError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              <strong>Cannot combine tactics:</strong> {planError}
            </div>
          )}

          {/* Plan Summary */}
          {planSummary && (
            <div className="space-y-4">
              <PlanSummaryPanel
                summary={planSummary}
                audienceSize={resolvedTactics[0]?.audienceSize ?? 0}
              />
              <CombinedReachSteps steps={planSummary.combinedReachSteps} />
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 pt-4 text-xs text-gray-400">
        <p>
          Reach &amp; Frequency Calculator — Uses Poisson approximation for Effective 3+
          and sequential remainder method for combined reach. No proprietary reach
          curves.
        </p>
      </footer>
    </div>
  );
}
