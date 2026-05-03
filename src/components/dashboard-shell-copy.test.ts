import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readComponentSource(fileName: string) {
  return readFileSync(path.join(process.cwd(), "src/components", fileName), "utf8");
}

function readSource(fileName: string) {
  return readFileSync(path.join(process.cwd(), "src", fileName), "utf8");
}

const mixedDashboardCopyFragments = [
  "Platform modules",
  "tenant-breed",
  "launchsignalen",
  "membercontext",
  "Workoutflows",
  "workoutflows",
  "premium coachmomenten",
  "premium content",
  "Remote toegang",
  "remote toegang",
  "live dataset",
  "gym setup als Kanban",
  "bookings en check-ins",
  "check-ins",
  "Memberships, prijzen",
  "Billingprofiel",
  "White-label appflows",
  "runtimegezondheid",
  "gym owners",
  "tenant-flags",
  "platform-rollout",
  "Booking setup",
  "Booking modules",
  "Bookinginstellingen",
  "Booking opslaan",
  "Booking policy",
  "Policy opslaan",
  "Trial booking URL",
  "trial intake",
  "proeflesintake",
  "Standaard credit pack",
  "credit pack",
  "credit packs",
  "Creditsysteem",
  "Late cancel fee",
  "No-show fee",
  "Auto-promote",
  "Live scheduling actief",
  "Members en trial users",
  "Recurring serie",
  "Deze booking",
  "reserveringsflow",
  "Mixed",
  "Advanced",
  "Remote access",
  "Retention setup",
  "Retention modules",
  "Retention cadence",
  "Community channel",
  "Questionnaire trigger",
  "Questionnaires",
  "Questionnaire toegevoegd",
  "Questionnaire opslaan",
  "Questionnaire response",
  "Response toevoegen",
  " responses",
  "Surveydata",
  "retention datasets",
  "communityflow",
  "Member follow-up cue",
  "Trial follow-up",
  "Challenge titel",
  "Challenge toevoegen",
  "Reward:",
  "Coaching setup",
  "Coaching modules",
  "Integration setup",
  "Hardware vendors",
  "Marketing setup",
  "Lead intake",
  "Lead pipeline",
  "Lead automation",
  "Marketing signals",
  "Nog geen leads toegevoegd.",
  "leadopvolging",
  "Leadbron",
  "Follow-up taken",
  "Attributie en runs",
  "Automation draaien",
  "Marketing modules",
  "owner-controlled",
  "member-context",
  "member journeys",
  "renewals",
  "frontdeskflows",
  "Alleen owner",
  "owner-only",
  "owner-dashboard",
  "owner-,",
  "membership toe",
  "Remote toegang actief",
] as const;

