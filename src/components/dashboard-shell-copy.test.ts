import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readComponentSource(fileName: string) {
  return readFileSync(path.join(process.cwd(), "src/components", fileName), "utf8");
}

describe("dashboard shell copy", () => {
  it("keeps dashboard shell navigation and hero copy in Dutch", () => {
    const source = readComponentSource("GymDashboardClientShell.tsx");

    expect(source).toContain('title: "Overzicht"');
    expect(source).toContain('label: "Overzicht"');
    expect(source).toContain('label: "Lessen"');
    expect(source).toContain('label: "Leden"');
    expect(source).toContain('label: "Betalingen"');
    expect(source).toContain('label: "Gym instellingen"');
    expect(source).toContain("Werkruimte voor dagelijkse operatie");
    expect(source).toContain('aria-label="Dashboardnavigatie"');
    expect(source).not.toContain('title: "Overview"');
    expect(source).not.toContain('label: "Overview"');
    expect(source).not.toContain("Operational workspace");
    expect(source).not.toContain('aria-label="Dashboard navigation"');
  });

  it("keeps overview and workbench copy clear for Dutch gym owners", () => {
    const overviewSource = readComponentSource(
      "dashboard/pages/OverviewDashboardPage.tsx",
    );
    const workbenchSource = readComponentSource("PlatformWorkbench.tsx");
    const dashboardSource = readComponentSource("GymDashboard.tsx");

    expect(overviewSource).toContain('label: "Actieve leden"');
    expect(overviewSource).toContain('label: "Omzet MRR"');
    expect(overviewSource).toContain('label: "Bezetting"');
    expect(overviewSource).toContain('title="Dagelijkse cockpit"');
    expect(overviewSource).toContain("Volgende lessen");
    expect(overviewSource).toContain("Platformstatus");
    expect(overviewSource).toContain("Recente reserveringen");
    expect(overviewSource).toContain("Teamnotities");
    expect(overviewSource).toContain("Notificatievoorbeeld");
    expect(overviewSource).toContain("Waar stel je Aandacht in?");
    expect(overviewSource).toContain("Dit zijn automatische platformchecks.");
    expect(overviewSource).toContain("Open Integraties");
    expect(overviewSource).toContain("Bekijk checks");
    expect(overviewSource).not.toContain('label: "Members"');
    expect(overviewSource).not.toContain('title="Next sessions"');
    expect(overviewSource).not.toContain("Latest booking activity");

    expect(workbenchSource).toContain("Gym opzetten: live dataset eerst op orde.");
    expect(workbenchSource).toContain("Doorloop je gym setup als Kanban.");
    expect(workbenchSource).toContain("Elke kaart heeft een actieknop");
    expect(workbenchSource).toContain("Lidmaatschap toevoegen");
    expect(workbenchSource).toContain("Plan een losse les");
    expect(workbenchSource).toContain("Maak een echte Mollie betaallink");
    expect(workbenchSource).not.toContain("Build the live dataset");
    expect(workbenchSource).not.toContain("Schedule one-off sessions");
    expect(workbenchSource).not.toContain("Test one flow before");

    expect(dashboardSource).toContain('pageLoadingState("Overzicht")');
    expect(dashboardSource).toContain('pageLoadingState("Leden")');
    expect(dashboardSource).not.toContain('pageLoadingState("Overview")');
    expect(dashboardSource).not.toContain('pageLoadingState("Members")');
  });

  it("keeps operational dashboard pages free of stale English empty states", () => {
    const contractsSource = readComponentSource(
      "dashboard/pages/ContractsDashboardPage.tsx",
    );
    const classesSource = readComponentSource(
      "dashboard/pages/ClassesDashboardPage.tsx",
    );
    const membersSource = readComponentSource(
      "dashboard/pages/MembersDashboardPage.tsx",
    );
    const settingsSource = readComponentSource(
      "dashboard/pages/SettingsDashboardPage.tsx",
    );
    const paymentsSource = readComponentSource(
      "dashboard/pages/PaymentsDashboardPage.tsx",
    );

    expect(contractsSource).toContain('title="Contractmodules"');
    expect(contractsSource).toContain('title="Nog geen lidmaatschappen"');
    expect(contractsSource).not.toContain("Commercial plans and imported member data.");

    expect(classesSource).toContain('title="Lessen en reserveringen"');
    expect(classesSource).toContain('title="Nog geen lessen"');
    expect(classesSource).not.toContain("Switch between schedule and booking operations.");

    expect(membersSource).toContain('title="Leden"');
    expect(membersSource).toContain('title="Nog geen leden"');
    expect(membersSource).not.toContain("Review member state and waiver completion.");

    expect(settingsSource).toContain('title="Gym instellingen"');
    expect(settingsSource).toContain('title="Nog geen teamaccounts"');
    expect(settingsSource).not.toContain("Locations, runtime state, staff, and legal readiness.");

    expect(paymentsSource).toContain('title="Betalingen"');
    expect(paymentsSource).not.toContain("Billing profile, enabled flows, and settlement state.");
  });

  it("keeps the mobile owner page Dutch and action-oriented", () => {
    const source = readComponentSource("dashboard/pages/MobileDashboardPage.tsx");

    expect(source).toContain('title="Mobiele modules"');
    expect(source).toContain('title="Mobiele app instellen"');
    expect(source).toContain('label: "Portalaccounts"');
    expect(source).toContain('title="Leden klaar voor app-uitrol"');
    expect(source).toContain('title="Zelfserviceverzoeken"');
    expect(source).toContain("Betalingsbewijzen en contracten");
    expect(source).toContain("Betaalmethodeverzoek toegevoegd.");
    expect(source).not.toContain('title="Mobile experience"');
    expect(source).not.toContain('title="Mobile setup"');
    expect(source).not.toContain("Mobile self-service requests");
    expect(source).not.toContain("Payment method request toegevoegd.");
    expect(source).not.toContain("Recente receipts");
  });

  it("keeps feature cards localized instead of exposing raw rollout labels", () => {
    const source = readComponentSource("dashboard/FeatureModuleBoard.tsx");

    expect(source).toContain("ItemCardGroup");
    expect(source).toContain("ItemCard");
    expect(source).toContain("getDashboardFeatureUiCopy");
    expect(source).toContain("getDashboardFeatureFlagStateLabel");
    expect(source).toContain("getDashboardFeatureStatusLabel");
    expect(source).toContain("getDashboardFeatureCategoryLabel");
    expect(source).toContain("getDashboardFeatureReasonLabel");
    expect(source).toContain("Tooltip");
    expect(source).toContain("TruncatedTooltipText");
    expect(source).not.toContain("<ItemCard.Description");
    expect(source).not.toContain('<p className="text-muted text-xs leading-5">');
    expect(source).toContain("currentPage");
    expect(source).toContain("shouldShowOpenAction");
    expect(source).toContain("Module openen");
    expect(source).toContain("submitDashboardMutation");
    expect(source).toContain("columns={editable ? 2 : 3}");
    expect(source).not.toContain('"Enabled"');
    expect(source).not.toContain('"Disabled"');
    expect(source).not.toContain("Open module");
    expect(source).not.toContain("Tenant override");
    expect(source).not.toContain("Actor override");
    expect(source).not.toContain("Default");
  });
});
