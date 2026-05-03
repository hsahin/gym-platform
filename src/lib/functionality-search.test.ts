import { describe, expect, it } from "vitest";
import { DASHBOARD_FEATURE_CATALOG } from "@/features/dashboard-feature-catalog";
import { DASHBOARD_PAGE_KEYS } from "@/lib/dashboard-pages";
import {
  FUNCTIONALITY_SEARCH_ENTRIES,
  getVisibleFunctionalitySearchEntries,
  resolveFunctionalitySearchHref,
  searchFunctionality,
} from "@/lib/functionality-search";

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
});
