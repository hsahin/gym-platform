"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { DashboardPageKey } from "@/lib/dashboard-pages";
import { LoadingPanel, type DashboardPageProps } from "@/components/dashboard/shared";
import type { GymDashboardSnapshot } from "@/server/types";

const pageLoadingState = (title: string) => (
  <LoadingPanel
    title={`${title} wordt geladen`}
    description="Dit dashboardonderdeel wordt alleen geladen wanneer je deze pagina opent."
  />
);

const OverviewDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/OverviewDashboardPage").then(
      (module) => module.OverviewDashboardPage,
    ),
  { loading: () => pageLoadingState("Overview") },
);

const ClassesDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/ClassesDashboardPage").then(
      (module) => module.ClassesDashboardPage,
    ),
  { loading: () => pageLoadingState("Classes") },
);

const MembersDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/MembersDashboardPage").then(
      (module) => module.MembersDashboardPage,
    ),
  { loading: () => pageLoadingState("Members") },
);

const ContractsDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/ContractsDashboardPage").then(
      (module) => module.ContractsDashboardPage,
    ),
  { loading: () => pageLoadingState("Contracts") },
);

const AccessDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/AccessDashboardPage").then(
      (module) => module.AccessDashboardPage,
    ),
  { loading: () => pageLoadingState("Access") },
);

const PaymentsDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/PaymentsDashboardPage").then(
      (module) => module.PaymentsDashboardPage,
    ),
  { loading: () => pageLoadingState("Payments") },
);

const MarketingDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/MarketingDashboardPage").then(
      (module) => module.MarketingDashboardPage,
    ),
  { loading: () => pageLoadingState("Growth") },
);

const SettingsDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/SettingsDashboardPage").then(
      (module) => module.SettingsDashboardPage,
    ),
  { loading: () => pageLoadingState("Settings") },
);

const pageComponents: Record<DashboardPageKey, ComponentType<DashboardPageProps>> = {
  overview: OverviewDashboardPage,
  classes: ClassesDashboardPage,
  members: MembersDashboardPage,
  contracts: ContractsDashboardPage,
  access: AccessDashboardPage,
  payments: PaymentsDashboardPage,
  marketing: MarketingDashboardPage,
  settings: SettingsDashboardPage,
};

export function GymDashboard({
  snapshot,
  currentPage = "overview",
}: {
  readonly snapshot: GymDashboardSnapshot;
  readonly currentPage?: DashboardPageKey;
}) {
  const PageComponent = pageComponents[currentPage] ?? OverviewDashboardPage;
  return <PageComponent snapshot={snapshot} />;
}
