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
    expect(parseEuroInputToCents("")).toBe(0);
  });
});
