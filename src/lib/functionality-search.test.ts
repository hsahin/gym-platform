import { describe, expect, it } from "vitest";
import { DASHBOARD_FEATURE_CATALOG } from "@/features/dashboard-feature-catalog";
import { DASHBOARD_PAGE_KEYS } from "@/lib/dashboard-pages";
import {
  buildFunctionalitySearchSuggestions,
  FUNCTIONALITY_SEARCH_ENTRIES,
  getVisibleFunctionalitySearchEntries,
  resolveFunctionalitySearchHref,
  searchFunctionality,
} from "@/lib/functionality-search";

const fullySetUpSignals = {
  locationCount: 1,
  membershipPlanCount: 2,
  classSessionCount: 5,
  trainerCount: 1,
  memberCount: 12,
  billingStatus: "configured",
  legalGapForPublicSignup: false,
} as const;

const mixedVisibleSearchFragments = [
  "check-ins",
  "member portal",
  "Remote toegang",
  "Owner accounts",
  "tenant-flags",
  "platform-rollout",
  "remote unlock",
  "Live betaalflow",
  "SEPA creditor ID",
  "Credit pack",
  "class packs",
  "Booking policy",
  "Trial booking",
  "waitlist",
  "cancellation window",
  "Gym owner accounts",
  "Feature flags",
  "rolloutstatus",
  "signupflow",
] as const;

