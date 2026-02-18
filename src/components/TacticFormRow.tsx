"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { CHANNELS, type Channel } from "@/lib/schemas";
import { analyzeRowInputs, type OverallStatus } from "@/lib/inputStatus";

export interface TacticFormData {
  id: string;
  tacticName: string;
  geoName: string;
  audienceName: string;
  audienceSize: string;
  channel: Channel;
  grps: string;
  grossImpressions: string;
  cost: string;
  cpm: string;
  reachPercent: string;
  frequency: string;
}

export function emptyTacticForm(id?: string): TacticFormData {
  return {
    id: id ?? crypto.randomUUID(),
    tacticName: "",
    geoName: "",
    audienceName: "",
    audienceSize: "",
    channel: "Digital",
    grps: "",
    grossImpressions: "",
    cost: "",
    cpm: "",
    reachPercent: "",
    frequency: "",
  };
}

interface Props {
  data: TacticFormData;
  index: number;
  errors: Record<string, string[]>;
  onChange: (id: string, field: keyof TacticFormData, value: string) => void;
  onRemove: (id: string) => void;
}

const STATUS_DOT_CLASSES: Record<OverallStatus, string> = {
  insufficient: "bg-gray-300",
  partial: "bg-amber-400",
  ready: "bg-emerald-500",
};