describe("dashboard shell copy", () => {
  it("does not keep legacy dashboard navigation with stale English labels", () => {
    const legacyNavigationPath = path.join(
      process.cwd(),
      "src/components/GymOsNavigation.tsx",
    );

    expect(existsSync(legacyNavigationPath)).toBe(false);
  });

  it("keeps dashboard shell navigation and hero copy in Dutch", () => {
    const source = readComponentSource("GymDashboardClientShell.tsx");
    const searchSource = readComponentSource("FunctionalitySearch.tsx");

    expect(source).toContain("FunctionalitySearch");
    expect(source).toContain("getVisibleFunctionalitySearchEntries");
    expect(source).toContain('ariaLabel="Functionaliteit zoeken"');
    expect(source).toContain("Zoek functionaliteit");
    expect(searchSource).toContain("searchFunctionality");
    expect(searchSource).toContain("resolveFunctionalitySearchHref");
    expect(searchSource).toContain('aria-label={ariaLabel}');
    expect(source).toContain('title: "Overzicht"');
    expect(source).toContain('label: "Overzicht"');
    expect(source).toContain('label: "Lessen"');
    expect(source).toContain('label: "Leden"');
    expect(source).toContain('label: "Betalingen"');
    expect(source).toContain('label: "Gym instellingen"');
    expect(source).toContain("Werkruimte voor dagelijkse operatie");
    expect(source).toContain("Plan lessen, beheer reserveringen en registreer aanwezigheid.");
    expect(source).toContain("Lidmaatschappen, prijzen en import in één beheerlaag.");
    expect(source).toContain("Trainingsschema's, voeding, voortgang en verdiepende coachmomenten.");
    expect(source).toContain("Toegang op afstand, deurkoppelingen en beheerdersacties.");
    expect(source).toContain("Betaalprofiel, actieve betaalroutes en de huidige verwerkingsstatus.");
    expect(source).toContain('aria-label="Dashboardnavigatie"');
    expect(source).toContain('item.key !== "superadmin" || snapshot.uiCapabilities.canManageOwnerAccounts');
    expect(source).not.toContain(
      'item.key !== "superadmin" ||\n      snapshot.uiCapabilities.canManageFeatureFlags',
    );
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
    expect(overviewSource).toContain("Clubstatus");
    expect(overviewSource).toContain("Recente reserveringen");
    expect(overviewSource).toContain("Medewerkersnotities");
    expect(overviewSource).toContain("Notificatievoorbeeld");
    expect(overviewSource).toContain("Waar stel je Aandacht in?");
    expect(overviewSource).toContain("Dit zijn automatische statuschecks.");
    expect(overviewSource).toContain("Open Integraties");
    expect(overviewSource).toContain("Bekijk checks");
    expect(overviewSource).not.toContain('label: "Members"');
    expect(overviewSource).not.toContain('title="Next sessions"');
    expect(overviewSource).not.toContain("Latest booking activity");

    expect(workbenchSource).toContain("Gym opzetten: echte clubdata eerst op orde.");
    expect(workbenchSource).toContain("Doorloop je gym-inrichting als voortgangsbord.");
    expect(workbenchSource).toContain("Elke kaart heeft een actieknop");
    expect(workbenchSource).toContain("Lidmaatschap toevoegen");
    expect(workbenchSource).toContain("Plan een losse les");
    expect(workbenchSource).toContain("Testbetaling starten");
    expect(workbenchSource).not.toContain("live dataset");
    expect(workbenchSource).not.toContain("gym setup als Kanban");
    expect(workbenchSource).not.toContain("Build the live dataset");
    expect(workbenchSource).not.toContain("Schedule one-off sessions");
    expect(workbenchSource).not.toContain("Test one flow before");

    expect(dashboardSource).toContain('pageLoadingState("Overzicht")');
    expect(dashboardSource).toContain('pageLoadingState("Leden")');
    expect(dashboardSource).not.toContain('pageLoadingState("Overview")');
    expect(dashboardSource).not.toContain('pageLoadingState("Members")');
  });

  it("keeps owner-facing dashboard copy free of mixed Dutch and English fragments", () => {
    const ownerFacingSources = {
      "GymDashboardClientShell.tsx": readComponentSource("GymDashboardClientShell.tsx"),
      "PlatformWorkbench.tsx": readComponentSource("PlatformWorkbench.tsx"),
      "OverviewDashboardPage.tsx": readComponentSource(
        "dashboard/pages/OverviewDashboardPage.tsx",
      ),
      "ClassesDashboardPage.tsx": readComponentSource(
        "dashboard/pages/ClassesDashboardPage.tsx",
      ),
      "BookingDialog.tsx": readComponentSource("BookingDialog.tsx"),
      "ContractsDashboardPage.tsx": readComponentSource(
        "dashboard/pages/ContractsDashboardPage.tsx",
      ),
      "AccessDashboardPage.tsx": readComponentSource(
        "dashboard/pages/AccessDashboardPage.tsx",
      ),
      "RetentionDashboardPage.tsx": readComponentSource(
        "dashboard/pages/RetentionDashboardPage.tsx",
      ),
      "MarketingDashboardPage.tsx": readComponentSource(
        "dashboard/pages/MarketingDashboardPage.tsx",
      ),
      "CoachingDashboardPage.tsx": readComponentSource(
        "dashboard/pages/CoachingDashboardPage.tsx",
      ),
      "IntegrationsDashboardPage.tsx": readComponentSource(
        "dashboard/pages/IntegrationsDashboardPage.tsx",
      ),
      "MobileDashboardPage.tsx": readComponentSource(
        "dashboard/pages/MobileDashboardPage.tsx",
      ),
      "SuperadminDashboardPage.tsx": readComponentSource(
        "dashboard/pages/SuperadminDashboardPage.tsx",
      ),
      "dashboard-pages.ts": readSource("lib/dashboard-pages.ts"),
      "platform-workbench-experience.ts": readSource(
        "lib/platform-workbench-experience.ts",
      ),
      "dashboard-feature-copy.ts": readSource("features/dashboard-feature-copy.ts"),
      "dashboard-feature-presence.ts": readSource(
        "features/dashboard-feature-presence.ts",
      ),
    };

    for (const [fileName, source] of Object.entries(ownerFacingSources)) {
      for (const fragment of mixedDashboardCopyFragments) {
        expect(source, `${fileName} should not expose "${fragment}"`).not.toContain(
          fragment,
        );
      }
    }
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
    expect(classesSource).toContain('title="Boekingsinstellingen"');
    expect(classesSource).toContain('title="Boekingsregels"');
    expect(classesSource).toContain("Proefleslink");
    expect(classesSource).toContain("Standaard strippenkaart");
    expect(classesSource).toContain("Annuleringskosten (€)");
    expect(classesSource).toContain("No-showkosten (€)");
    expect(classesSource).toContain("Wachtlijst automatisch doorschuiven");
    expect(classesSource).not.toContain("Annuleringskosten (cent)");
    expect(classesSource).not.toContain("No-showkosten (cent)");
    expect(classesSource).not.toContain("Switch between schedule and booking operations.");

    expect(membersSource).toContain('title="Leden"');
    expect(membersSource).toContain('title="Nog geen leden"');
    expect(membersSource).not.toContain("Review member state and waiver completion.");

    expect(settingsSource).toContain('title="Gym instellingen"');
    expect(settingsSource).toContain('title="Nog geen medewerkeraccounts"');
    expect(settingsSource).not.toContain("Locations, runtime state, staff, and legal readiness.");

    expect(paymentsSource).toContain('title="Betalingen"');
    expect(paymentsSource).toContain('title="Omzetinstellingen"');
    expect(paymentsSource).toContain('title="Opvolging open betalingen"');
    expect(paymentsSource).toContain('title="Betalingsbeheer"');
    expect(paymentsSource).toContain('title="Betaalmodules"');
    expect(paymentsSource).toContain("getBillingPaymentMethodLabel");
    expect(paymentsSource).toContain("formatEuroFromCents");
    expect(paymentsSource).toContain("parseEuroInputToCents");
    expect(paymentsSource).toContain("Terugbetalen");
    expect(paymentsSource).not.toContain("Bedrag (cent)");
    expect(paymentsSource).not.toContain(" cent ·");
    expect(paymentsSource).not.toContain("} cent");
    expect(paymentsSource).not.toContain('title="Revenue setup"');
    expect(paymentsSource).not.toContain('title="Collections queue"');
    expect(paymentsSource).not.toContain('title="Billing backoffice"');
    expect(paymentsSource).not.toContain('title="Billing modules"');
    expect(paymentsSource).not.toContain("Webhook event");
    expect(paymentsSource).not.toContain("Provider ref");
    expect(paymentsSource).not.toContain("Daily settlement sync");
    expect(paymentsSource).not.toContain("Direct debit");
    expect(paymentsSource).not.toContain("Payment request");
    expect(paymentsSource).not.toContain("One-time");
    expect(paymentsSource).not.toContain("Refund");
    expect(paymentsSource).not.toContain("Reconcile");
    expect(paymentsSource).not.toContain("Billing profile, enabled flows, and settlement state.");
  });

  it("keeps the mobile owner page Dutch and action-oriented", () => {
    const source = readComponentSource("dashboard/pages/MobileDashboardPage.tsx");

    expect(source).toContain('title="Mobiele modules"');
    expect(source).toContain('title="Mobiele app instellen"');
    expect(source).toContain('label: "Ledenaccounts"');
    expect(source).toContain('title="Leden klaar voor app-lancering"');
    expect(source).toContain('title="Zelfserviceverzoeken"');
    expect(source).toContain("Betalingsbewijzen en contracten");
    expect(source).toContain("formatEuroFromCents");
    expect(source).toContain("Betaalmethodeverzoek toegevoegd.");
    expect(source).not.toContain("{receipt.amountCents} {receipt.currency}");
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
