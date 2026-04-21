import { describe, expect, it } from "vitest";
import {
  DASHBOARD_PAGE_KEYS,
  getDashboardPageForWorkbenchStep,
  getDashboardPageHref,
  getDashboardPages,
  isDashboardPageKey,
} from "@/lib/dashboard-pages";

describe("dashboard pages", () => {
  it("exposes every full management page outside the launch flow", () => {
    expect(DASHBOARD_PAGE_KEYS).toEqual([
      "overview",
      "classes",
      "members",
      "contracts",
      "access",
      "payments",
      "marketing",
      "settings",
    ]);
  });

  it("builds clear dashboard cards for owner settings and daily operations", () => {
    const pages = getDashboardPages({
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
    });

    expect(pages.map((page) => page.key)).toEqual(DASHBOARD_PAGE_KEYS);
    expect(pages.map((page) => page.href)).toEqual([
      "/dashboard",
      "/dashboard/classes",
      "/dashboard/members",
      "/dashboard/contracts",
      "/dashboard/access",
      "/dashboard/payments",
      "/dashboard/marketing",
      "/dashboard/settings",
    ]);
    expect(pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "contracts",
          title: "Contracten",
          value: "3 contracten",
        }),
        expect.objectContaining({
          key: "payments",
          title: "Betalingen",
          value: "Mollie live",
        }),
        expect.objectContaining({
          key: "access",
          title: "Smartdeurs",
          value: "Nuki gekoppeld",
        }),
        expect.objectContaining({
          key: "settings",
          value: "Alles gezond",
        }),
      ]),
    );
  });

  it("marks protected owner pages without leaking implementation details", () => {
    const pages = getDashboardPages({
      locationsCount: 0,
      membershipPlansCount: 0,
      trainersCount: 0,
      membersCount: 0,
      classSessionsCount: 0,
      bookingsCount: 0,
      staffCount: 1,
      healthAttentionCount: 2,
      paymentsStatusLabel: "Niet gekoppeld",
      remoteAccessStatusLabel: "Niet gekoppeld",
      canManagePayments: false,
      canManageRemoteAccess: false,
      canManageStaff: false,
    });

    expect(pages.find((page) => page.key === "payments")).toMatchObject({
      value: "Owner-only",
      helper: expect.not.stringContaining("Mollie API"),
    });
    expect(pages.find((page) => page.key === "access")).toMatchObject({
      value: "Owner-only",
      helper: expect.not.stringContaining("Nuki API"),
    });
    expect(pages.find((page) => page.key === "settings")).toMatchObject({
      value: "2 checks",
    });
  });

  it("maps launch actions to real owner pages instead of tab state", () => {
    expect(getDashboardPageHref("overview")).toBe("/dashboard");
    expect(isDashboardPageKey("payments")).toBe(true);
    expect(isDashboardPageKey("platform")).toBe(false);
    expect(getDashboardPageForWorkbenchStep("memberships")).toBe("contracts");
    expect(getDashboardPageForWorkbenchStep("remote-access")).toBe("access");
    expect(getDashboardPageForWorkbenchStep("classes")).toBe("classes");
    expect(getDashboardPageForWorkbenchStep("staff")).toBe("settings");
  });
});
