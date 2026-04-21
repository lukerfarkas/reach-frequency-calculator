/**
 * Tests for the bidirectional Net Cost / Impressions / CPM auto-calculation.
 *
 * The production logic lives in src/components/TacticFormRow.tsx — `deriveCostTriad`
 * and its helpers are replicated here so the pure formulas + state machine can be
 * unit-tested without React rendering. The two copies MUST stay in sync.
 *
 * Key invariants (documented for anyone touching this logic):
 *   1. `derivedCostField` marks which of the three fields is currently
 *      auto-computed from the other two. `null` means no auto-derivation
 *      is active.
 *   2. If the user edits the currently-derived field with a valid value,
 *      the marker clears and no cascade fires — user has taken ownership.
 *   3. Editing a source field while a derived field is marked re-derives
 *      ONLY that marked field. It must not overwrite any other field using
 *      stale values (this was the root cause of the `$21T total` bug).
 *   4. With no field marked and exactly 2 filled, the third is computed
 *      and the marker is set.
 *   5. With no field marked and all 3 filled manually, no cascade fires —
 *      the user's numbers stand even if they conflict.
 *   6. Blanking the derived field re-computes it from sources (the derived
 *      field is always a function of the sources while marked).
 */
import { describe, it, expect } from "vitest";
import { parsePositive, parseNonNeg } from "@/lib/parseNumeric";

// ---------------------------------------------------------------------------
// Mirror of production helpers (TacticFormRow.tsx).
//
// `safePositive` / `safeNonNeg` are local aliases in the component for
// `parsePositive` / `parseNonNeg` from `@/lib/parseNumeric` — the real
// helpers strip currency symbols, thousand separators, and trailing %.
// We reuse them here so the mirror stays byte-for-byte identical.
// ---------------------------------------------------------------------------

const safePositive = parsePositive;
const safeNonNeg = parseNonNeg;

type DerivedCostField = "cost" | "cpm" | "grossImpressions" | null;

interface TriadUpdate {
  cost?: string;
  cpm?: string;
  grossImpressions?: string;
  derivedCostField: DerivedCostField;
}

function computeDerivedValue(
  derivedField: "cost" | "cpm" | "grossImpressions",
  costVal: number | null,
  cpmVal: number | null,
  impVal: number | null,
): string | null {
  if (derivedField === "cost") {
    if (cpmVal != null && impVal != null) {
      return ((cpmVal * impVal) / 1000).toFixed(2);
    }
  } else if (derivedField === "cpm") {
    if (costVal != null && impVal != null && impVal > 0) {
      return ((costVal / impVal) * 1000).toFixed(2);
    }
  } else if (derivedField === "grossImpressions") {
    if (costVal != null && cpmVal != null && cpmVal > 0) {
      return String(Math.round((costVal / cpmVal) * 1000));
    }
  }
  return null;
}

function deriveCostTriad(
  cost: string,
  cpm: string,
  impressions: string,
  editedField: "cost" | "cpm" | "grossImpressions",
  prevDerivedField: DerivedCostField,
): TriadUpdate {
  const costVal = safeNonNeg(cost);
  const cpmVal = safePositive(cpm);
  const impVal = safeNonNeg(impressions);

  const editedVal =
    editedField === "cost" ? costVal : editedField === "cpm" ? cpmVal : impVal;

  // Rule 1: user typed a valid value into the currently-derived field → override.
  if (
    prevDerivedField != null &&
    editedField === prevDerivedField &&
    editedVal != null
  ) {
    return { derivedCostField: null };
  }

  // Pick the field to (re-)derive.
  let targetField: "cost" | "cpm" | "grossImpressions" | null = null;

  if (prevDerivedField != null && editedField !== prevDerivedField) {
    // Source edited while a derived field is active → re-derive same field.
    targetField = prevDerivedField;
  } else if (
    prevDerivedField != null &&
    editedField === prevDerivedField &&
    editedVal == null
  ) {
    // Rule 6: user blanked/invalidated the derived field → re-derive it.
    targetField = prevDerivedField;
  } else {
    // No field currently marked.
    const filled =
      (costVal != null ? 1 : 0) + (cpmVal != null ? 1 : 0) + (impVal != null ? 1 : 0);
    if (filled === 2) {
      if (costVal == null) targetField = "cost";
      else if (cpmVal == null) targetField = "cpm";
      else targetField = "grossImpressions";
    }
    // 0, 1, or 3 filled → no cascade.
  }

  if (targetField == null) {
    return { derivedCostField: prevDerivedField ?? null };
  }

  const derivedValue = computeDerivedValue(targetField, costVal, cpmVal, impVal);
  if (derivedValue == null) {
    // Sources not sufficient right now; keep the marker for later retry.
    return { derivedCostField: prevDerivedField ?? null };
  }

  if (targetField === "cost") {
    return { cost: derivedValue, derivedCostField: "cost" };
  }
  if (targetField === "cpm") {
    return { cpm: derivedValue, derivedCostField: "cpm" };
  }
  return { grossImpressions: derivedValue, derivedCostField: "grossImpressions" };
}

