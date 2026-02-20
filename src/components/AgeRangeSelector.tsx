"use client";

import { useCallback, useMemo } from "react";
import { AGE_SNAP_POINTS, type Sex } from "@/lib/data/dmaAudienceData";

interface Props {
  ageMin: number;
  ageMax: number;
  sex: Sex;
  isHouseholds: boolean;
  onChangeAge: (ageMin: number, ageMax: number) => void;
  onChangeSex: (sex: Sex) => void;
  onToggleHouseholds: (hh: boolean) => void;
  hasError?: boolean;
}

// Slider steps correspond to AGE_SNAP_POINTS indices
// AGE_SNAP_POINTS: [18, 20, 21, 22, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85]
const STEP_COUNT = AGE_SNAP_POINTS.length - 1; // max index

function ageToStep(age: number): number {
  // Find the closest snap point index
  for (let i = AGE_SNAP_POINTS.length - 1; i >= 0; i--) {
    if (AGE_SNAP_POINTS[i] <= age) return i;
  }
  return 0;
}

function stepToAge(step: number): number {
  return AGE_SNAP_POINTS[Math.min(step, STEP_COUNT)];
}

// For the ageMax, we need to convert the snap point to the upper bound of that cell
// e.g., snap point 25 → ageMax 29 (because the cell is 25-29)
// The last snap point (85) → 999 (85+)
function stepToAgeMax(step: number): number {
  if (step >= STEP_COUNT) return 999; // 85+
  // The max for this snap point's cell is the next snap point minus 1
  return AGE_SNAP_POINTS[step + 1] - 1;
}

function ageMaxToStep(ageMax: number): number {
  if (ageMax >= 85) return STEP_COUNT;
  // Find the step where the next snap point - 1 equals ageMax
  for (let i = 0; i < STEP_COUNT; i++) {
    if (AGE_SNAP_POINTS[i + 1] - 1 >= ageMax && AGE_SNAP_POINTS[i] <= ageMax) {
      return i;
    }
  }
  return STEP_COUNT;
}

function formatAge(age: number): string {
  return age >= 85 ? "85+" : String(age);
}

function formatAgeMax(ageMax: number): string {
  return ageMax >= 85 ? "85+" : String(ageMax);
}

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "adults", label: "All" },
  { value: "males", label: "M" },
  { value: "females", label: "F" },
];

export default function AgeRangeSelector({
  ageMin,
  ageMax,
  sex,
  isHouseholds,
  onChangeAge,
  onChangeSex,
  onToggleHouseholds,
  hasError,
}: Props) {
  const minStep = ageToStep(ageMin);
  const maxStep = ageMaxToStep(ageMax);

  // Percentage positions for the colored track
  const minPercent = (minStep / STEP_COUNT) * 100;
  const maxPercent = (maxStep / STEP_COUNT) * 100;

  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStep = parseInt(e.target.value, 10);
      const clamped = Math.min(newStep, maxStep);
      onChangeAge(stepToAge(clamped), ageMax);
    },
    [maxStep, ageMax, onChangeAge]
  );

  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStep = parseInt(e.target.value, 10);
      const clamped = Math.max(newStep, minStep);
      onChangeAge(ageMin, stepToAgeMax(clamped));
    },
    [minStep, ageMin, onChangeAge]
  );

  const label = useMemo(() => {
    if (isHouseholds) return "Households";
    const sexLabel = sex === "adults" ? "Adults" : sex === "males" ? "Males" : "Females";
    return `${sexLabel} ${formatAge(ageMin)}-${formatAgeMax(ageMax)}`;
  }, [isHouseholds, sex, ageMin, ageMax]);

  return (
    <div className={`flex flex-col gap-1.5 ${hasError ? "text-unlock-red" : ""}`}>
      {/* Households toggle + label */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleHouseholds(!isHouseholds)}
          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            isHouseholds
              ? "border-unlock-ocean bg-unlock-ice text-unlock-ocean"
              : "border-unlock-light-gray bg-white text-unlock-medium-gray hover:bg-gray-50"
          }`}
          title="Switch to Households"
        >
          HH
        </button>
        <span className="text-xs font-medium text-unlock-dark-gray truncate" title={label}>
          {label}
        </span>
      </div>

      {!isHouseholds && (
        <>
          {/* Sex toggle */}
          <div className="flex gap-0.5">
            {SEX_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangeSex(opt.value)}
                className={`flex-1 rounded border px-1 py-0.5 text-[10px] font-medium transition-colors ${
                  sex === opt.value
                    ? "border-unlock-ocean bg-unlock-ice text-unlock-ocean"
                    : "border-unlock-light-gray bg-white text-unlock-medium-gray hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Dual range slider */}
          <div className="relative h-5 flex items-center">
            {/* Track background */}
            <div className="absolute inset-x-0 h-1 rounded-full bg-unlock-light-gray" />
            {/* Active track */}
            <div
              className="absolute h-1 rounded-full bg-unlock-ocean"
              style={{
                left: `${minPercent}%`,
                width: `${maxPercent - minPercent}%`,
              }}
            />
            {/* Min thumb */}
            <input
              type="range"
              min={0}
              max={STEP_COUNT}
              step={1}
              value={minStep}
              onChange={handleMinChange}
              className="absolute inset-x-0 appearance-none bg-transparent pointer-events-none
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto
                [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-unlock-ocean [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-unlock-ocean
                [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer"
              aria-label="Minimum age"
            />
            {/* Max thumb */}
            <input
              type="range"
              min={0}
              max={STEP_COUNT}
              step={1}
              value={maxStep}
              onChange={handleMaxChange}
              className="absolute inset-x-0 appearance-none bg-transparent pointer-events-none
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto
                [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-unlock-ocean [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-unlock-ocean
                [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer"
              aria-label="Maximum age"
            />
          </div>

          {/* Age labels */}
          <div className="flex justify-between text-[10px] text-unlock-medium-gray -mt-0.5">
            <span>{formatAge(ageMin)}</span>
            <span>{formatAgeMax(ageMax)}</span>
          </div>
        </>
      )}
    </div>
  );
}
