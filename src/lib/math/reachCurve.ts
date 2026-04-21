/**
 * TV Reach Curve — Calibrated Saturation Model
 *
 * ## Background
 *
 * The prior model used a simple exponential saturation:
 *   Reach% = 100 × (1 − e^(−k × GRPs / 100))
 *
 * This overestimated unique reach and underestimated frequency compared
 * with Citrix planning outputs. Citrix appears to model:
 *   - A reach ceiling well below 100% (typically ~85–92%)
 *   - Greater audience duplication as GRPs increase
 *   - Frequency that rises faster once reach begins to saturate
 *
 * ## Current Model
 *
 * We now use a ceiling-capped exponential with a light duplication adjustment:
 *
 *   rawReach = maxReach × (1 − e^(−k × GRPs))
 *   duplicationPenalty = duplicationBase + duplicationGrowth × (1 − e^(−GRPs / duplicationHalfLife))
 *   adjustedReach = rawReach × (1 − duplicationPenalty)
 *
 * Most of the reach shaping comes from the exponential curve and ceiling.
 * The duplication penalty is intentionally light (~4–9% at typical GRP
 * levels), nudging outputs toward more realistic splits without dominating
 * the model at low-to-mid GRPs.
 *
 * Frequency is then derived as: frequency = GRPs / adjustedReach
 *
 * ## Effective 3+
 *
 * The Poisson λ for effective 3+ is based on the adjusted frequency
 * (GRPs / adjustedReach%) rather than the raw λ = GRPs / 100. This
 * keeps effective 3+ internally consistent with the higher-frequency
 * model — viewers who are reached see more impressions on average.
 *
 * ## Daypart Weighting (Placeholder)
 *
 * Citrix likely uses daypart-level assumptions (prime, daytime, news,
 * late night) that affect both reach efficiency and duplication rates.
 * The DaypartMix type below is a placeholder for future implementation.
 * When daypart data is available, the k-factor and duplication parameters
 * can be weighted by daypart mix to produce more accurate estimates.
 */

// ---------------------------------------------------------------------------
// Calibration Constants — tune these to match Citrix outputs
// ---------------------------------------------------------------------------

/**
 * TV reach model calibration parameters.
 *
 * Adjust these to align with observed Citrix behavior:
 *   - maxReach: the asymptotic ceiling (Citrix appears to use ~0.90–0.95)
 *   - k: curve steepness applied directly to GRPs (higher = faster initial reach)
 *   - duplicationBase: minimum duplication penalty even at low GRPs
 *   - duplicationGrowth: maximum additional duplication that builds with GRPs
 *   - duplicationHalfLife: GRP level at which duplication growth is ~63% realized
 *
 * Design note: most of the reach shaping comes from the exponential curve
 * and ceiling. Duplication is intentionally a light correction — it nudges
 * high-GRP outputs toward more realistic reach/frequency splits without
 * dominating the model at low-to-mid GRP levels.
 */
export interface TVCalibration {
  /** Maximum reach as a fraction of audience (0–1). Default 0.93. */
  maxReach: number;
  /** Curve steepness applied directly to GRPs: exp(-k × GRPs). Default 0.0082. */
  k: number;
  /** Baseline duplication penalty (fraction, 0–1). Default 0.03. */
  duplicationBase: number;
  /** Maximum additional duplication growth (fraction). Default 0.13. */
  duplicationGrowth: number;
  /** GRP level at which duplication growth is ~63% realized. Default 120. */
  duplicationHalfLife: number;
}

/**
 * Default TV calibration — tuned for Citrix alignment.
 *
 * These values are set to produce:
 *   - Lower reach than the legacy exponential model at all GRP levels
 *   - Higher frequency at all GRP levels
 *   - Reach ceiling ~84–85% even at very high GRPs
 *   - Duplication penalty (~10–16%) that ramps quickly in mid-range
 *   - Effective 3+ that reflects the adjusted frequency
 *
 * Reference outputs:
 *   Legacy: 100 GRPs → 63.2% reach, 1.58× freq
 *   This:   100 GRPs → ~47% reach, ~2.14× freq
 *   Legacy: 200 GRPs → 86.5% reach, 2.31× freq
 *   This:   200 GRPs → ~65% reach, ~3.09× freq
 *   Legacy: 300 GRPs → 95.0% reach, 3.16× freq
 *   This:   300 GRPs → ~72% reach, ~4.15× freq
 *
 * Tuning notes:
 *   - k is applied directly to GRPs (no /100 scaling) — smaller values
 *     slow initial reach growth, larger values speed it up
 *   - Duplication is a light adjustment; most shaping comes from
 *     the curve + ceiling. Increase dupGrowth or lower dupHL to
 *     compress reach further at high GRPs.
 */