// ---------------------------------------------------------------------------
// Section 1: initial derivation (exactly 2 filled, no prior marker)
// ---------------------------------------------------------------------------

describe("deriveCostTriad — initial derivation", () => {
  describe("Net Cost + CPM → Impressions", () => {
    it("$5M cost + $25 CPM → 200M impressions", () => {
      const r = deriveCostTriad("5000000", "25", "", "cost", null);
      expect(r.grossImpressions).toBe("200000000");
      expect(r.derivedCostField).toBe("grossImpressions");
    });

    it("editing CPM with existing cost → derives impressions", () => {
      const r = deriveCostTriad("5000000", "25", "", "cpm", null);
      expect(r.grossImpressions).toBe("200000000");
      expect(r.derivedCostField).toBe("grossImpressions");
    });

    it("$100 cost + $10 CPM → 10,000 impressions", () => {
      const r = deriveCostTriad("100", "10", "", "cost", null);
      expect(r.grossImpressions).toBe("10000");
    });
  });

  describe("Net Cost + Impressions → CPM", () => {
    it("$5M cost + 200M impressions → $25.00 CPM", () => {
      const r = deriveCostTriad("5000000", "", "200000000", "cost", null);
      expect(r.cpm).toBe("25.00");
      expect(r.derivedCostField).toBe("cpm");
    });

    it("editing impressions with existing cost → derives CPM", () => {
      const r = deriveCostTriad("5000000", "", "200000000", "grossImpressions", null);
      expect(r.cpm).toBe("25.00");
      expect(r.derivedCostField).toBe("cpm");
    });

    it("$100 cost + 10,000 impressions → $10.00 CPM", () => {
      const r = deriveCostTriad("100", "", "10000", "cost", null);
      expect(r.cpm).toBe("10.00");
    });
  });

  describe("CPM + Impressions → Net Cost", () => {
    it("$25 CPM + 200M impressions → $5,000,000 cost", () => {
      const r = deriveCostTriad("", "25", "200000000", "cpm", null);
      expect(r.cost).toBe("5000000.00");
      expect(r.derivedCostField).toBe("cost");
    });

    it("editing impressions with existing CPM → derives cost", () => {
      const r = deriveCostTriad("", "25", "200000000", "grossImpressions", null);
      expect(r.cost).toBe("5000000.00");
      expect(r.derivedCostField).toBe("cost");
    });
  });
});

// ---------------------------------------------------------------------------
// Section 2: source re-derivation (prior marker persists; only the marked
// field is recomputed — no other field is touched)
// ---------------------------------------------------------------------------

