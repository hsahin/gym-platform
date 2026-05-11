import { describe, expect, it } from "vitest";
import { formatEuroFromCents, parseEuroInputToCents } from "@/lib/currency";

describe("currency helpers", () => {
  it("formats cents as owner-facing euro amounts", () => {
    expect(formatEuroFromCents(2495)).toBe("€ 24,95");
    expect(formatEuroFromCents(120000)).toBe("€ 1.200,00");
  });

  it("parses euro input back to cents for API payloads", () => {
    expect(parseEuroInputToCents("€ 24,95")).toBe(2495);
    expect(parseEuroInputToCents("24.95")).toBe(2495);
    expect(parseEuroInputToCents("1.234,56")).toBe(123456);
    expect(parseEuroInputToCents("1.234")).toBe(123400);
    expect(parseEuroInputToCents("80")).toBe(8000);
    expect(parseEuroInputToCents("")).toBe(0);
  });

  it("falls back to integer euros when no decimal separator is supplied", () => {
    // hits the no-separator branch in parseEuroInputToCents
    expect(parseEuroInputToCents("50")).toBe(5000);
    expect(parseEuroInputToCents("€2500")).toBe(250000);
  });

  it("treats a single dot/comma followed by more than two digits as a thousands group", () => {
    // hits the single-separator with >2 trailing digits branch
    expect(parseEuroInputToCents("1,234")).toBe(123400);
    expect(parseEuroInputToCents("1.2345")).toBe(1234500);
  });

  it("handles non-finite or garbage input by returning zero cents", () => {
    expect(parseEuroInputToCents("abc")).toBe(0);
    expect(parseEuroInputToCents("---")).toBe(0);
  });

  it("formats non-finite amounts as zero euros", () => {
    expect(formatEuroFromCents(Number.NaN)).toBe("€ 0,00");
    expect(formatEuroFromCents(Number.POSITIVE_INFINITY)).toBe("€ 0,00");
  });
});
