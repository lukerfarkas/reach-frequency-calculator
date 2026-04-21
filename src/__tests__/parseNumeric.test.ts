/**
 * Unit tests for the shared numeric parser.
 *
 * These tests lock in the "paste-friendliness" guarantees the rest of the
 * app depends on — if any of these fail, users pasting values like
 * "$5,000,000" or "45%" from a spreadsheet would see silent calculation
 * failures downstream.
 */
import { describe, it, expect } from "vitest";
import {
  cleanNumericString,
  parseNumeric,
  parsePositive,
  parseNonNeg,
} from "@/lib/parseNumeric";

describe("cleanNumericString", () => {
  it("strips leading dollar signs", () => {
    expect(cleanNumericString("$5000")).toBe("5000");
  });

  it("strips other currency symbols (£, €, ¥)", () => {
    expect(cleanNumericString("£1000")).toBe("1000");
    expect(cleanNumericString("€1000")).toBe("1000");
    expect(cleanNumericString("¥1000")).toBe("1000");
  });

  it("strips thousand separators", () => {
    expect(cleanNumericString("5,000,000")).toBe("5000000");
    expect(cleanNumericString("1,234")).toBe("1234");
  });

  it("strips trailing percent", () => {
    expect(cleanNumericString("45%")).toBe("45");
    expect(cleanNumericString("3.14%")).toBe("3.14");
  });

  it("handles combined currency + commas", () => {
    expect(cleanNumericString("$5,000,000")).toBe("5000000");
    expect(cleanNumericString("$1,234.56")).toBe("1234.56");
  });

  it("strips surrounding whitespace", () => {
    expect(cleanNumericString("  42  ")).toBe("42");
    expect(cleanNumericString("\t100\n")).toBe("100");
  });

  it("preserves sign and decimals", () => {
    expect(cleanNumericString("-5")).toBe("-5");
    expect(cleanNumericString("-1,234.56")).toBe("-1234.56");
    expect(cleanNumericString("3.14159")).toBe("3.14159");
  });

  it("returns empty string for empty/whitespace input", () => {
    expect(cleanNumericString("")).toBe("");
    expect(cleanNumericString("   ")).toBe("");
  });
});

describe("parseNumeric", () => {
  it("parses plain integers", () => {
    expect(parseNumeric("42")).toBe(42);
    expect(parseNumeric("0")).toBe(0);
  });

  it("parses plain decimals", () => {
    expect(parseNumeric("3.14")).toBe(3.14);
    expect(parseNumeric(".5")).toBe(0.5);
  });

  it("parses currency-formatted numbers", () => {
    expect(parseNumeric("$5,000,000")).toBe(5_000_000);
    expect(parseNumeric("$1,234.56")).toBe(1234.56);
  });

  it("parses percent-suffixed numbers", () => {
    expect(parseNumeric("45%")).toBe(45);
    expect(parseNumeric("3.14%")).toBe(3.14);
  });

  it("parses numbers with just commas", () => {
    expect(parseNumeric("1,000,000")).toBe(1_000_000);
  });

  it("returns null for empty input", () => {
    expect(parseNumeric("")).toBeNull();
    expect(parseNumeric("   ")).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(parseNumeric("abc")).toBeNull();
    expect(parseNumeric("12abc")).toBeNull();
    expect(parseNumeric("$$")).toBeNull();
  });

  it("returns null for Infinity / NaN inputs", () => {
    expect(parseNumeric("Infinity")).toBeNull();
    expect(parseNumeric("-Infinity")).toBeNull();
    expect(parseNumeric("NaN")).toBeNull();
  });

  it("preserves negative numbers", () => {
    expect(parseNumeric("-5")).toBe(-5);
    expect(parseNumeric("-$1,000")).toBe(null); // "-$" is malformed, not our job to fix
    expect(parseNumeric("-1,000")).toBe(-1000);
  });

  it("accepts zero", () => {
    expect(parseNumeric("0")).toBe(0);
    expect(parseNumeric("0.00")).toBe(0);
    expect(parseNumeric("$0")).toBe(0);
  });
});

describe("parsePositive", () => {
  it("returns the number when > 0", () => {
    expect(parsePositive("42")).toBe(42);
    expect(parsePositive("$5,000")).toBe(5000);
    expect(parsePositive("0.01")).toBe(0.01);
  });

  it("returns null for zero", () => {
    expect(parsePositive("0")).toBeNull();
    expect(parsePositive("$0")).toBeNull();
  });

  it("returns null for negatives", () => {
    expect(parsePositive("-5")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parsePositive("")).toBeNull();
    expect(parsePositive("abc")).toBeNull();
  });
});

describe("parseNonNeg", () => {
  it("returns the number when ≥ 0", () => {
    expect(parseNonNeg("42")).toBe(42);
    expect(parseNonNeg("0")).toBe(0);
    expect(parseNonNeg("$5,000,000")).toBe(5_000_000);
  });

  it("returns null for negatives", () => {
    expect(parseNonNeg("-5")).toBeNull();
    expect(parseNonNeg("-1,000")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseNonNeg("")).toBeNull();
    expect(parseNonNeg("abc")).toBeNull();
    expect(parseNonNeg("$$")).toBeNull();
  });
});

describe("real-world paste scenarios (regression)", () => {
  // These are the user-reported shapes that motivated the helper.
  // If any of these ever returns null or NaN, users will see silent
  // calculation failures in the tactic form.

  it("spreadsheet-copied Net Cost: '$5,000,000'", () => {
    expect(parseNonNeg("$5,000,000")).toBe(5_000_000);
  });

  it("spreadsheet-copied CPM: '$25.00'", () => {
    expect(parsePositive("$25.00")).toBe(25);
  });

  it("spreadsheet-copied impressions: '200,000,000'", () => {
    expect(parseNonNeg("200,000,000")).toBe(200_000_000);
  });

  it("email-copied Reach%: '45%'", () => {
    expect(parseNonNeg("45%")).toBe(45);
  });

  it("typed with trailing space: '100 '", () => {
    expect(parseNonNeg("100 ")).toBe(100);
  });
});
