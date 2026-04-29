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

  it("keeps gym settings forms stacked below the settings overview", () => {
    const settings = readSource("dashboard/pages/SettingsDashboardPage.tsx");
    const lazyWorkbench = readSource("dashboard/LazyPlatformWorkbench.tsx");
    const workbench = readSource("PlatformWorkbench.tsx");

    expect(settings).toContain('title="Gym instellingen"');
    expect(settings).toContain("stackSections");
    expect(settings).not.toContain("xl:grid-cols-[minmax(0,1fr)_420px]");
    expect(lazyWorkbench).toContain("stackSections");
    expect(workbench).toContain("stackSections = false");
    expect(workbench).toContain('"grid gap-4 2xl:grid-cols-2"');
  });

  it("uses the HeroUI Pro KPI group for overview facts", () => {
    const overview = readSource("dashboard/pages/OverviewDashboardPage.tsx");

    expect(overview).toContain('from "@heroui-pro/react/kpi-group"');
    expect(overview).toContain("<KPIGroup");
    expect(overview).toContain("KPIGroup.Separator");
    expect(overview).toContain('aria-label="Belangrijkste dashboardcijfers"');
    expect(overview.indexOf("<KPIGroup")).toBeLessThan(
      overview.indexOf('title="Platform modules"'),
    );
  });

  it("uses HeroUI Pro Kanban for gym setup progress with direct CTAs", () => {
    const workbench = readSource("PlatformWorkbench.tsx");

    expect(workbench).toContain('from "@heroui-pro/react/kanban"');
    expect(workbench).toContain("<Kanban");
    expect(workbench).toContain("<Kanban.Column");
    expect(workbench).toContain("<Kanban.CardList");
    expect(workbench).toContain("Voortgangsbord");
    expect(workbench).toContain("router.push(step.href)");
    expect(workbench).toContain("{step.ctaLabel}");
  });

  it("keeps feature module summaries below the primary owner workflows", () => {
    const pageOrderChecks = [
      ["dashboard/pages/ClassesDashboardPage.tsx", 'title="Booking setup"', 'title="Booking modules"'],
      ["dashboard/pages/MembersDashboardPage.tsx", 'title="Leden"', 'title="Ledenmodules"'],
      ["dashboard/pages/ContractsDashboardPage.tsx", 'title="Lidmaatschappen"', 'title="Contractmodules"'],
      ["dashboard/pages/PaymentsDashboardPage.tsx", 'title="Revenue setup"', 'title="Billing modules"'],
      ["dashboard/pages/AccessDashboardPage.tsx", 'title="Remote access"', 'title="Toegangsmodules"'],
      ["dashboard/pages/MobileDashboardPage.tsx", 'title="Mobiele app instellen"', 'title="Mobiele modules"'],
      ["dashboard/pages/RetentionDashboardPage.tsx", 'title="Retention setup"', 'title="Retention modules"'],
      ["dashboard/pages/CoachingDashboardPage.tsx", 'title="Coaching setup"', 'title="Coaching modules"'],
      ["dashboard/pages/MarketingDashboardPage.tsx", 'title="Lead intake"', 'title="Marketing modules"'],
      ["dashboard/pages/IntegrationsDashboardPage.tsx", 'title="Integration setup"', 'title="Integratiemodules"'],
      ["dashboard/pages/SettingsDashboardPage.tsx", 'title="Gym instellingen"', 'title="Gym instellingsmodules"'],
      ["dashboard/pages/OverviewDashboardPage.tsx", "<LazyPlatformWorkbench", 'title="Owner-inzicht"'],
    ] as const;

    for (const [page, primaryMarker, moduleMarker] of pageOrderChecks) {
      const source = readSource(page);

      expect(source.indexOf(primaryMarker), `${page} primary marker`).toBeGreaterThanOrEqual(0);
      expect(source.indexOf(moduleMarker), `${page} module marker`).toBeGreaterThanOrEqual(0);
      expect(source.indexOf(moduleMarker), `${page} module position`).toBeGreaterThan(
        source.indexOf(primaryMarker),
      );
    }
  });
});