describe("functionality search", () => {
  it("indexes every dashboard page, feature module and public app flow", () => {
    const pageKeys = new Set(
      FUNCTIONALITY_SEARCH_ENTRIES.filter((entry) => entry.kind === "page").map(
        (entry) => entry.dashboardPage,
      ),
    );
    const featureKeys = new Set(
      FUNCTIONALITY_SEARCH_ENTRIES.filter((entry) => entry.kind === "feature").map(
        (entry) => entry.sourceKey,
      ),
    );
    const publicKeys = new Set(
      FUNCTIONALITY_SEARCH_ENTRIES.filter((entry) => entry.kind === "public").map(
        (entry) => entry.key,
      ),
    );

    expect(pageKeys).toEqual(new Set(DASHBOARD_PAGE_KEYS));
    expect(featureKeys).toEqual(
      new Set(DASHBOARD_FEATURE_CATALOG.map((feature) => feature.key)),
    );
    expect(publicKeys).toEqual(
      new Set([
        "public.home",
        "public.reserve",
        "public.join",
        "public.pricing",
        "public.login",
      ]),
    );
  });

  it("finds functionality by Dutch aliases and business descriptions", () => {
    expect(searchFunctionality("smartdeur")[0]).toMatchObject({
      title: "Smartdeur koppelen",
      href: "/dashboard/access",
      kind: "workflow",
    });

    expect(searchFunctionality("incasso")[0]).toMatchObject({
      title: "Automatische incasso",
      href: "/dashboard/payments",
      kind: "feature",
    });

    expect(searchFunctionality("ledenportaal toegang")[0]).toMatchObject({
      title: "Leden en lidmaatschappen",
      href: "/dashboard/members",
      kind: "feature",
    });
  });

  it("renders feature search results with gym-owner labels instead of raw catalog titles", () => {
    expect(
      FUNCTIONALITY_SEARCH_ENTRIES.find((entry) => entry.key === "feature.billing.direct_debit"),
    ).toMatchObject({
      title: "Automatische incasso",
      description: "Verwerk terugkerende SEPA-incasso voor lidmaatschappen en verlengingen.",
    });
    expect(
      FUNCTIONALITY_SEARCH_ENTRIES.some((entry) => entry.title === "Direct Debit Processing"),
    ).toBe(false);
  });

  it("keeps visible search result copy business-facing and Dutch", () => {
    const visibleCopy = FUNCTIONALITY_SEARCH_ENTRIES.map(
      (entry) => `${entry.title}\n${entry.description}`,
    ).join("\n\n");

    for (const fragment of mixedVisibleSearchFragments) {
      expect(visibleCopy).not.toContain(fragment);
    }
  });

  it("hides superadmin-only functionality unless the viewer has platform rights", () => {
    const regularEntries = getVisibleFunctionalitySearchEntries({
      canManageFeatureFlags: false,
      canManageOwnerAccounts: false,
    });
    const ownerModuleEntries = getVisibleFunctionalitySearchEntries({
      canManageFeatureFlags: true,
      canManageOwnerAccounts: false,
    });
    const platformEntries = getVisibleFunctionalitySearchEntries({
      canManageFeatureFlags: true,
      canManageOwnerAccounts: true,
    });

    expect(regularEntries.some((entry) => entry.dashboardPage === "superadmin")).toBe(false);
    expect(ownerModuleEntries.some((entry) => entry.dashboardPage === "superadmin")).toBe(false);
    expect(platformEntries.some((entry) => entry.dashboardPage === "superadmin")).toBe(true);
  });

  it("keeps public member flows scoped to the current tenant when available", () => {
    const reserveEntry = FUNCTIONALITY_SEARCH_ENTRIES.find(
      (entry) => entry.key === "public.reserve",
    );

    expect(reserveEntry).toBeDefined();
    expect(resolveFunctionalitySearchHref(reserveEntry!, "tenant-northside")).toBe(
      "/reserve?gym=tenant-northside",
    );
  });

  it("returns the dashboard href unchanged when there is no tenant context", () => {
    const dashboardEntry = FUNCTIONALITY_SEARCH_ENTRIES.find(
      (entry) => entry.kind === "page",
    );

    expect(dashboardEntry).toBeDefined();
    // No tenantId means dashboard pages render as-is.
    expect(resolveFunctionalitySearchHref(dashboardEntry!, undefined)).toBe(
      dashboardEntry!.href,
    );
    // Non-public entries are never tenant-scoped, even with a tenantId.
    expect(resolveFunctionalitySearchHref(dashboardEntry!, "tenant-x")).toBe(
      dashboardEntry!.href,
    );
  });

  it("ranks entries by exact title, prefix, substring, keyword, then description", () => {
    const entries = [
      {
        key: "test.exact",
        title: "Boekingen",
        description: "Compleet beheer",
        kind: "feature" as const,
        href: "/dashboard/classes",
        keywords: ["bookings"],
      },
      {
        key: "test.prefix",
        title: "Boekingen vandaag",
        description: "Annuleringsvensters en wachtlijst",
        kind: "feature" as const,
        href: "/dashboard/classes",
        keywords: [],
      },
      {
        key: "test.substring",
        title: "Live boekingen vandaag",
        description: "Snel overzicht",
        kind: "feature" as const,
        href: "/dashboard/classes",
        keywords: [],
      },
      {
        key: "test.keyword",
        title: "Cancellaties",
        description: "Verlies aan plekken",
        kind: "feature" as const,
        href: "/dashboard/classes",
        keywords: ["boekingen"],
      },
      {
        key: "test.description",
        title: "Capaciteitsplanning",
        description: "Plan plekken voor boekingen",
        kind: "feature" as const,
        href: "/dashboard/classes",
        keywords: [],
      },
    ];

    const ranked = searchFunctionality("boekingen", { entries, limit: 5 });

    expect(ranked.map((entry) => entry.key)).toEqual([
      "test.exact",
      "test.prefix",
      "test.substring",
      "test.keyword",
      "test.description",
    ]);
  });

  it("returns an empty list when the search query normalises to nothing", () => {
    expect(searchFunctionality("   ")).toEqual([]);
    expect(searchFunctionality("")).toEqual([]);
    expect(searchFunctionality(",,,,")).toEqual([]);
  });
});