export const TV_CALIBRATION_DEFAULT: TVCalibration = {
  maxReach: 0.93,
  k: 0.0082,
  duplicationBase: 0.03,
  duplicationGrowth: 0.13,
  duplicationHalfLife: 120,
};

// ---------------------------------------------------------------------------
// Radio Calibration
// ---------------------------------------------------------------------------

/**
 * Default Radio calibration.
 *
 * Radio typically has lower unique reach than TV (not everyone listens)
 * and builds frequency faster (loyal/habitual listeners). These defaults
 * reflect that with a lower ceiling and more duplication.
 *
 * Reference outputs:
 *   100 GRPs → ~42% reach, ~2.4× freq
 *   200 GRPs → ~58% reach, ~3.4× freq
 *   500 GRPs → ~69% reach, ~7.2× freq
 *   719 GRPs → ~70% reach, ~10.3× freq
 *
 * These are starting estimates — calibrate against Citrix Radio outputs.
 */
export const RADIO_CALIBRATION_DEFAULT: TVCalibration = {
  maxReach: 0.85,
  k: 0.008,
  duplicationBase: 0.035,
  duplicationGrowth: 0.14,
  duplicationHalfLife: 150,
};

// ---------------------------------------------------------------------------
// Print Calibration
// ---------------------------------------------------------------------------

/**
 * Default Print calibration.
 *
 * Print (magazines + newspapers) has structurally lower reach ceilings than
 * broadcast — readership is smaller and slower-building. Industry reach
 * curves (MRI/Simmons-style) flatten early and accumulate reach gradually
 * through repeat insertions, which maps to a low max ceiling, a slow k,
 * and moderate duplication that grows steadily.
 *
 * Starting estimates — refine against MRI/Simmons reach reports when
 * those are available. Flagged "curve" so the resolver auto-estimates;
 * planners can always override by entering Reach% + Frequency directly.
 *
 * Reference outputs (actual, with these defaults):
 *   100 GRPs → ~26% reach, ~3.8× freq
 *   200 GRPs → ~39% reach, ~5.1× freq
 *   500 GRPs → ~50% reach, ~10× freq
 *  1000 GRPs → ~52% reach, ~19× freq  (asymptotes ~52% — print saturates)
 */
export const PRINT_CALIBRATION_DEFAULT: TVCalibration = {
  maxReach: 0.65,
  k: 0.006,
  duplicationBase: 0.05,
  duplicationGrowth: 0.15,
  duplicationHalfLife: 200,
};

// ---------------------------------------------------------------------------
// OOH Calibration
// ---------------------------------------------------------------------------

/**
 * Default OOH calibration (Geopath-style).
 *
 * OOH is the opposite of Print in many ways: very high reach ceilings
 * (billboards are hard to miss if you're in-market), a steep k (reach
 * builds quickly with rating points), but high duplication growth (the
 * same commuters see the same boards repeatedly), so frequency spikes
 * fast once reach saturates.
 *
 * Starting estimates — refine against Geopath OOH outputs when available.
 *
 * Reference outputs (actual, with these defaults):
 *   100 GRPs → ~56% reach, ~1.8× freq
 *   200 GRPs → ~64% reach, ~3.1× freq
 *   500 GRPs → ~65% reach, ~7.8× freq
 *  1000 GRPs → ~64% reach, ~16× freq   (asymptotes ~64% — ceiling × (1-maxDup))
 */
export const OOH_CALIBRATION_DEFAULT: TVCalibration = {
  maxReach: 0.92,
  k: 0.015,
  duplicationBase: 0.08,
  duplicationGrowth: 0.22,
  duplicationHalfLife: 100,
};

// ---------------------------------------------------------------------------
// Channel Registry — single source of truth for per-channel behavior
// ---------------------------------------------------------------------------

/**
 * Whether the resolver should auto-estimate Reach% / Frequency for this
 * channel when only volume (GRPs / impressions / cost+cpm) is provided.
 *
 *   "curve"  — use the calibrated saturation model with the channel's
 *              calibration. (TV, Radio, Print, OOH.)
 *   "manual" — no auto-estimation; user must enter Reach% or Frequency
 *              directly. (Digital, Social, Other — channels where a
 *              single saturation curve isn't a defensible approximation.)
 */
export type ChannelEstimationMode = "curve" | "manual";

