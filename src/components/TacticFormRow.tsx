"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { CHANNELS, type Channel } from "@/lib/schemas";
import { analyzeRowInputs, type OverallStatus } from "@/lib/inputStatus";
import SearchableSelect from "@/components/SearchableSelect";
import AgeRangeSelector from "@/components/AgeRangeSelector";
import {
  DMA_LIST,
  computeAudienceSize,
  getHouseholds,
  formatDemoLabel,
  type Sex,
} from "@/lib/data/dmaAudienceData";

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
  dmaCode: string;
  demoSex: Sex;
  demoAgeMin: number;
  demoAgeMax: number;
  demoIsHouseholds: boolean;
  audienceSizeOverridden: boolean;
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
    dmaCode: "",
    demoSex: "adults",
    demoAgeMin: 18,
    demoAgeMax: 999,
    demoIsHouseholds: false,
    audienceSizeOverridden: false,
  };
}

// Pre-compute dropdown option lists
const DMA_OPTIONS = DMA_LIST.map((d) => ({ value: d.code, label: d.name }));

interface Props {
  data: TacticFormData;
  index: number;
  errors: Record<string, string[]>;
  onChange: (id: string, field: keyof TacticFormData, value: string) => void;
  onBatchChange: (id: string, updates: Partial<TacticFormData>) => void;
  onRemove: (id: string) => void;
}

const STATUS_DOT_CLASSES: Record<OverallStatus, string> = {
  insufficient: "bg-unlock-light-gray",
  partial: "bg-amber-400",
  ready: "bg-emerald-500",
};