describe("deriveCostTriad — source re-derivation", () => {
  it("impressions is derived; editing cost re-derives impressions only", () => {
    const r = deriveCostTriad("2000000", "25", "40000000", "cost", "grossImpressions");
    expect(r.grossImpressions).toBe("80000000");
    expect(r.cost).toBeUndefined();
    expect(r.cpm).toBeUndefined();
    expect(r.derivedCostField).toBe("grossImpressions");
  });

  it("impressions is derived; editing cpm re-derives impressions only", () => {
    const r = deriveCostTriad("1000000", "50", "40000000", "cpm", "grossImpressions");
    expect(r.grossImpressions).toBe("20000000");
    expect(r.cost).toBeUndefined();
    expect(r.cpm).toBeUndefined();
    expect(r.derivedCostField).toBe("grossImpressions");
  });

  it("cost is derived; editing cpm re-derives cost only (does NOT overwrite impressions)", () => {
    // Regression for the $21T bug: prior logic would derive impressions here using
    // stale inputs, corrupting a user-entered field.
    const r = deriveCostTriad("1000000", "25", "200000000", "cpm", "cost");
    expect(r.cost).toBe("5000000.00");
    expect(r.grossImpressions).toBeUndefined();
    expect(r.cpm).toBeUndefined();
    expect(r.derivedCostField).toBe("cost");
  });

  it("cost is derived; editing impressions re-derives cost only", () => {
    const r = deriveCostTriad("1000000", "25", "200000000", "grossImpressions", "cost");
    expect(r.cost).toBe("5000000.00");
    expect(r.cpm).toBeUndefined();
    expect(r.grossImpressions).toBeUndefined();
    expect(r.derivedCostField).toBe("cost");
  });

  it("cpm is derived; editing cost re-derives cpm only", () => {
    const r = deriveCostTriad("5000000", "25", "200000000", "cost", "cpm");
    expect(r.cpm).toBe("25.00");
    expect(r.cost).toBeUndefined();
    expect(r.grossImpressions).toBeUndefined();
    expect(r.derivedCostField).toBe("cpm");
  });

  it("cpm is derived; editing impressions re-derives cpm only", () => {
    const r = deriveCostTriad("5000000", "25", "200000000", "grossImpressions", "cpm");
    expect(r.cpm).toBe("25.00");
    expect(r.cost).toBeUndefined();
    expect(r.grossImpressions).toBeUndefined();
    expect(r.derivedCostField).toBe("cpm");
  });
});

// ---------------------------------------------------------------------------
// Section 3: user override — editing the derived field clears the marker
// ---------------------------------------------------------------------------

