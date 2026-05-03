import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(path.join(root, "src", "components", relativePath), "utf8");
}

function readProjectSource(...segments: string[]) {
  return readFileSync(path.join(root, ...segments), "utf8");
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
    expect(classes).toContain("OPEN_GYM_CLASS_TYPE_KEY");
    expect(classes).toContain("bookingKind");
    expect(classes).toContain("Boekbare gymplek");
    expect(classes).toContain("Geen trainer nodig");
    expect(classes).toContain('submitDashboardMutation("/api/platform/classes"');
    expect(classes).toContain("extraActions");
    expect(classes).toContain("Verwijder serie");
    expect(classes).toContain("delete_series");

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
    expect(workbench).toContain("shouldUseSectionTabs");
    expect(workbench).toContain("visibleSectionTabs");
    expect(workbench).not.toContain("2xl:grid-cols-2");
  });

  it("keeps owner forms below the content instead of in right side panels", () => {
    const sidePanelChecks = [
      ["dashboard/pages/MembersDashboardPage.tsx", "xl:grid-cols-[minmax(0,1fr)_420px]"],
      ["dashboard/pages/MarketingDashboardPage.tsx", "xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"],
      ["dashboard/pages/MarketingDashboardPage.tsx", "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"],
      ["dashboard/pages/CoachingDashboardPage.tsx", "grid gap-4 xl:grid-cols-2"],
      ["dashboard/pages/RetentionDashboardPage.tsx", "grid gap-4 xl:grid-cols-2"],
      ["dashboard/pages/MobileDashboardPage.tsx", "grid gap-4 xl:grid-cols-2"],
      ["dashboard/pages/SuperadminDashboardPage.tsx", "xl:grid-cols-[420px_minmax(0,1fr)]"],
    ] as const;

    for (const [page, sidePanelClass] of sidePanelChecks) {
      expect(readSource(page)).not.toContain(sidePanelClass);
    }
  });

  it("uses tabs when one menu exposes more than two form sections", () => {
    const workbench = readSource("PlatformWorkbench.tsx");
    const marketing = readSource("dashboard/pages/MarketingDashboardPage.tsx");
    const retention = readSource("dashboard/pages/RetentionDashboardPage.tsx");

    expect(workbench).toContain(
      'import { Segment } from "@/components/dashboard/HydrationSafeSegment";',
    );
    expect(workbench).toContain("shouldUseSectionTabs");
    expect(workbench).toContain("visibleSectionTabs.map");
    expect(workbench).toContain('aria-label="Formuliersecties"');
    expect(marketing).toContain("marketingFormView");
    expect(marketing).toContain('aria-label="Marketing formulieren"');
    expect(retention).toContain("retentionFormView");
    expect(retention).toContain('aria-label="Retentie formulieren"');
  });

  it("keeps contract forms stacked below the memberships overview", () => {
    const contracts = readSource("dashboard/pages/ContractsDashboardPage.tsx");

    expect(contracts).toContain('title="Lidmaatschappen"');
    expect(contracts).toContain("stackSections");
    expect(contracts).not.toContain("xl:grid-cols-[minmax(0,1fr)_420px]");
    expect(contracts.indexOf('title="Lidmaatschappen"')).toBeLessThan(
      contracts.indexOf("<LazyPlatformWorkbench"),
    );
  });

  it("shows credit system management on the contracts dashboard", () => {
    const contracts = readSource("dashboard/pages/ContractsDashboardPage.tsx");

    expect(contracts).toContain('title="Strippenkaarten"');
    expect(contracts).toContain("creditPacks");
    expect(contracts).toContain("remainingCredits");
    expect(contracts).toContain("totalCredits");
    expect(contracts).toContain('operation: "create_pack"');
    expect(contracts).toContain('submitDashboardMutation("/api/platform/appointments"');
    expect(contracts).toContain("Strippenkaart toevoegen");
    expect(contracts).toContain("Standaard strippenkaart");
    expect(contracts).toContain("Open ritten");
  });

  it("keeps access forms stacked below the remote access overview", () => {
    const access = readSource("dashboard/pages/AccessDashboardPage.tsx");

    expect(access).toContain('title="Toegang op afstand"');
    expect(access).toContain("stackSections");
    expect(access).not.toContain("xl:grid-cols-[minmax(0,1fr)_420px]");
    expect(access.indexOf('title="Toegang op afstand"')).toBeLessThan(
      access.indexOf("<LazyPlatformWorkbench"),
    );
  });

  it("keeps payment forms stacked below the payment status overview", () => {
    const payments = readSource("dashboard/pages/PaymentsDashboardPage.tsx");

    expect(payments).toContain('title="Betalingen"');
    expect(payments).toContain("stackSections");
    expect(payments).not.toContain("xl:grid-cols-[minmax(0,1fr)_420px]");
    expect(payments.indexOf('title="Betalingen"')).toBeLessThan(
      payments.indexOf("<LazyPlatformWorkbench"),
    );
  });

  it("keeps technical payment controls behind advanced disclosure with concrete disabled reasons", () => {
    const payments = readSource("dashboard/pages/PaymentsDashboardPage.tsx");
    const workbench = readSource("PlatformWorkbench.tsx");
    const contracts = readSource("dashboard/pages/ContractsDashboardPage.tsx");
    const coaching = readSource("dashboard/pages/CoachingDashboardPage.tsx");
    const mobile = readSource("dashboard/pages/MobileDashboardPage.tsx");
    const marketing = readSource("dashboard/pages/MarketingDashboardPage.tsx");
    const retention = readSource("dashboard/pages/RetentionDashboardPage.tsx");

    expect(payments).toContain("<details");
    expect(payments).toContain("Geavanceerde betaalcontrole");
    expect(payments).toContain("Alleen gebruiken met support");
    expect(payments.indexOf("Geavanceerde betaalcontrole")).toBeLessThan(
      payments.indexOf("Type betaalupdate"),
    );
    expect(payments).toContain("webhookRegistrationDisabledReason");
    expect(payments).toContain("missingWebhookRegistrationFields");
    expect(payments).toContain("Webhook registreren kan nog niet");
    expect(payments).toContain("webhook-url");
    expect(payments).toContain("Webhook registreren");

    expect(workbench).toContain("DisabledActionReason");
    expect(workbench).toContain("missingBillingPreviewFields");
    expect(workbench).toContain("billingConnectDisabledReason");
    expect(workbench).toContain("mollieClientLinkDisabledReason");
    expect(workbench).toContain("billingSettingsDisabledReason");
    expect(workbench).toContain("billingPreviewDisabledReason");
    expect(workbench).toContain("parseEuroInputToCents");
    expect(workbench).toContain("formatEuroFromCents");
    expect(workbench).toContain('label="Testbedrag (€)"');
    expect(workbench).not.toContain("Testbedrag in centen");
    expect(workbench).toContain("betaalprofiel");
    expect(workbench).toContain("webhook-url");
    expect(workbench).toContain("betaalroute");
    expect(workbench).toContain("omschrijving");
    expect(workbench).toContain("testbedrag");
    expect(workbench).toContain("Koppelen kan nog niet");
    expect(workbench).toContain("Aanmeldlink kan nog niet");
    expect(workbench).toContain("Bewaren kan nog niet");
    expect(workbench).toContain("Testbetaling kan nog niet");

    expect(contracts).toContain("creditPackDisabledReason");
    expect(contracts).toContain("Voeg eerst minimaal één lid en één trainer toe");
    expect(coaching).toContain("packDisabledReason");
    expect(coaching).toContain("sessionDisabledReason");
    expect(coaching).toContain("Kies eerst een lid en coach");
    expect(coaching).toContain("Kies eerst een coach en vestiging");
    expect(mobile).toContain("mobileMemberActionDisabledReason");
    expect(mobile).toContain("Kies eerst een lid voordat je een verzoek maakt");
    expect(marketing).toContain("conversionDisabledReason");
    expect(marketing).toContain("Kies eerst een aanvraag, contract en vestiging");
    expect(retention).toContain("questionnaireResponseDisabledReason");
    expect(retention).toContain("Kies eerst een vragenlijst en lid");
  });

  it("keeps dashboard and payment pages constrained on mobile widths", () => {
    const globals = readProjectSource("src", "app", "globals.css");
    const shell = readSource("GymDashboardClientShell.tsx");
    const shared = readSource("dashboard/shared.tsx");
    const payments = readSource("dashboard/pages/PaymentsDashboardPage.tsx");
    const overview = readSource("dashboard/pages/OverviewDashboardPage.tsx");
    const workbench = readSource("PlatformWorkbench.tsx");
    const moduleBoard = readSource("dashboard/FeatureModuleBoard.tsx");
    const search = readSource("FunctionalitySearch.tsx");

    expect(globals).toContain("html,\nbody {\n  max-width: 100%;\n  overflow-x: clip;");
    expect(globals).toContain(".mobile-safe-grid");
    expect(globals).toContain(".mobile-scroll-strip");
    expect(globals).toContain(".dashboard-kpi-group");
    expect(globals).toContain(".mobile-feature-module-board");
    expect(globals).toContain("@media (max-width: 640px)");
    expect(shell).toContain(
      'className="app-page section-stack min-w-0 max-w-full overflow-x-clip py-6 md:py-8"',
    );
    expect(shared).toContain(
      '<section className="grid min-w-0 max-w-full content-start gap-4 overflow-x-clip">',
    );
    expect(payments).toContain(
      'className="section-stack min-w-0 max-w-full overflow-x-clip"',
    );
    expect(overview).toContain('className="mobile-scroll-strip pb-1"');
    expect(overview).toContain('className="dashboard-kpi-group');
    expect(workbench).toContain(
      '<section className="section-stack min-w-0 max-w-full overflow-x-clip">',
    );
    expect(workbench).toContain(
      'const sectionGridClass = stackSections ? "grid min-w-0 max-w-full content-start gap-4" : "grid min-w-0 max-w-full gap-4";',
    );
    expect(moduleBoard).toContain("mobile-feature-module-board min-w-0 max-w-full");
    expect(moduleBoard).toContain('className={`min-h-0 min-w-0 max-w-full flex-wrap');
    expect(search).toContain("min-w-0 max-w-xl md:min-w-[14rem]");
  });

  it("exposes Mollie onboarding in business language from the billing workbench", () => {
    const workbench = readSource("PlatformWorkbench.tsx");

    expect(workbench).toContain("/api/platform/billing/mollie/connect");
    expect(workbench).toContain("/api/platform/billing/mollie/client-link");
    expect(workbench).toContain("/api/platform/billing/mollie/disconnect");
    expect(workbench).toContain("/api/platform/billing/mollie/mandates");
    expect(workbench).toContain("Betaalgegevens veilig koppelen");
    expect(workbench).toContain("Opnieuw veilig koppelen");
    expect(workbench).toContain("Betaalprofiel gekoppeld");
    expect(workbench).toContain("Betaalgegevens koppelen");
    expect(workbench).toContain("Koppeling verwijderen");
    expect(workbench).toContain("Bestaande incasso’s herkennen");
    expect(workbench).toContain("Mandaten controleren");
    expect(workbench).toContain("Betaalroutes voor leden");
    expect(workbench).toContain("Bepaal welke betaalroutes GymOS");
    expect(workbench).toContain("Automatische incasso int maandelijks");
    expect(workbench).toContain("Eenmalige betaling rekent de volledige contractperiode");
    expect(workbench).toContain("paymentMethod.helper");
    expect(workbench).toContain("Testbetaling starten");
    expect(workbench).toContain("Aanmeldlink maken");
    expect(workbench).toContain("Betaalinstellingen bewaren");
    expect(workbench).toContain("bewaart alleen actieve betaalroutes");
    expect(workbench).toContain("mollieConnectMigrationHint");
    expect(workbench).not.toContain("customers.read");
    expect(workbench).not.toContain("mandates.read");
    expect(workbench).not.toContain("SEPA-mandates");
    expect(workbench).not.toContain("SEPA mandates");
    expect(workbench).not.toContain("Mollie-mandates");
    expect(workbench).not.toContain("Betaling opslaan");
    expect(workbench).not.toContain("Instellingen opslaan");
    expect(workbench).not.toContain("Testlink maken");
    expect(workbench).not.toContain("Mollie Connect");
    expect(workbench).not.toContain("Mollie-account");
    expect(workbench).not.toContain("Mollie-profiel");
    expect(workbench).not.toContain("Client Link maken");
    expect(workbench).not.toContain("OAuth-koppeling");
    expect(workbench).not.toContain("Live betaalflow testen");
  });

  it("creates recurring workbench lessons with one batch request", () => {
    const workbench = readSource("PlatformWorkbench.tsx");

    expect(workbench).toContain("classes: startsToCreate.map");
    expect(workbench).toContain('submitJson("/api/platform/classes", {');
    expect(workbench).not.toContain("for (const localStart of startsToCreate)");
  });

  it("keeps the full class planning form inside the lessons section", () => {
    const classes = readSource("dashboard/pages/ClassesDashboardPage.tsx");

    expect(classes).toContain('title="Lessen en reserveringen"');
    expect(classes).toContain("<Card.Title>Les plannen</Card.Title>");
    expect(classes.indexOf('title="Lessen en reserveringen"')).toBeLessThan(
      classes.indexOf("<Card.Title>Les plannen</Card.Title>"),
    );
    expect(classes).toContain("Wekelijks herhalen");
    expect(classes).toContain("buildWeeklyRecurringLocalStarts");
    expect(classes).toContain("classes: startsToCreate.map");
    expect(classes).not.toContain('<LazyPlatformWorkbench sections={["classes"]}');
    expect(classes).not.toContain("xl:grid-cols-[minmax(0,1fr)_420px]");
  });

  it("shows every class field after planning including location and trainer context", () => {
    const classes = readSource("dashboard/pages/ClassesDashboardPage.tsx");

    expect(classes).toContain("locationNameById");
    expect(classes).toContain("trainerNameById");
    expect(classes).toContain("Vestiging ontbreekt");
    expect(classes).toContain("Trainer ontbreekt");
    expect(classes).toContain("buildLocationFieldOptions");
    expect(classes).toContain("buildTrainerFieldOptions");
    expect(classes).toContain("Vestiging:");
    expect(classes).toContain("Trainer:");
    expect(classes).toContain("Duur:");
    expect(classes).toContain("Capaciteit:");
  });

  it("uses the HeroUI Pro KPI group for overview facts", () => {
    const overview = readSource("dashboard/pages/OverviewDashboardPage.tsx");

    expect(overview).toContain('import { KPI, KPIGroup } from "@heroui-pro/react";');
    expect(overview).toContain("<KPIGroup");
    expect(overview).toContain("KPIGroup.Separator");
    expect(overview).toContain("KPI.Trend");
    expect(overview).toContain("HydrationSafeKpiProgress");
    expect(overview).toContain("KPI.Progress");
    expect(overview).toContain("projectedMonthlyRevenue");
    expect(overview).toContain('currency="EUR"');
    expect(overview).toContain('label: "Actieve leden"');
    expect(overview).toContain('label: "Omzet MRR"');
    expect(overview).toContain('label: "Bezetting"');
    expect(overview).toContain('aria-label="Belangrijkste dashboardcijfers"');
    expect(overview.indexOf("<KPIGroup")).toBeLessThan(
      overview.indexOf('title="Clubmodules"'),
    );
  });

  it("groups the main overview activity sections into tabbed segments", () => {
    const overview = readSource("dashboard/pages/OverviewDashboardPage.tsx");

    expect(overview).toContain(
      'import { Segment } from "@/components/dashboard/HydrationSafeSegment";',
    );
    expect(overview).toContain("overviewActivityTab");
    expect(overview).toContain("overviewActivityTabs");
    expect(overview).toContain('title="Dagelijkse cockpit"');
    expect(overview).toContain('aria-label="Dashboard cockpit tabs"');
    expect(overview).toContain("<Segment.Item");
    expect(overview).toContain('id: "lessons"');
    expect(overview).toContain('id: "status"');
    expect(overview).toContain('id: "reservations"');
    expect(overview).toContain('id: "notes"');
    expect(overview).toContain('overviewActivityTab === "lessons"');
    expect(overview).toContain('overviewActivityTab === "status"');
    expect(overview).toContain('overviewActivityTab === "reservations"');
    expect(overview).toContain('overviewActivityTab === "notes"');
    expect(overview).not.toContain(
      "xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]",
    );
  });

  it("shows platform health checks only to platform superadmins", () => {
    const overview = readSource("dashboard/pages/OverviewDashboardPage.tsx");
    const integrations = readSource("dashboard/pages/IntegrationsDashboardPage.tsx");

    expect(overview).toContain(
      "const canViewPlatformChecks = snapshot.uiCapabilities.canViewPlatformChecks;",
    );
    expect(overview).toContain("canViewPlatformChecks && openHealthChecks.length > 0");
    expect(overview).toContain("if (canViewPlatformChecks)");
    expect(overview).toContain('label: "Aandacht"');
    expect(integrations).toContain(
      "const canViewPlatformChecks = snapshot.uiCapabilities.canViewPlatformChecks;",
    );
    expect(integrations).toContain("{canViewPlatformChecks ? (");
    expect(integrations).toContain('label: "Aandachtspunten"');
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
      ["dashboard/pages/ClassesDashboardPage.tsx", 'title="Boekingsinstellingen"', 'title="Reserveringsmodules"'],
      ["dashboard/pages/MembersDashboardPage.tsx", 'title="Leden"', 'title="Ledenmodules"'],
      ["dashboard/pages/ContractsDashboardPage.tsx", 'title="Lidmaatschappen"', 'title="Contractmodules"'],
      ["dashboard/pages/PaymentsDashboardPage.tsx", 'title="Omzetinstellingen"', 'title="Betaalmodules"'],
      ["dashboard/pages/AccessDashboardPage.tsx", 'title="Toegang op afstand"', 'title="Toegangsmodules"'],
      ["dashboard/pages/MobileDashboardPage.tsx", 'title="Mobiele app instellen"', 'title="Mobiele modules"'],
      ["dashboard/pages/RetentionDashboardPage.tsx", 'title="Retentie instellen"', 'title="Retentiemodules"'],
      ["dashboard/pages/CoachingDashboardPage.tsx", 'title="Coaching instellen"', 'title="Coachingmodules"'],
      ["dashboard/pages/MarketingDashboardPage.tsx", 'title="Nieuwe aanvraag"', 'title="Marketingmodules"'],
      ["dashboard/pages/IntegrationsDashboardPage.tsx", 'title="Integraties instellen"', 'title="Integratiemodules"'],
      ["dashboard/pages/SettingsDashboardPage.tsx", 'title="Gym instellingen"', 'title="Gym instellingsmodules"'],
      ["dashboard/pages/OverviewDashboardPage.tsx", "<LazyPlatformWorkbench", 'title="Eigenaarsinzicht"'],
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

  it("passes the current dashboard page into every feature module board", () => {
    const pageCurrentPageChecks = [
      ["dashboard/pages/ClassesDashboardPage.tsx", 'currentPage="classes"'],
      ["dashboard/pages/MembersDashboardPage.tsx", 'currentPage="members"'],
      ["dashboard/pages/ContractsDashboardPage.tsx", 'currentPage="contracts"'],
      ["dashboard/pages/PaymentsDashboardPage.tsx", 'currentPage="payments"'],
      ["dashboard/pages/AccessDashboardPage.tsx", 'currentPage="access"'],
      ["dashboard/pages/MobileDashboardPage.tsx", 'currentPage="mobile"'],
      ["dashboard/pages/RetentionDashboardPage.tsx", 'currentPage="retention"'],
      ["dashboard/pages/CoachingDashboardPage.tsx", 'currentPage="coaching"'],
      ["dashboard/pages/MarketingDashboardPage.tsx", 'currentPage="marketing"'],
      ["dashboard/pages/IntegrationsDashboardPage.tsx", 'currentPage="integrations"'],
      ["dashboard/pages/SettingsDashboardPage.tsx", 'currentPage="settings"'],
      ["dashboard/pages/SuperadminDashboardPage.tsx", 'currentPage="superadmin"'],
      ["dashboard/pages/OverviewDashboardPage.tsx", 'currentPage="overview"'],
    ] as const;

    for (const [page, currentPageMarker] of pageCurrentPageChecks) {
      expect(readSource(page)).toContain(currentPageMarker);
    }
  });
});
