import { describe, expect, it } from "vitest";
import {
  DASHBOARD_PAGE_KEYS,
  getDashboardPageForWorkbenchStep,
  getDashboardPageHref,
  getDashboardPages,
  isDashboardPageKey,
  resolveDashboardRouteKey,
} from "@/lib/dashboard-pages";

function createDashboardPagesInput(overrides?: Partial<Parameters<typeof getDashboardPages>[0]>) {
  return {
    locationsCount: 2,
    membershipPlansCount: 3,
    trainersCount: 4,
    membersCount: 52,
    classSessionsCount: 9,
    bookingsCount: 17,
    staffCount: 6,
    healthAttentionCount: 0,
    paymentsStatusLabel: "Mollie live",
    remoteAccessStatusLabel: "Nuki gekoppeld",
    canManagePayments: true,
    canManageRemoteAccess: true,
    canManageStaff: true,
    coachingFeaturesEnabled: 2,
    retentionFeaturesEnabled: 3,
    mobileFeaturesEnabled: 1,
    integrationFeaturesEnabled: 2,
    canManageFeatureFlags: true,
    canManageOwnerAccounts: false,
    canViewPlatformChecks: false,
    ...overrides,
  };
}

describe("dashboard pages", () => {
  it("exposes every full management page outside the launch flow", () => {
    expect(DASHBOARD_PAGE_KEYS).toEqual([
      "overview",
      "classes",
      "members",
      "contracts",
      "coaching",
      "retention",
      "access",
      "payments",
      "mobile",
      "marketing",
      "integrations",
      "settings",
      "superadmin",
    ]);
  });

  it("builds clear dashboard cards for the expanded owner workspace", () => {
    const pages = getDashboardPages(createDashboardPagesInput());

    expect(pages.map((page) => page.key)).toEqual(
      DASHBOARD_PAGE_KEYS.filter((key) => key !== "superadmin"),
    );
    expect(pages.map((page) => page.href)).toEqual([
      "/dashboard",
      "/dashboard/classes",
      "/dashboard/members",
      "/dashboard/contracts",
      "/dashboard/coaching",
      "/dashboard/retention",
      "/dashboard/access",
      "/dashboard/payments",
      "/dashboard/mobile",
      "/dashboard/marketing",
      "/dashboard/integrations",
      "/dashboard/settings",
    ]);
    expect(pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "overview",
          title: "Overzicht",
          value: "52 leden",
        }),
        expect.objectContaining({
          key: "contracts",
          title: "Contracten",
          value: "3 lidmaatschappen",
        }),
        expect.objectContaining({
          key: "coaching",
          title: "Coaching",
          value: "2 modules actief",
        }),
        expect.objectContaining({
          key: "retention",
          title: "Retentie",
          value: "3 modules actief",
        }),
        expect.objectContaining({
          key: "mobile",
          title: "Mobiele app",
          value: "1 module actief",
        }),
        expect.objectContaining({
          key: "integrations",
          title: "Integraties",
          value: "2 koppelingen live",
        }),
      ]),
    );
    expect(pages.some((page) => page.key === "superadmin")).toBe(false);
  });

  it("keeps dashboard card helpers in Dutch business language", () => {
    const pages = getDashboardPages(createDashboardPagesInput());
    const visibleCopy = pages
      .map((page) => `${page.title}\n${page.value}\n${page.helper}`)
      .join("\n\n");

    for (const fragment of [
      "launchsignalen",
      "check-ins",
      "membercontext",
      "Workoutflows",
      "premium",
      "Remote toegang",
      "White-label",
      "mobile check-in",
      "bookingmomenten",
      "equipment",
      "owner-instellingen",
      "Owner accounts",
      "moduleflags",
      "rolloutcontrole",
    ]) {
      expect(visibleCopy).not.toContain(fragment);
    }
  });

  it("marks protected owner pages without leaking implementation details", () => {
    const pages = getDashboardPages(
      createDashboardPagesInput({
        membersCount: 0,
        classSessionsCount: 0,
        bookingsCount: 0,
        healthAttentionCount: 2,
        paymentsStatusLabel: "Niet gekoppeld",
        remoteAccessStatusLabel: "Niet gekoppeld",
        canManagePayments: false,
        canManageRemoteAccess: false,
        canManageFeatureFlags: false,
        canManageOwnerAccounts: false,
        coachingFeaturesEnabled: 0,
        retentionFeaturesEnabled: 0,
        mobileFeaturesEnabled: 0,
        integrationFeaturesEnabled: 0,
      }),
    );

    expect(pages.find((page) => page.key === "payments")).toMatchObject({
      value: "Alleen eigenaar",
      helper: expect.not.stringContaining("Mollie API"),
    });
    expect(pages.find((page) => page.key === "access")).toMatchObject({
      value: "Alleen eigenaar",
      helper: expect.not.stringContaining("Nuki API"),
    });
    expect(pages.some((page) => page.key === "superadmin")).toBe(false);
    expect(pages.find((page) => page.key === "settings")).toMatchObject({
      title: "Gym instellingen",
      value: "2 vestigingen",
      helper: expect.not.stringContaining("platformstatus"),
    });
    expect(pages.find((page) => page.key === "overview")).toMatchObject({
      value: "0 leden",
    });
    expect(pages.find((page) => page.key === "classes")).toMatchObject({
      value: "0 lessen",
    });
    expect(pages.find((page) => page.key === "marketing")).toMatchObject({
      value: "Eerste data nodig",
    });
  });

  it("labels the superadmin card as owner account management for platform admins", () => {
    const pages = getDashboardPages(
      createDashboardPagesInput({
        canManageOwnerAccounts: true,
        canViewPlatformChecks: true,
      }),
    );

    expect(pages.find((page) => page.key === "superadmin")).toMatchObject({
      value: "Eigenaarsbeheer",
      helper: expect.stringContaining("Eigenaarsaccounts"),
    });
  });

  it("shows platform check counts only to platform superadmins", () => {
    const ownerPages = getDashboardPages(
      createDashboardPagesInput({
        healthAttentionCount: 3,
        canManageOwnerAccounts: false,
        canViewPlatformChecks: false,
      }),
    );
    const superadminPages = getDashboardPages(
      createDashboardPagesInput({
        healthAttentionCount: 3,
        canManageOwnerAccounts: true,
        canViewPlatformChecks: true,
      }),
    );

    expect(ownerPages.find((page) => page.key === "settings")).toMatchObject({
      value: "2 vestigingen",
      helper: "Vestigingen, medewerkers, import en eigenaarsinstellingen.",
    });
    expect(superadminPages.find((page) => page.key === "settings")).toMatchObject({
      value: "3 checks",
      helper: expect.stringContaining("systeemstatus"),
    });
  });

  it("maps routes and workbench actions to the expanded page model", () => {
    expect(getDashboardPageHref("overview")).toBe("/dashboard");
    expect(getDashboardPageHref("coaching")).toBe("/dashboard/coaching");
    expect(isDashboardPageKey("payments")).toBe(true);
    expect(isDashboardPageKey("superadmin")).toBe(true);
    expect(isDashboardPageKey("platform")).toBe(false);
    expect(resolveDashboardRouteKey("overview")).toBe("overview");
    expect(resolveDashboardRouteKey("reservations")).toBe("classes");
    expect(resolveDashboardRouteKey("schedule")).toBe("classes");
    expect(resolveDashboardRouteKey("smartdoors")).toBe("access");
    expect(resolveDashboardRouteKey("coaching")).toBe("coaching");
    expect(resolveDashboardRouteKey("nutrition")).toBe("coaching");
    expect(resolveDashboardRouteKey("retention")).toBe("retention");
    expect(resolveDashboardRouteKey("community")).toBe("retention");
    expect(resolveDashboardRouteKey("mobile")).toBe("mobile");
    expect(resolveDashboardRouteKey("app")).toBe("mobile");
    expect(resolveDashboardRouteKey("integrations")).toBe("integrations");
    expect(resolveDashboardRouteKey("hardware")).toBe("integrations");
    expect(resolveDashboardRouteKey("locations")).toBe("settings");
    expect(resolveDashboardRouteKey("staff")).toBe("settings");
    expect(resolveDashboardRouteKey("imports")).toBe("settings");
    expect(resolveDashboardRouteKey("status")).toBe("settings");
    expect(resolveDashboardRouteKey("feature-flags")).toBe("superadmin");
    expect(resolveDashboardRouteKey("super-admin")).toBe("superadmin");
    expect(resolveDashboardRouteKey("unknown")).toBeNull();
    expect(getDashboardPageForWorkbenchStep("memberships")).toBe("contracts");
    expect(getDashboardPageForWorkbenchStep("remote-access")).toBe("access");
    expect(getDashboardPageForWorkbenchStep("classes")).toBe("classes");
    expect(getDashboardPageForWorkbenchStep("members")).toBe("members");
    expect(getDashboardPageForWorkbenchStep("coaching")).toBe("coaching");
    expect(getDashboardPageForWorkbenchStep("retention")).toBe("retention");
    expect(getDashboardPageForWorkbenchStep("payments")).toBe("payments");
    expect(getDashboardPageForWorkbenchStep("mobile")).toBe("mobile");
    expect(getDashboardPageForWorkbenchStep("integrations")).toBe("integrations");
    expect(getDashboardPageForWorkbenchStep("feature-flags")).toBe("superadmin");
    expect(getDashboardPageForWorkbenchStep("locations")).toBe("settings");
    expect(getDashboardPageForWorkbenchStep("trainers")).toBe("settings");
    expect(getDashboardPageForWorkbenchStep("imports")).toBe("settings");
    expect(getDashboardPageForWorkbenchStep("staff")).toBe("settings");
    expect(getDashboardPageForWorkbenchStep("unknown")).toBe("overview");
  });

  it("uses singular labels when one module is live", () => {
    const pages = getDashboardPages(
      createDashboardPagesInput({
        locationsCount: 1,
        membershipPlansCount: 1,
        trainersCount: 1,
        membersCount: 1,
        classSessionsCount: 1,
        bookingsCount: 1,
        staffCount: 1,
        healthAttentionCount: 1,
        canViewPlatformChecks: true,
        remoteAccessStatusLabel: "Nuki live",
        coachingFeaturesEnabled: 1,
        retentionFeaturesEnabled: 1,
        mobileFeaturesEnabled: 1,
        integrationFeaturesEnabled: 1,
      }),
    );

    expect(pages.find((page) => page.key === "overview")).toMatchObject({
      value: "1 lid",
    });
    expect(pages.find((page) => page.key === "classes")).toMatchObject({
      value: "1 les",
    });
    expect(pages.find((page) => page.key === "contracts")).toMatchObject({
      value: "1 lidmaatschap",
    });
    expect(pages.find((page) => page.key === "coaching")).toMatchObject({
      value: "1 module actief",
    });
    expect(pages.find((page) => page.key === "retention")).toMatchObject({
      value: "1 module actief",
    });
    expect(pages.find((page) => page.key === "mobile")).toMatchObject({
      value: "1 module actief",
    });
    expect(pages.find((page) => page.key === "integrations")).toMatchObject({
      value: "1 koppeling live",
    });
    expect(pages.find((page) => page.key === "marketing")).toMatchObject({
      value: "Segmenten klaar",
    });
    expect(pages.find((page) => page.key === "settings")).toMatchObject({
      title: "Gym instellingen",
      value: "1 check",
    });
  });
});
