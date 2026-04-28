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
  { loading: () => pageLoadingState("Overzicht") },
);

const ClassesDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/ClassesDashboardPage").then(
      (module) => module.ClassesDashboardPage,
    ),
  { loading: () => pageLoadingState("Lessen") },
);

const MembersDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/MembersDashboardPage").then(
      (module) => module.MembersDashboardPage,
    ),
  { loading: () => pageLoadingState("Leden") },
);

const ContractsDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/ContractsDashboardPage").then(
      (module) => module.ContractsDashboardPage,
    ),
  { loading: () => pageLoadingState("Contracten") },
);

const CoachingDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/CoachingDashboardPage").then(
      (module) => module.CoachingDashboardPage,
    ),
  { loading: () => pageLoadingState("Coaching") },
);

const RetentionDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/RetentionDashboardPage").then(
      (module) => module.RetentionDashboardPage,
    ),
  { loading: () => pageLoadingState("Retentie") },
);

const AccessDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/AccessDashboardPage").then(
      (module) => module.AccessDashboardPage,
    ),
  { loading: () => pageLoadingState("Toegang") },
);

const PaymentsDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/PaymentsDashboardPage").then(
      (module) => module.PaymentsDashboardPage,
    ),
  { loading: () => pageLoadingState("Betalingen") },
);

const MobileDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/MobileDashboardPage").then(
      (module) => module.MobileDashboardPage,
    ),
  { loading: () => pageLoadingState("Mobiele app") },
);

const MarketingDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/MarketingDashboardPage").then(
      (module) => module.MarketingDashboardPage,
    ),
  { loading: () => pageLoadingState("Marketing") },
);

const IntegrationsDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/IntegrationsDashboardPage").then(
      (module) => module.IntegrationsDashboardPage,
    ),
  { loading: () => pageLoadingState("Integraties") },
);

const SettingsDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/SettingsDashboardPage").then(
      (module) => module.SettingsDashboardPage,
    ),
  { loading: () => pageLoadingState("Instellingen") },
);

const SuperadminDashboardPage = dynamic<DashboardPageProps>(
  () =>
    import("@/components/dashboard/pages/SuperadminDashboardPage").then(
      (module) => module.SuperadminDashboardPage,
    ),
  { loading: () => pageLoadingState("Superadmin") },
);

const pageComponents: Record<DashboardPageKey, ComponentType<DashboardPageProps>> = {
  overview: OverviewDashboardPage,
  classes: ClassesDashboardPage,
  members: MembersDashboardPage,
  contracts: ContractsDashboardPage,
  coaching: CoachingDashboardPage,
  retention: RetentionDashboardPage,
  access: AccessDashboardPage,
  payments: PaymentsDashboardPage,
  mobile: MobileDashboardPage,
  marketing: MarketingDashboardPage,
  integrations: IntegrationsDashboardPage,
  settings: SettingsDashboardPage,
  superadmin: SuperadminDashboardPage,
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
