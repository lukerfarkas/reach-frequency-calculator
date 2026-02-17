"use client";

import { CHANNELS, type Channel } from "@/lib/schemas";

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

function FieldCell({
  value,
  field,
  id,
  placeholder,
  type,
  errors,
  onChange,
  className,
}: {
  value: string;
  field: keyof TacticFormData;
  id: string;
  placeholder: string;
  type?: string;
  errors?: string[];
  onChange: Props["onChange"];
  className?: string;
}) {
  const hasError = errors && errors.length > 0;
  return (
    <td className={`px-2 py-1.5 ${className ?? ""}`}>
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

export default function TacticFormRow({
  data,
  index,
  errors,
  onChange,
  onRemove,
}: Props) {
  const hasAnyError = Object.keys(errors).length > 0;

  return (
    <tr className={hasAnyError ? "bg-red-50/50" : index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
      <td className="px-2 py-1.5 text-center text-xs text-gray-500 font-mono">
        {index + 1}
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
  );
}
