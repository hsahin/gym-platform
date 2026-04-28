import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(path.join(root, "src", "components", relativePath), "utf8");
}

describe("dashboard management UI wiring", () => {
  it("wires reusable edit archive delete actions into every operational dashboard list", () => {
    const members = readSource("dashboard/pages/MembersDashboardPage.tsx");
    const contracts = readSource("dashboard/pages/ContractsDashboardPage.tsx");
    const classes = readSource("dashboard/pages/ClassesDashboardPage.tsx");
    const settings = readSource("dashboard/pages/SettingsDashboardPage.tsx");

    expect(members).toContain("DashboardEntityActions");
    expect(members).toContain('endpoint="/api/platform/members"');
    expect(members).toContain("memberSearch");
    expect(members).toContain("memberStatusFilter");

    expect(contracts).toContain("DashboardEntityActions");
    expect(contracts).toContain('endpoint="/api/platform/membership-plans"');
    expect(contracts).toContain("planSearch");
    expect(contracts).toContain("planStatusFilter");

    expect(classes).toContain("DashboardEntityActions");
    expect(classes).toContain('endpoint="/api/platform/classes"');
    expect(classes).toContain("classSearch");
    expect(classes).toContain("classStatusFilter");
    expect(classes).toContain("buildClassTypeTabs");
    expect(classes).toContain("selectedClassTypeKey");
    expect(classes).toContain("Soort les kiezen");
    expect(classes).toContain('submitDashboardMutation("/api/platform/classes"');

    expect(settings).toContain("DashboardEntityActions");
    expect(settings).toContain('endpoint="/api/platform/locations"');
    expect(settings).toContain('endpoint="/api/platform/trainers"');
    expect(settings).toContain('endpoint="/api/platform/staff"');
    expect(settings).toContain("settingsSearch");
    expect(settings).toContain("settingsStatusFilter");
  });

  it("keeps dashboard list filtering on the shared management helper", () => {
    const managedPages = [
      "dashboard/pages/MembersDashboardPage.tsx",
      "dashboard/pages/ContractsDashboardPage.tsx",
      "dashboard/pages/ClassesDashboardPage.tsx",
      "dashboard/pages/SettingsDashboardPage.tsx",
    ];

    for (const page of managedPages) {
      const source = readSource(page);

      expect(source).toContain("filterManagementRecords");
      expect(source).toContain("Zoeken");
      expect(source).toContain("Filter");
    }
  });
});