export interface ChannelConfig {
  /** Channel name (must match one of `CHANNELS` in schemas.ts). */
  channel: string;
  mode: ChannelEstimationMode;
  /** Calibration to use when mode === "curve". */
  calibration?: TVCalibration;
  /**
   * Plain-language explanation shown to the user when a manual-only
   * channel has volume but no Reach% / Frequency.
   */
  manualOnlyReason?: string;
}

/**
 * Central registry of per-channel behavior. Every entry in the `CHANNELS`
 * array in schemas.ts MUST have a ChannelConfig here — this is enforced
 * by a regression test (see reachCurve.test.ts and resolver.test.ts).
 *
 * When adding a new channel:
 *   1. Add it to `CHANNELS` in schemas.ts.
 *   2. Add a ChannelConfig entry here (mode + calibration or reason).
 *   3. The resolver, inputStatus, and UI pick it up automatically.
 */
export const CHANNEL_CONFIG: Record<string, ChannelConfig> = {
  TV: {
    channel: "TV",
    mode: "curve",
    calibration: TV_CALIBRATION_DEFAULT,
  },
  Radio: {
    channel: "Radio",
    mode: "curve",
    calibration: RADIO_CALIBRATION_DEFAULT,
  },
  Print: {
    channel: "Print",
    mode: "curve",
    calibration: PRINT_CALIBRATION_DEFAULT,
  },
  OOH: {
    channel: "OOH",
    mode: "curve",
    calibration: OOH_CALIBRATION_DEFAULT,
  },
  Digital: {
    channel: "Digital",
    mode: "manual",
    manualOnlyReason:
      "Digital reach depends on platform mix, frequency caps, and targeting — a single saturation curve is not a defensible approximation. Enter Reach% and Frequency from your platform reports or media plan.",
  },
  Social: {
    channel: "Social",
    mode: "manual",
    manualOnlyReason:
      "Social reach varies widely by platform, creative, and targeting — a single curve is not a defensible approximation. Enter Reach% and Frequency from your platform reports.",
  },
  Other: {
    channel: "Other",
    mode: "manual",
    manualOnlyReason:
      "Custom channels have no built-in reach model. Enter Reach% and Frequency directly from your data source.",
  },
};

/** Look up a channel's config. Returns `null` if the channel is unknown. */
export function getChannelConfig(channel: string): ChannelConfig | null {
  return CHANNEL_CONFIG[channel] ?? null;
}

/** True when the channel has a calibrated reach curve. */
export function isAutoEstimateChannel(channel: string): boolean {
  return getChannelConfig(channel)?.mode === "curve";
}

// ---------------------------------------------------------------------------
// Daypart Weighting — placeholder for future implementation
// ---------------------------------------------------------------------------

/**
 * Daypart mix for a TV buy. Each field is the fraction of GRPs allocated
 * to that daypart (should sum to 1.0).
 *
 * Different dayparts have different reach efficiencies:
 *   - Prime: highest reach per GRP, lower duplication
 *   - Daytime: lower reach per GRP, higher duplication
 *   - Late night: narrow audience, high duplication
 *   - News: moderate reach, moderate duplication
 *
 * When implemented, each daypart would have its own k and duplication
 * multipliers that blend based on the mix.
 */
export interface DaypartMix {
  prime: number;
  daytime: number;
  lateNight: number;
  news: number;
  other: number;
}

/**
 * Daypart-specific calibration coefficients (placeholder).
 * These would multiply the base k and duplication parameters.
 *
 * Example future usage:
 *   effectiveK = sum(daypartMix[dp] * DAYPART_COEFFICIENTS[dp].kMultiplier * baseK)
 */
export const DAYPART_COEFFICIENTS: Record<
  keyof DaypartMix,
  { kMultiplier: number; duplicationMultiplier: number }
> = {
  prime: { kMultiplier: 1.15, duplicationMultiplier: 0.85 },
  daytime: { kMultiplier: 0.80, duplicationMultiplier: 1.20 },
  lateNight: { kMultiplier: 0.70, duplicationMultiplier: 1.35 },
  news: { kMultiplier: 0.95, duplicationMultiplier: 1.05 },
  other: { kMultiplier: 0.85, duplicationMultiplier: 1.10 },
};

// ---------------------------------------------------------------------------
// Core TV Reach Model
// ---------------------------------------------------------------------------

/**
 * Full TV reach estimation result, including intermediate values
 * for transparency and debugging.
 */
