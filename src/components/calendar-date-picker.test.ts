import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const componentsRoot = path.join(root, "src", "components");

function readComponent(relativePath: string) {
  return readFileSync(path.join(componentsRoot, relativePath), "utf8");
}

function collectComponentFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return collectComponentFiles(fullPath);
    }

    return fullPath.endsWith(".tsx") ? [fullPath] : [];
  });
}

describe("HeroUI calendar date selection", () => {
  it("centralizes date-only selection in a mobile-friendly HeroUI Calendar picker", () => {
    const pickerPath = path.join(componentsRoot, "CalendarDatePicker.tsx");

    expect(existsSync(pickerPath)).toBe(true);

    const picker = readFileSync(pickerPath, "utf8");

    expect(picker).toContain('import { Calendar, Popover } from "@heroui/react";');
    expect(picker).toContain('from "@internationalized/date"');
    expect(picker).toContain("Calendar.Header");
    expect(picker).toContain("Calendar.Grid");
    expect(picker).toContain("Calendar.Cell");
    expect(picker).toContain("max-w-[calc(100vw-2rem)]");
    expect(picker).toContain('type="hidden"');
  });

  it("removes raw browser date inputs from component UI", () => {
    const offenders = collectComponentFiles(componentsRoot)
      .filter((filePath) => !filePath.endsWith("CalendarDatePicker.tsx"))
      .filter((filePath) => readFileSync(filePath, "utf8").includes('type="date"'))
      .map((filePath) => path.relative(root, filePath));

    expect(offenders).toEqual([]);
  });

  it("uses the shared picker on all date-only owner and member flows", () => {
    const dateFlowFiles = [
      "dashboard/ClassScheduler.tsx",
      "dashboard/pages/ClassesDashboardPage.tsx",
      "dashboard/pages/CoachingDashboardPage.tsx",
      "dashboard/pages/ContractsDashboardPage.tsx",
      "dashboard/pages/MobileDashboardPage.tsx",
      "dashboard/pages/RetentionDashboardPage.tsx",
      "PlatformWorkbench.tsx",
      "PublicReservationPortal.tsx",
    ];

    for (const relativePath of dateFlowFiles) {
      expect(readComponent(relativePath)).toContain("CalendarDatePicker");
    }
  });
});
