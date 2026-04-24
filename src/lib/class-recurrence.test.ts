import { describe, expect, it } from "vitest";
import {
  buildWeeklyRecurringLocalStarts,
  getWeekdayKeyForLocalDateTime,
} from "@/lib/class-recurrence";

describe("class recurrence", () => {
  it("builds recurring weekly local starts across selected weekdays", () => {
    expect(
      buildWeeklyRecurringLocalStarts({
        anchorLocalStart: "2026-04-26T10:30",
        weekdays: ["tuesday", "thursday", "sunday"],
        untilDate: "2026-05-07",
      }),
    ).toEqual([
      "2026-04-26T10:30",
      "2026-04-28T10:30",
      "2026-04-30T10:30",
      "2026-05-03T10:30",
      "2026-05-05T10:30",
      "2026-05-07T10:30",
    ]);
  });

  it("returns the weekday for a local datetime value", () => {
    expect(getWeekdayKeyForLocalDateTime("2026-04-28T18:30")).toBe("tuesday");
  });

  it("returns null for invalid local datetime values", () => {
    expect(getWeekdayKeyForLocalDateTime("2026-04-28")).toBeNull();
  });

  it("returns an empty recurrence when the input is incomplete", () => {
    expect(
      buildWeeklyRecurringLocalStarts({
        anchorLocalStart: "invalid",
        weekdays: ["monday"],
        untilDate: "2026-05-07",
      }),
    ).toEqual([]);

    expect(
      buildWeeklyRecurringLocalStarts({
        anchorLocalStart: "2026-04-26T10:30",
        weekdays: [],
        untilDate: "2026-05-07",
      }),
    ).toEqual([]);

    expect(
      buildWeeklyRecurringLocalStarts({
        anchorLocalStart: "2026-04-26T10:30",
        weekdays: ["monday"],
        untilDate: "invalid",
      }),
    ).toEqual([]);
  });

  it("returns an empty recurrence when the end date is before the anchor", () => {
    expect(
      buildWeeklyRecurringLocalStarts({
        anchorLocalStart: "2026-04-26T10:30",
        weekdays: ["sunday"],
        untilDate: "2026-04-20",
      }),
    ).toEqual([]);
  });
});