export interface TVReachResult {
  /** Final adjusted Reach% after duplication penalty (0–100). */
  reachPercent: number;
  /** Raw reach before duplication adjustment (0–100). */
  rawReachPercent: number;
  /** Duplication penalty applied (fraction, e.g., 0.08 = 8%). */
  duplicationPenalty: number;
  /** Derived average frequency = GRPs / adjustedReach%. */
  frequency: number;
  /** Adjusted lambda for Poisson effective 3+ calculation. */
  effectiveLambda: number;
  /** The calibration used. */
  calibration: TVCalibration;
}

/**
 * Estimate TV Reach%, frequency, and effective lambda from GRPs
 * using the calibrated saturation model with duplication adjustment.
 *
 * @param grps - Gross Rating Points (must be ≥ 0)
 * @param calibration - Calibration parameters (defaults to TV_CALIBRATION_DEFAULT)
 * @returns Full result including reach, frequency, and effective lambda
 */
export function estimateTVReach(
  grps: number,
  calibration: TVCalibration = TV_CALIBRATION_DEFAULT
): TVReachResult {
  if (grps < 0) throw new Error("GRPs cannot be negative");
  if (calibration.maxReach <= 0 || calibration.maxReach > 1) {
    throw new Error("maxReach must be between 0 (exclusive) and 1 (inclusive)");
  }
  if (calibration.k <= 0) throw new Error("k must be positive");

  if (grps === 0) {
    return {
      reachPercent: 0,
      rawReachPercent: 0,
      duplicationPenalty: calibration.duplicationBase,
      frequency: 0,
      effectiveLambda: 0,
      calibration,
    };
  }

  // Step 1: Raw reach with ceiling
  // Reach% = maxReach × (1 − e^(−k × GRPs))
  // Note: k is applied directly to GRPs (no /100 scaling). The k value
  // itself is small (~0.008) to compensate. This avoids double-dampening
  // when combined with the ceiling and duplication adjustment.
  const rawReachFraction =
    calibration.maxReach * (1 - Math.exp(-calibration.k * grps));
  const rawReachPercent = rawReachFraction * 100;

  // Step 2: Duplication penalty — increases with GRPs
  // Models the real-world effect where more GRPs mean more overlap
  // with already-reached viewers.
  const duplicationPenalty =
    calibration.duplicationBase +
    calibration.duplicationGrowth *
      (1 - Math.exp(-grps / calibration.duplicationHalfLife));

  // Clamp penalty so we never go negative on reach
  const clampedPenalty = Math.min(duplicationPenalty, 0.95);

  // Step 3: Adjusted reach
  const adjustedReachPercent = rawReachPercent * (1 - clampedPenalty);

  // Ensure reach stays in valid range
  const finalReach = Math.max(0, Math.min(calibration.maxReach * 100, adjustedReachPercent));

  // Step 4: Derive frequency from the relationship GRPs = Reach% × Frequency
  const frequency = finalReach > 0 ? grps / finalReach : 0;

  // Step 5: Effective lambda for Poisson 3+
  // Using the actual average frequency rather than the naive GRPs/100
  // ensures effective 3+ reflects the concentrated exposure pattern.
  const effectiveLambda = frequency;

  return {
    reachPercent: finalReach,
    rawReachPercent,
    duplicationPenalty: clampedPenalty,
    frequency,
    effectiveLambda,
    calibration,
  };
}

// ---------------------------------------------------------------------------
// Legacy API — preserved for non-TV channels and backward compatibility
// ---------------------------------------------------------------------------

/**
 * Estimate Reach% from GRPs using a simple exponential saturation curve.
 * This is the LEGACY formula used for non-TV channels (if any are added).
 *
 * For TV, use estimateTVReach() which applies ceiling, duplication, and
 * calibration adjustments.
 *
 * Formula: Reach% = 100 × (1 − e^(−k × GRPs / 100))
 *
 * @param grps - Gross Rating Points (must be ≥ 0)
 * @param k - Curve steepness parameter (default 1.0)
 * @returns Estimated Reach% (0–100, exclusive of 100)
 */
export function estimateReachPercent(grps: number, k: number = 1.0): number {
  if (grps < 0) throw new Error("GRPs cannot be negative");
  if (k <= 0) throw new Error("k must be positive");
  return 100 * (1 - Math.exp((-k * grps) / 100));
}

/**
 * Get the default reach curve k-parameter for a channel.
 * Returns `null` if the channel is manual-only or unknown.
 *
 * Note: the resolver uses `getChannelConfig().calibration` directly
 * when running the full TV-style model. This helper is retained as a
 * lightweight accessor for callers that only need the k-parameter.
 */
export function getReachCurveK(channel: string): number | null {
  return getChannelConfig(channel)?.calibration?.k ?? null;
}
