import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSchedulerSource() {
  return readFileSync(
    path.join(process.cwd(), "src/components/dashboard/ClassScheduler.tsx"),
    "utf8",
  );
}

const source = readSchedulerSource();

describe("ClassScheduler — keyboard navigation", () => {
  it("registers a global keydown listener bound to the scheduler", () => {
    expect(source).toContain('window.addEventListener("keydown"');
    expect(source).toContain('window.removeEventListener("keydown"');
  });

  it("supports ArrowLeft / ArrowRight to shift by the current stride", () => {
    expect(source).toContain('case "ArrowLeft"');
    expect(source).toContain('case "ArrowRight"');
    expect(source).toMatch(/const stride = mode === "week" \? 7 : 1/);
  });

  it("supports T for today and W / D for week and day", () => {
    expect(source).toMatch(/case "t":\s*case "T":/);
    expect(source).toMatch(/case "w":\s*case "W":/);
    expect(source).toMatch(/case "d":\s*case "D":/);
    expect(source).toContain('setMode("week")');
    expect(source).toContain('setMode("day")');
  });

  it("ignores keystrokes when the user is typing in a form control", () => {
    expect(source).toContain("function isTypingTarget");
    expect(source).toMatch(/tag === "input"/);
    expect(source).toMatch(/tag === "textarea"/);
    expect(source).toMatch(/tag === "select"/);
    expect(source).toContain("isContentEditable");
  });

  it("ignores keystrokes when modifier keys are pressed", () => {
    expect(source).toMatch(/event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey \|\| event\.shiftKey/);
  });
});

describe("ClassScheduler — time-of-day grouping", () => {
  it("declares morning / afternoon / evening bands", () => {
    expect(source).toMatch(/"morning" \| "afternoon" \| "evening"/);
    expect(source).toContain("Ochtend");
    expect(source).toContain("Middag");
    expect(source).toContain("Avond");
  });

  it("groups sessions into time bands before noon, before 17:00, and after", () => {
    expect(source).toContain("function getTimeBand");
    expect(source).toContain("hour < 12");
    expect(source).toContain("hour < 17");
  });

  it("only renders bands that actually contain sessions", () => {
    expect(source).toMatch(/\.filter\(\(entry\) => entry\.items\.length > 0\)/);
  });
});

describe("ClassScheduler — per-day occupancy + today highlight", () => {
  it("summarises booked/capacity ratio per day", () => {
    expect(source).toContain("function summarizeDayOccupancy");
    expect(source).toMatch(/ratio = capacity > 0 \? Math\.round\(\(booked \/ capacity\) \* 100\) : 0/);
  });

  it("escalates the per-day chip color via the occupancy helper when ratio >= 85% or 100%", () => {
    expect(source).toContain("function getOccupancyChipColor");
    expect(source).toMatch(/ratio >= 100[^]*"danger"/);
    expect(source).toMatch(/ratio >= 85[^]*"warning"/);
  });

  it("renders an aria-current=date today marker with an accent border", () => {
    expect(source).toContain('aria-current={isToday ? "date" : undefined}');
    // class order may shift but both ring + border tokens must coexist
    expect(source).toMatch(/border-accent\/60[^"]*ring-accent\/20|ring-accent\/20[^"]*border-accent\/60/);
  });
});

describe("ClassScheduler — accessibility", () => {
  it("annotates the calendar grid with role=grid and role=gridcell", () => {
    expect(source).toContain('role="grid"');
    expect(source).toContain('role="gridcell"');
  });

  it("gives session buttons descriptive aria-labels and focus-visible rings", () => {
    expect(source).toContain("aria-label={`Beheer ${session.title}");
    expect(source).toContain("focus-visible:outline-accent");
    expect(source).toContain("focus-visible:outline-2");
  });

  it("labels navigation buttons by mode (week vs day)", () => {
    expect(source).toContain('aria-label={mode === "week" ? "Vorige week" : "Vorige dag"}');
    expect(source).toContain('aria-label={mode === "week" ? "Volgende week" : "Volgende dag"}');
  });
});

describe("ClassScheduler — active filter affordances", () => {
  it("counts active filters and shows a Filters wissen button when > 0", () => {
    expect(source).toContain(
      '(locationFilter === "all" ? 0 : 1) + (trainerFilter === "all" ? 0 : 1)',
    );
    expect(source).toContain("Filters wissen");
    expect(source).toContain("function ");
    expect(source).toMatch(/setLocationFilter\("all"\)/);
    expect(source).toMatch(/setTrainerFilter\("all"\)/);
  });

  it("shows an overall occupancy chip when capacity > 0", () => {
    expect(source).toContain("totalCapacity > 0");
    expect(source).toContain("overallOccupancy");
    expect(source).toMatch(/overallOccupancy[^>]*%[^<]*gevuld|\$\{overallOccupancy\}% gevuld/);
  });
});

describe("ClassScheduler — preserves locked-in upstream invariants", () => {
  it("still uses Widget from heroui-pro and the hydration-safe primitives", () => {
    expect(source).toContain('import { Widget } from "@heroui-pro/react";');
    expect(source).toContain(
      'import { NativeSelect } from "@/components/dashboard/HydrationSafeNativeSelect";',
    );
    expect(source).toContain(
      'import { Segment } from "@/components/dashboard/HydrationSafeSegment";',
    );
  });

  it("keeps the responsive grid breakpoints (week 7-col, day 2-col)", () => {
    expect(source).toContain("lg:grid-cols-7");
    expect(source).toContain("md:grid-cols-2");
  });

  it("still mentions Leskalender / Week / Dag / Vandaag / Geen lessen gepland", () => {
    expect(source).toContain("Leskalender");
    expect(source).toContain(">Week<");
    expect(source).toContain(">Dag<");
    expect(source).toContain("Vandaag");
    expect(source).toContain("Geen lessen gepland");
  });

  it("never reaches for a third-party calendar library", () => {
    expect(source).not.toContain("react-big-calendar");
    expect(source).not.toContain("fullcalendar");
  });
});
