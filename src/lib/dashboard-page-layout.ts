import type { DashboardPageKey } from "@/lib/dashboard-pages";

export interface DashboardPageLayout {
  readonly showOverviewCards: boolean;
  readonly formTitles: ReadonlyArray<string>;
}

const pageFormTitles: Record<DashboardPageKey, ReadonlyArray<string>> = {
  overview: [],
  classes: ["Les plannen"],
  members: ["Lid toevoegen"],
  contracts: ["Contract toevoegen", "Contracten en klanten importeren"],
  coaching: ["Workout flow configureren"],
  retention: ["Retentiecampagne starten"],
  access: ["Smartdeur koppelen"],
  payments: ["Mollie betalingen koppelen"],
  mobile: ["Mobiele app configureren"],
  marketing: [],
  integrations: ["Integratie koppelen"],
  settings: [
    "Vestiging toevoegen",
    "Trainer toevoegen",
    "Teamlid uitnodigen",
    "Contracten en klanten importeren",
  ],
  superadmin: ["Feature flags beheren"],
};

export function getDashboardPageLayout(
  currentPage: DashboardPageKey,
): DashboardPageLayout {
  return {
    showOverviewCards: currentPage === "overview",
    formTitles: pageFormTitles[currentPage],
  };
}