describe("deriveCostTriad — user override of derived field", () => {
  it("typing into the currently-derived impressions field clears the marker", () => {
    const r = deriveCostTriad("1000000", "25", "50000000", "grossImpressions", "grossImpressions");
    expect(r.derivedCostField).toBeNull();
    expect(r.cost).toBeUndefined();
    expect(r.cpm).toBeUndefined();
    expect(r.grossImpressions).toBeUndefined();
  });

  it("typing into the currently-derived cost field clears the marker", () => {
    const r = deriveCostTriad("6000000", "25", "200000000", "cost", "cost");
    expect(r.derivedCostField).toBeNull();
    expect(r.cost).toBeUndefined();
  });

  it("typing into the currently-derived cpm field clears the marker", () => {
    const r = deriveCostTriad("5000000", "30", "200000000", "cpm", "cpm");
    expect(r.derivedCostField).toBeNull();
    expect(r.cpm).toBeUndefined();
  });

  it("after override, editing a source does NOT cascade (user now owns all 3)", () => {
    // State after an override: derivedCostField=null, all 3 filled with user values.
    // Editing any field must not re-derive anything.
    const r = deriveCostTriad("2000000", "25", "99000000", "cost", null);
    expect(r.derivedCostField).toBeNull();
    expect(r.cost).toBeUndefined();
    expect(r.cpm).toBeUndefined();
    expect(r.grossImpressions).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Section 4: clearing the derived field restores it from sources
// ---------------------------------------------------------------------------

describe("deriveCostTriad — clearing the derived field re-computes", () => {
  it("blanking a derived impressions field → snaps back to computed value", () => {
    const r = deriveCostTriad("1000000", "25", "", "grossImpressions", "grossImpressions");
    expect(r.grossImpressions).toBe("40000000");
    expect(r.derivedCostField).toBe("grossImpressions");
  });

  it("blanking a derived cost field → snaps back to computed value", () => {
    const r = deriveCostTriad("", "25", "200000000", "cost", "cost");
    expect(r.cost).toBe("5000000.00");
    expect(r.derivedCostField).toBe("cost");
  });

  it("blanking a derived cpm field → snaps back to computed value", () => {
    const r = deriveCostTriad("5000000", "", "200000000", "cpm", "cpm");
    expect(r.cpm).toBe("25.00");
    expect(r.derivedCostField).toBe("cpm");
  });
});

// ---------------------------------------------------------------------------
// Section 5: $21T cascade regression — all 3 manually filled must not cascade
// ---------------------------------------------------------------------------

describe("deriveCostTriad — no cascade when all 3 user-filled (no marker)", () => {
  it("editing cost does not overwrite cpm or impressions", () => {
    // Prior to the fix, editing any field in this state would cascade using
    // stale values and overwrite an unrelated field, producing garbage totals
    // (e.g. $21T on a $1.8M plan).
    const r = deriveCostTriad("1800000", "25", "40000000", "cost", null);
    expect(r.derivedCostField).toBeNull();
    expect(r.cost).toBeUndefined();
    expect(r.cpm).toBeUndefined();
    expect(r.grossImpressions).toBeUndefined();
  });

  it("editing cpm does not cascade", () => {
    const r = deriveCostTriad("5000000", "30", "200000000", "cpm", null);
    expect(r.derivedCostField).toBeNull();
    expect(r.cost).toBeUndefined();
    expect(r.grossImpressions).toBeUndefined();
  });

  it("editing impressions does not cascade", () => {
    const r = deriveCostTriad("5000000", "25", "300000000", "grossImpressions", null);
    expect(r.derivedCostField).toBeNull();
    expect(r.cost).toBeUndefined();
    expect(r.cpm).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Section 6: insufficient or invalid inputs
// ---------------------------------------------------------------------------

describe("deriveCostTriad — insufficient / invalid inputs", () => {
  it("only 1 field filled + no prior marker → no cascade", () => {
    const r = deriveCostTriad("1000000", "", "", "cost", null);
    expect(r.derivedCostField).toBeNull();
    expect(r.cost).toBeUndefined();
    expect(r.cpm).toBeUndefined();
    expect(r.grossImpressions).toBeUndefined();
  });

  it("no fields filled → no cascade", () => {
    const r = deriveCostTriad("", "", "", "cost", null);
    expect(r.derivedCostField).toBeNull();
  });

  it("non-numeric cost treated as empty → no cascade with only cpm set", () => {
    const r = deriveCostTriad("abc", "25", "", "cost", null);
    expect(r.derivedCostField).toBeNull();
  });

  it("negative CPM treated as empty", () => {
    const r = deriveCostTriad("5000000", "-10", "", "cost", null);
    expect(r.derivedCostField).toBeNull();
  });

  it("zero CPM treated as invalid (CPM must be > 0)", () => {
    const r = deriveCostTriad("5000000", "0", "", "cost", null);
    expect(r.derivedCostField).toBeNull();
  });

  it("zero impressions does not produce CPM division by zero", () => {
    const r = deriveCostTriad("5000000", "", "0", "cost", null);
    expect(r.cpm).toBeUndefined();
    expect(r.derivedCostField).toBeNull();
  });

  it("Infinity string treated as invalid", () => {
    const r = deriveCostTriad("Infinity", "25", "", "cost", null);
    expect(r.derivedCostField).toBeNull();
  });

  it("NaN string treated as invalid", () => {
    const r = deriveCostTriad("NaN", "25", "", "cost", null);
    expect(r.derivedCostField).toBeNull();
  });

  it("prior marker persists when a source becomes invalid (can recover later)", () => {
    // derivedField=grossImpressions; user clears cpm → cannot re-derive, but
    // marker stays so that when cpm returns, re-derivation resumes.
    const r = deriveCostTriad("1000000", "", "40000000", "cpm", "grossImpressions");
    expect(r.grossImpressions).toBeUndefined();
    expect(r.derivedCostField).toBe("grossImpressions");
  });
});

// ---------------------------------------------------------------------------
// Section 7: formatting
// ---------------------------------------------------------------------------

describe("deriveCostTriad — formatting", () => {
  it("CPM is formatted to 2 decimal places", () => {
    // $333 cost / 100,000 impressions × 1000 = $3.33 CPM
    const r = deriveCostTriad("333", "", "100000", "cost", null);
    expect(r.cpm).toBe("3.33");
  });

  it("Net Cost is formatted to 2 decimal places", () => {
    const r = deriveCostTriad("", "3.33", "100000", "cpm", null);
    expect(r.cost).toBe("333.00");
  });

  it("Impressions are formatted as whole numbers", () => {
    const r = deriveCostTriad("5000000", "25", "", "cost", null);
    expect(r.grossImpressions).toBe("200000000");
    expect(r.grossImpressions).not.toContain(".");
  });
});
