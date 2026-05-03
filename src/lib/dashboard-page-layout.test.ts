import { describe, expect, it } from "vitest";
import { DASHBOARD_PAGE_KEYS } from "@/lib/dashboard-pages";
import { getDashboardPageLayout } from "@/lib/dashboard-page-layout";

describe("dashboard page layout", () => {
  it("shows the repeated owner fact cards only on the dashboard overview", () => {
    const layouts = DASHBOARD_PAGE_KEYS.map((page) => ({
      page,
      layout: getDashboardPageLayout(page),
    }));

    expect(layouts.filter(({ layout }) => layout.showOverviewCards)).toEqual([
      {
        page: "overview",
        layout: expect.objectContaining({ showOverviewCards: true }),
      },
    ]);
  });

  it("gives each management page direct form titles instead of launch-step labels", () => {
    expect(getDashboardPageLayout("classes").formTitles).toEqual(["Les plannen"]);
    expect(getDashboardPageLayout("members").formTitles).toEqual(["Lid toevoegen"]);
    expect(getDashboardPageLayout("contracts").formTitles).toEqual([
      "Lidmaatschap toevoegen",
      "Lidmaatschappen en leden importeren",
    ]);
    expect(getDashboardPageLayout("coaching").formTitles).toEqual([
      "Trainingsroute configureren",
    ]);
    expect(getDashboardPageLayout("retention").formTitles).toEqual([
      "Retentiecampagne starten",
    ]);
    expect(getDashboardPageLayout("access").formTitles).toEqual(["Smartdeur koppelen"]);
    expect(getDashboardPageLayout("payments").formTitles).toEqual([
      "Mollie betalingen koppelen",
    ]);
    expect(getDashboardPageLayout("mobile").formTitles).toEqual([
      "Mobiele app configureren",
    ]);
    expect(getDashboardPageLayout("integrations").formTitles).toEqual([
      "Integratie koppelen",
    ]);
    expect(getDashboardPageLayout("settings").formTitles).toEqual([
      "Vestiging toevoegen",
      "Trainer toevoegen",
      "Medewerker uitnodigen",
      "Lidmaatschappen en leden importeren",
    ]);
    expect(getDashboardPageLayout("superadmin").formTitles).toEqual([
      "Eigenaar toevoegen",
      "Clubmodules beheren",
    ]);
  });
});
