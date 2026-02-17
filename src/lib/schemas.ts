import { z } from "zod";

export const CHANNELS = [
  "TV",
  "Radio",
  "OOH",
  "Print",
  "Social",
  "Digital",
  "Other",
] as const;

export type Channel = (typeof CHANNELS)[number];

export const tacticInputSchema = z
  .object({
    id: z.string(),
    tacticName: z
      .string()
      .min(1, "Tactic name is required")
      .max(100, "Tactic name must be 100 characters or fewer"),
    geoName: z
      .string()
      .min(1, "Geo / market name is required")
      .max(100, "Geo name must be 100 characters or fewer"),
    audienceName: z
      .string()
      .min(1, "Audience name is required")
      .max(100, "Audience name must be 100 characters or fewer"),
    audienceSize: z
      .number({ invalid_type_error: "Audience size must be a number" })
      .int("Audience size must be a whole number")
      .positive("Audience size must be greater than 0"),
    channel: z.enum(CHANNELS, {
      errorMap: () => ({ message: `Channel must be one of: ${CHANNELS.join(", ")}` }),
    }),

    // Optional input fields — user provides whichever set they have
    grps: z
      .number()
      .min(0, "GRPs cannot be negative")
      .optional()
      .nullable()
      .transform((v) => v ?? undefined),
    grossImpressions: z
      .number()
      .min(0, "Gross impressions cannot be negative")
      .optional()
      .nullable()
      .transform((v) => v ?? undefined),
    cost: z
      .number()
      .min(0, "Cost cannot be negative")
      .optional()
      .nullable()
      .transform((v) => v ?? undefined),
    cpm: z
      .number()
      .positive("CPM must be greater than 0")
      .optional()
      .nullable()
      .transform((v) => v ?? undefined),
    reachPercent: z
      .number()
      .min(0, "Reach% cannot be negative")
      .max(100, "Reach% cannot exceed 100")
      .optional()
      .nullable()
      .transform((v) => v ?? undefined),
    frequency: z
      .number()
      .min(0, "Frequency cannot be negative")
      .optional()
      .nullable()
      .transform((v) => v ?? undefined),
  })
  .refine(
    (data) => {
      // Must provide at least one input set
      const hasGRPs = data.grps != null;
      const hasImpressions = data.grossImpressions != null;
      const hasCostCPM = data.cost != null && data.cpm != null;
      const hasReachFreq = data.reachPercent != null && data.frequency != null;
      const hasReachOnly = data.reachPercent != null;
      return hasGRPs || hasImpressions || hasCostCPM || hasReachFreq || hasReachOnly;
    },
    {
      message:
        "Provide at least one input set: GRPs, Gross Impressions, Cost+CPM, Reach%+Frequency, or Reach%.",
    }
  );

export type TacticInput = z.infer<typeof tacticInputSchema>;

/** Validate that all tactics share the same geo and audience size for combining */
export function validateCombinableGroup(
  tactics: { geoName: string; audienceName: string; audienceSize: number; tacticName: string }[]
): { valid: boolean; error?: string } {
  if (tactics.length < 2) return { valid: true };

  const firstGeo = tactics[0].geoName;
  const firstAudienceSize = tactics[0].audienceSize;

  const mismatchedGeo = tactics.find((t) => t.geoName !== firstGeo);
  if (mismatchedGeo) {
    return {
      valid: false,
      error: `Cannot combine tactics with different geographies. "${tactics[0].tacticName}" uses geo "${firstGeo}" but "${mismatchedGeo.tacticName}" uses geo "${mismatchedGeo.geoName}". All tactics must share the same geo.`,
    };
  }

  const mismatchedAudience = tactics.find((t) => t.audienceSize !== firstAudienceSize);
  if (mismatchedAudience) {
    return {
      valid: false,
      error: `Cannot combine tactics with different audience sizes. "${tactics[0].tacticName}" has audience size ${firstAudienceSize.toLocaleString()} but "${mismatchedAudience.tacticName}" has audience size ${mismatchedAudience.audienceSize.toLocaleString()}. All tactics must target the same audience size.`,
    };
  }

  return { valid: true };
}

/** Schema for export/import of plan data */
export const planExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  tactics: z.array(tacticInputSchema),
});

export type PlanExport = z.infer<typeof planExportSchema>;
