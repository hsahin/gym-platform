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
});