const STATUS_BANNER_CLASSES: Record<OverallStatus, string> = {
  insufficient: "bg-gray-50 text-unlock-medium-gray border-unlock-light-gray",
  partial: "bg-unlock-alabaster text-unlock-dark-gray border-unlock-salmon",
  ready: "bg-unlock-ice text-unlock-ocean border-unlock-sky",
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
  bgTint,
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
  bgTint?: string;
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
            ? "border-unlock-red bg-red-50 text-unlock-barn-red"
            : bgTint
            ? `border-unlock-light-gray ${bgTint} text-unlock-black`
            : "border-unlock-light-gray bg-white text-unlock-black"
        } focus:border-unlock-ocean focus:outline-none focus:ring-1 focus:ring-unlock-ocean`}
        title={hasError ? errors.join("; ") : undefined}
        step={type === "number" ? "any" : undefined}
      />
      {hasError && (
        <p className="mt-0.5 text-xs text-unlock-red leading-tight">{errors[0]}</p>
      )}
    </td>
  );
}

/**
 * Hook that triggers a brief flash animation whenever the value changes.
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

/** Compute audience size + label from current demo settings and DMA. */
function computeDemoUpdates(
  dmaCode: string,
  sex: Sex,
  ageMin: number,
  ageMax: number,
  isHouseholds: boolean,
  overridden: boolean
): Partial<TacticFormData> {
  const updates: Partial<TacticFormData> = {};

  if (isHouseholds) {
    updates.audienceName = "Households";
    if (dmaCode && !overridden) {
      const hh = getHouseholds(dmaCode);
      if (hh != null) updates.audienceSize = String(hh);
    }
  } else {
    updates.audienceName = formatDemoLabel(sex, ageMin, ageMax);
    if (dmaCode && !overridden) {
      const size = computeAudienceSize(dmaCode, ageMin, ageMax, sex);
      if (size != null) updates.audienceSize = String(size);
    }
  }

  return updates;
}

export default function TacticFormRow({
  data,
  index,
  errors,
  onChange,
  onBatchChange,
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
        channel: data.channel,
      }),
    [data.grps, data.grossImpressions, data.cost, data.cpm, data.reachPercent, data.frequency, data.channel]
  );

  const isFlashing = useFlashOnChange(inputStatus.guidanceMessage);

  const costCpmTint = inputStatus.activeGroups.includes("volume_costcpm")
    ? "bg-unlock-ice/40"
    : "";
  const reachFreqTint = inputStatus.activeGroups.includes("breakdown_reachfreq")
    ? "bg-unlock-salmon/20"
    : "";

  const bannerClasses = STATUS_BANNER_CLASSES[inputStatus.overallStatus];

  // Is audience size auto-filled (DMA set + demo configured + not manually overridden)?
  const hasDemoConfig = data.demoIsHouseholds || data.dmaCode !== "";
  const isAutoFilled = data.dmaCode !== "" && hasDemoConfig && !data.audienceSizeOverridden;

  return (
    <>
      <tr className={hasAnyError ? "bg-red-50/50" : index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
        {/* Row number + status dot */}
        <td className="px-2 py-1.5 text-center text-xs text-unlock-medium-gray font-mono">
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
        {/* DMA Geo dropdown */}
        <td className="px-2 py-1.5 min-w-[160px]">
          <SearchableSelect
            options={DMA_OPTIONS}
            value={data.dmaCode}
            placeholder="Select DMA..."
            hasError={!!errors.geoName?.length}
            onSelect={(code) => {
              const dma = DMA_LIST.find((d) => d.code === code);
              const demoUpdates = computeDemoUpdates(
                code, data.demoSex, data.demoAgeMin, data.demoAgeMax,
                data.demoIsHouseholds, data.audienceSizeOverridden
              );
              onBatchChange(data.id, {
                dmaCode: code,
                geoName: dma?.name ?? "",
                ...demoUpdates,
              });
            }}
          />
          {errors.geoName?.length > 0 && (
            <p className="mt-0.5 text-xs text-unlock-red leading-tight">{errors.geoName[0]}</p>
          )}
        </td>
        {/* Audience demographic: age range slider + sex toggle */}
        <td className="px-2 py-1.5 min-w-[150px]">
          <AgeRangeSelector
            ageMin={data.demoAgeMin}
            ageMax={data.demoAgeMax}
            sex={data.demoSex}
            isHouseholds={data.demoIsHouseholds}
            hasError={!!errors.audienceName?.length}
            onChangeAge={(ageMin, ageMax) => {
              const demoUpdates = computeDemoUpdates(
                data.dmaCode, data.demoSex, ageMin, ageMax,
                false, data.audienceSizeOverridden
              );
              onBatchChange(data.id, {
                demoAgeMin: ageMin,
                demoAgeMax: ageMax,
                demoIsHouseholds: false,
                ...demoUpdates,
              });
            }}
            onChangeSex={(sex) => {
              const demoUpdates = computeDemoUpdates(
                data.dmaCode, sex, data.demoAgeMin, data.demoAgeMax,
                false, data.audienceSizeOverridden
              );
              onBatchChange(data.id, {
                demoSex: sex,
                demoIsHouseholds: false,
                ...demoUpdates,
              });
            }}
            onToggleHouseholds={(hh) => {
              const demoUpdates = computeDemoUpdates(
                data.dmaCode, data.demoSex, data.demoAgeMin, data.demoAgeMax,
                hh, data.audienceSizeOverridden
              );
              onBatchChange(data.id, {
                demoIsHouseholds: hh,
                ...demoUpdates,
              });
            }}
          />
          {errors.audienceName?.length > 0 && (
            <p className="mt-0.5 text-xs text-unlock-red leading-tight">{errors.audienceName[0]}</p>
          )}
        </td>
        <FieldCell
          value={data.audienceSize}
          field="audienceSize"
          id={data.id}
          placeholder="e.g., 125000000"
          type="number"
          errors={errors.audienceSize}
          onChange={(id, field, value) => {
            onChange(id, field, value);
            if (!data.audienceSizeOverridden) {
              onBatchChange(data.id, { audienceSizeOverridden: true });
            }
          }}
          className="min-w-[120px]"
          bgTint={isAutoFilled ? "bg-unlock-ice" : undefined}
        />
        <td className="px-2 py-1.5">
          <select
            value={data.channel}
            onChange={(e) => onChange(data.id, "channel", e.target.value)}
            className="w-full rounded border border-unlock-light-gray bg-white px-2 py-1.5 text-sm focus:border-unlock-ocean focus:outline-none focus:ring-1 focus:ring-unlock-ocean"
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
            className="rounded p-1 text-unlock-medium-gray hover:bg-red-100 hover:text-unlock-red transition-colors"
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

      {/* Coaching guidance row */}
      <tr>
        <td colSpan={13} className="px-0 py-0">
          <div
            className={`mx-3 mb-1.5 mt-0.5 rounded border px-3 py-1.5 text-xs font-medium transition-all duration-300 ${bannerClasses} ${
              isFlashing ? "ring-2 ring-offset-1 ring-unlock-sky scale-[1.005]" : ""
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
