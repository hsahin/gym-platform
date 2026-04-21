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
  access: ["Smartdeur koppelen"],
  payments: ["Mollie betalingen koppelen"],
  marketing: [],
  settings: [
    "Vestiging toevoegen",
    "Trainer toevoegen",
    "Teamlid uitnodigen",
    "Contracten en klanten importeren",
  ],
};

export function getDashboardPageLayout(
  currentPage: DashboardPageKey,
): DashboardPageLayout {
  return {
    showOverviewCards: currentPage === "overview",
    formTitles: pageFormTitles[currentPage],
  };
}