describe("functionality search — default suggestions", () => {
  it("pins the five most-used dashboard pages regardless of setup state", () => {
    const suggestions = buildFunctionalitySearchSuggestions(fullySetUpSignals);

    expect(suggestions.pinned).toEqual([
      "page.overview",
      "page.classes",
      "page.members",
      "page.payments",
      "page.settings",
    ]);
    expect(suggestions.attention).toEqual([]);
  });

  it("flags only the critical missing entities when the gym has nothing yet", () => {
    const suggestions = buildFunctionalitySearchSuggestions({
      ...fullySetUpSignals,
      locationCount: 0,
      membershipPlanCount: 0,
      classSessionCount: 0,
      trainerCount: 0,
      memberCount: 0,
      billingStatus: "not_configured",
    });

    // Class/trainer/member items are suppressed when there are no plans yet —
    // adding a plan comes first.
    expect(suggestions.attention).toEqual([
      "workflow.add-location",
      "workflow.add-membership",
      "workflow.connect-payments",
    ]);
  });

  it("once the gym has plans, class + trainer + member gaps surface", () => {
    const suggestions = buildFunctionalitySearchSuggestions({
      ...fullySetUpSignals,
      classSessionCount: 0,
      trainerCount: 0,
      memberCount: 0,
    });

    expect(suggestions.attention).toContain("workflow.plan-class");
    expect(suggestions.attention).toContain("workflow.add-member");
    // No classes yet → no point pushing a trainer (no session needs one).
    expect(suggestions.attention).not.toContain("workflow.add-trainer");
  });

  it("only nags about trainers once there are classes that would need one", () => {
    const withClassesNoTrainers = buildFunctionalitySearchSuggestions({
      ...fullySetUpSignals,
      classSessionCount: 4,
      trainerCount: 0,
    });
    const withoutClassesOrTrainers = buildFunctionalitySearchSuggestions({
      ...fullySetUpSignals,
      classSessionCount: 0,
      trainerCount: 0,
    });

    expect(withClassesNoTrainers.attention).toContain("workflow.add-trainer");
    expect(withoutClassesOrTrainers.attention).not.toContain("workflow.add-trainer");
  });

  it("treats billing 'attention' as a setup gap, not just 'not_configured'", () => {
    const notConfigured = buildFunctionalitySearchSuggestions({
      ...fullySetUpSignals,
      billingStatus: "not_configured",
    });
    const attentionState = buildFunctionalitySearchSuggestions({
      ...fullySetUpSignals,
      billingStatus: "attention",
    });

    expect(notConfigured.attention).toContain("workflow.connect-payments");
    expect(attentionState.attention).toContain("workflow.connect-payments");
  });

  it("only nags about legal docs when the gym actually accepts public sign-ups", () => {
    const withGap = buildFunctionalitySearchSuggestions({
      ...fullySetUpSignals,
      legalGapForPublicSignup: true,
    });
    const noGap = buildFunctionalitySearchSuggestions({
      ...fullySetUpSignals,
      legalGapForPublicSignup: false,
    });

    expect(withGap.attention).toContain("workflow.legal-settings");
    expect(noGap.attention).not.toContain("workflow.legal-settings");
  });

  it("returns an empty attention list when an operational gym has every essential ready", () => {
    const suggestions = buildFunctionalitySearchSuggestions(fullySetUpSignals);

    expect(suggestions.attention).toEqual([]);
    expect(suggestions.pinned).toHaveLength(5);
  });

  it("never produces invented attention keys — every suggestion is in the catalog", () => {
    const allKeys = new Set(FUNCTIONALITY_SEARCH_ENTRIES.map((entry) => entry.key));
    const everything = buildFunctionalitySearchSuggestions({
      locationCount: 0,
      membershipPlanCount: 0,
      classSessionCount: 0,
      trainerCount: 0,
      memberCount: 0,
      billingStatus: "not_configured",
      legalGapForPublicSignup: true,
    });

    for (const key of [...everything.pinned, ...everything.attention]) {
      expect(allKeys.has(key)).toBe(true);
    }
  });
});
