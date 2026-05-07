import { describe, expect, it } from "vitest";
import {
  buildOpenGymCapacityLocalStarts,
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

  it("builds one-hour open gym slots across a full opening window", () => {
    expect(
      buildOpenGymCapacityLocalStarts({
        anchorDate: "2026-05-08",
        opensAt: "08:00",
        closesAt: "12:00",
        slotMinutes: 60,
      }),
    ).toEqual([
      "2026-05-08T08:00",
      "2026-05-08T09:00",
      "2026-05-08T10:00",
      "2026-05-08T11:00",
    ]);
  });

  it("builds repeated open gym capacity slots for selected opening days", () => {
    expect(
      buildOpenGymCapacityLocalStarts({
        anchorDate: "2026-05-04",
        weekdays: ["monday", "wednesday"],
        untilDate: "2026-05-10",
        opensAt: "17:00",
        closesAt: "19:00",
        slotMinutes: 60,
      }),
    ).toEqual([
      "2026-05-04T17:00",
      "2026-05-04T18:00",
      "2026-05-06T17:00",
      "2026-05-06T18:00",
    ]);
  });

  it("returns no open gym starts for invalid opening windows", () => {
    expect(
      buildOpenGymCapacityLocalStarts({
        anchorDate: "2026-05-08",
        opensAt: "12:00",
        closesAt: "12:00",
        slotMinutes: 60,
      }),
    ).toEqual([]);
    expect(
      buildOpenGymCapacityLocalStarts({
        anchorDate: "2026-05-08",
        opensAt: "08:00",
        closesAt: "12:00",
        slotMinutes: 0,
      }),
    ).toEqual([]);
  });
});