const STATUS_BANNER_CLASSES: Record<OverallStatus, string> = {
  insufficient: "bg-gray-50 text-gray-500 border-gray-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function FieldCell({
  value,
  field,
  id,
  placeholder,
  type,
  errors,
  onChange,
  className,
  groupTint,
}: {
  value: string;
  field: keyof TacticFormData;
  id: string;
  placeholder: string;
  type?: string;
  errors?: string[];
  onChange: Props["onChange"];
  className?: string;
  groupTint?: string;
}) {
  const hasError = errors && errors.length > 0;
  return (
    <td className={`px-2 py-1.5 ${groupTint ?? ""} ${className ?? ""}`}>
      <input
        type={type ?? "text"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(id, field, e.target.value)}
        className={`w-full rounded border px-2 py-1.5 text-sm ${
          hasError
            ? "border-red-400 bg-red-50 text-red-800"
            : "border-gray-300 bg-white text-gray-900"
        } focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
        title={hasError ? errors.join("; ") : undefined}
        step={type === "number" ? "any" : undefined}
      />
      {hasError && (
        <p className="mt-0.5 text-xs text-red-600 leading-tight">{errors[0]}</p>
      )}
    </td>
  );
}

/**
 * Hook that triggers a brief flash animation whenever the value changes.
 * Returns true for a short duration after each change.
 */
function useFlashOnChange(value: string): boolean {
  const [flashing, setFlashing] = useState(false);
  const prevValue = useRef(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      setFlashing(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setFlashing(false), 600);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value]);

  return flashing;
}

export default function TacticFormRow({
  data,
  index,
  errors,
  onChange,
  onRemove,
}: Props) {
  const hasAnyError = Object.keys(errors).length > 0;

  const inputStatus = useMemo(
    () =>
      analyzeRowInputs({
        grps: data.grps,
        grossImpressions: data.grossImpressions,
        cost: data.cost,
        cpm: data.cpm,
        reachPercent: data.reachPercent,
        frequency: data.frequency,
      }),
    [data.grps, data.grossImpressions, data.cost, data.cpm, data.reachPercent, data.frequency]
  );

  // Flash animation when the guidance message changes
  const isFlashing = useFlashOnChange(inputStatus.guidanceMessage);

  // Group highlight tints (only when the group is actively being used)
  const costCpmTint = inputStatus.activeGroups.includes("volume_costcpm")
    ? "bg-blue-50/60"
    : "";
  const reachFreqTint = inputStatus.activeGroups.includes("breakdown_reachfreq")
    ? "bg-purple-50/60"
    : "";

  const bannerClasses = STATUS_BANNER_CLASSES[inputStatus.overallStatus];

  return (
    <>
      <tr className={hasAnyError ? "bg-red-50/50" : index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
        {/* Row number + status dot */}
        <td className="px-2 py-1.5 text-center text-xs text-gray-500 font-mono">
          <span className="inline-flex items-center gap-1">
            <span
              className={`inline-block w-2 h-2 rounded-full transition-colors duration-300 ${STATUS_DOT_CLASSES[inputStatus.overallStatus]}`}
              title={inputStatus.guidanceMessage}
              aria-label={`Row status: ${inputStatus.overallStatus} — ${inputStatus.guidanceMessage}`}
            />
            {index + 1}
          </span>
        </td>
        <FieldCell
          value={data.tacticName}
          field="tacticName"
          id={data.id}
          placeholder="e.g., TV Spot Q1"
          errors={errors.tacticName}
          onChange={onChange}
          className="min-w-[140px]"
        />
        <FieldCell
          value={data.geoName}
          field="geoName"
          id={data.id}
          placeholder="e.g., US National"
          errors={errors.geoName}
          onChange={onChange}
          className="min-w-[110px]"
        />
        <FieldCell
          value={data.audienceName}
          field="audienceName"
          id={data.id}
          placeholder="e.g., Adults 25-54"
          errors={errors.audienceName}
          onChange={onChange}
          className="min-w-[110px]"
        />
        <FieldCell
          value={data.audienceSize}
          field="audienceSize"
          id={data.id}
          placeholder="e.g., 125000000"
          type="number"
          errors={errors.audienceSize}
          onChange={onChange}
          className="min-w-[120px]"
        />
        <td className="px-2 py-1.5">
          <select
            value={data.channel}
            onChange={(e) => onChange(data.id, "channel", e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </td>
        <FieldCell
          value={data.cost}
          field="cost"
          id={data.id}
          placeholder="$"
          type="number"
          errors={errors.cost}
          onChange={onChange}
          className="min-w-[90px]"
          groupTint={costCpmTint}
        />
        <FieldCell
          value={data.cpm}
          field="cpm"
          id={data.id}
          placeholder="$"
          type="number"
          errors={errors.cpm}
          onChange={onChange}
          className="min-w-[70px]"
          groupTint={costCpmTint}
        />
        <FieldCell
          value={data.grossImpressions}
          field="grossImpressions"
          id={data.id}
          placeholder="#"
          type="number"
          errors={errors.grossImpressions}
          onChange={onChange}
          className="min-w-[100px]"
        />
        <FieldCell
          value={data.grps}
          field="grps"
          id={data.id}
          placeholder="#"
          type="number"
          errors={errors.grps}
          onChange={onChange}
          className="min-w-[70px]"
        />
        <FieldCell
          value={data.reachPercent}
          field="reachPercent"
          id={data.id}
          placeholder="%"
          type="number"
          errors={errors.reachPercent}
          onChange={onChange}
          className="min-w-[70px]"
          groupTint={reachFreqTint}
        />
        <FieldCell
          value={data.frequency}
          field="frequency"
          id={data.id}
          placeholder="#"
          type="number"
          errors={errors.frequency}
          onChange={onChange}
          className="min-w-[70px]"
          groupTint={reachFreqTint}
        />
        <td className="px-2 py-1.5 text-center">
          <button
            onClick={() => onRemove(data.id)}
            className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="Remove tactic"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </td>
      </tr>

      {/* Coaching guidance row — always visible */}
      <tr>
        <td colSpan={13} className="px-0 py-0">
          <div
            className={`mx-3 mb-1.5 mt-0.5 rounded border px-3 py-1.5 text-xs font-medium transition-all duration-300 ${bannerClasses} ${
              isFlashing ? "ring-2 ring-offset-1 ring-blue-300 scale-[1.005]" : ""
            }`}
            role="status"
            aria-live="polite"
          >
            {inputStatus.overallStatus === "ready" ? (
              <span>&#10003; {inputStatus.guidanceMessage}</span>
            ) : (
              <span>&#8594; {inputStatus.guidanceMessage}</span>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}
