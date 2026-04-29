"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CreditCard,
  DoorOpen,
  Users,
} from "lucide-react";
import { Card, Chip } from "@heroui/react";
import { KPI, KPIGroup } from "@heroui-pro/react";
import { ListView } from "@/components/dashboard/HydrationSafeListView";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import {
  EmptyPanel,
  PageSection,
  formatDateTime,
  statusChip,
  type DashboardPageProps,
} from "@/components/dashboard/shared";
import { getDashboardPages } from "@/lib/dashboard-pages";

export function OverviewDashboardPage({ snapshot }: DashboardPageProps) {
  const upcomingSessions = [...snapshot.classSessions].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  );
  const recentBookings = [...snapshot.bookings].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const recentAuditEntries = snapshot.auditEntries.slice(0, 6);
  const openHealthChecks = snapshot.healthReport.checks.filter(
    (check) => check.status !== "healthy",
  );
  const totalCapacity = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.capacity,
    0,
  );
  const bookedSpots = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.bookedCount,
    0,
  );
  const waitlistSpots = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.waitlistCount,
    0,
  );
  const activeMembers = snapshot.members.filter((member) =>
    ["active", "trial"].includes(member.status),
  );
  const trialMembers = activeMembers.filter((member) => member.status === "trial").length;
  const projectedMonthlyRevenue = snapshot.membershipPlans.reduce(
    (sum, plan) => sum + plan.priceMonthly * plan.activeMembers,
    0,
  );
  const occupancy =
    totalCapacity === 0
      ? 0
      : Math.round((bookedSpots / totalCapacity) * 100);
  const occupancyRatio = totalCapacity === 0 ? 0 : bookedSpots / totalCapacity;
  const activePlans = snapshot.membershipPlans.filter((plan) => plan.status === "active");
  const coachingFeaturesEnabled = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "coaching" && feature.enabled,
  ).length;
  const retentionFeaturesEnabled = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "retention" && feature.enabled,
  ).length;
  const mobileFeaturesEnabled = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "mobile" && feature.enabled,
  ).length;
  const integrationFeaturesEnabled = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "integrations" && feature.enabled,
  ).length;
  const dashboardModules = getDashboardPages({
    locationsCount: snapshot.locations.length,
    membershipPlansCount: snapshot.membershipPlans.length,
    trainersCount: snapshot.trainers.length,
    membersCount: snapshot.members.length,
    classSessionsCount: snapshot.classSessions.length,
    bookingsCount: snapshot.bookings.length,
    staffCount: snapshot.staff.length,
    healthAttentionCount: openHealthChecks.length,
    paymentsStatusLabel: snapshot.payments.statusLabel,
    remoteAccessStatusLabel: snapshot.remoteAccess.statusLabel,
    canManagePayments: snapshot.uiCapabilities.canManagePayments,
    canManageRemoteAccess: snapshot.uiCapabilities.canManageRemoteAccess,
    canManageStaff: snapshot.uiCapabilities.canManageStaff,
    coachingFeaturesEnabled,
    retentionFeaturesEnabled,
    mobileFeaturesEnabled,
    integrationFeaturesEnabled,
    canManageFeatureFlags: snapshot.uiCapabilities.canManageFeatureFlags,
    canManageOwnerAccounts: snapshot.uiCapabilities.canManageOwnerAccounts,
  });
  const overviewFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "overview",
  );

  const highlightedMetrics = [
    {
      icon: Users,
      iconStatus: activeMembers.length > 0 ? "success" : "warning",
      label: "Actieve leden",
      trend: trialMembers > 0 ? "up" : "neutral",
      trendLabel: trialMembers > 0 ? `${trialMembers} trial` : "Geen trials",
      value: activeMembers.length,
      valueKind: "decimal",
      helper: `${snapshot.members.length} ledenprofielen totaal in deze gym.`,
    },
    {
      icon: CalendarDays,
      iconStatus: snapshot.classSessions.length > 0 ? "success" : "warning",
      label: "Live lessen",
      trend: snapshot.bookings.length > 0 ? "up" : "neutral",
      trendLabel: `${snapshot.bookings.length} reserveringen`,
      value: snapshot.classSessions.length,
      valueKind: "decimal",
      helper: `${bookedSpots} geboekte plekken en ${waitlistSpots} wachtlijstplekken.`,
    },
    {
      icon: DoorOpen,
      iconStatus: occupancy > 0 ? "success" : "warning",
      label: "Bezetting",
      progress: occupancy,
      progressStatus: occupancy >= 85 ? "success" : occupancy >= 45 ? "warning" : "danger",
      trend: occupancy >= 70 ? "up" : occupancy > 0 ? "neutral" : "down",
      trendLabel: `${occupancy}% gevuld`,
      value: occupancyRatio,
      valueKind: "percent",
      helper: `${bookedSpots} van ${totalCapacity} beschikbare plekken gevuld.`,
    },
    {
      icon: CreditCard,
      iconStatus: projectedMonthlyRevenue > 0 ? "success" : "warning",
      label: "Omzet MRR",
      trend: projectedMonthlyRevenue > 0 ? "up" : "neutral",
      trendLabel: `${activePlans.length} actieve plannen`,
      value: projectedMonthlyRevenue,
      valueKind: "currency",
      helper: `${snapshot.projectedRevenueLabel} verwachte maandwaarde.`,
    },
    {
      icon: AlertTriangle,
      iconStatus: openHealthChecks.length === 0 ? "success" : "danger",
      label: "Aandacht",
      trend: openHealthChecks.length === 0 ? "up" : "down",
      trendLabel: openHealthChecks.length === 0 ? "Op schema" : "Actie nodig",
      value: openHealthChecks.length,
      valueKind: "decimal",
      helper:
        openHealthChecks[0]?.summary ??
        "Geen open healthchecks, waivers of runtime-acties op de overview.",
    },
  ] as const;

  return (
    <div className="section-stack">
      <div className="overflow-x-auto pb-1">
        <KPIGroup
          aria-label="Belangrijkste dashboardcijfers"
          className="min-w-[1040px] rounded-[30px] border border-border/80 bg-surface/95 shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
        >
          {highlightedMetrics.map((metric, index) => (
            <Fragment key={metric.label}>
              {index > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[190px] bg-transparent shadow-none">
                <KPI.Header>
                  <KPI.Icon status={metric.iconStatus}>
                    <metric.icon className="h-4 w-4" />
                  </KPI.Icon>
                  <KPI.Title>{metric.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content className="grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                  {metric.valueKind === "currency" ? (
                    <KPI.Value
                      className="text-3xl"
                      currency="EUR"
                      maximumFractionDigits={0}
                      style="currency"
                      value={metric.value}
                    />
                  ) : metric.valueKind === "percent" ? (
                    <KPI.Value
                      className="text-3xl"
                      maximumFractionDigits={0}
                      style="percent"
                      value={metric.value}
                    />
                  ) : (
                    <KPI.Value className="text-3xl" maximumFractionDigits={0} value={metric.value} />
                  )}
                  <KPI.Trend trend={metric.trend} variant="tertiary">
                    {metric.trendLabel}
                  </KPI.Trend>
                </KPI.Content>
                {"progress" in metric ? (
                  <KPI.Progress status={metric.progressStatus} value={metric.progress} />
                ) : null}
                <KPI.Footer className="text-muted text-sm leading-6">{metric.helper}</KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </div>

      <PageSection
        title="Platform modules"
        description="Elke kernfunctie heeft nu een eigen dashboardpagina en kan tenant-breed worden uitgezet vanuit Superadmin."
      >
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {dashboardModules.map((module) => (
            <Link
              key={module.key}
              href={module.href}
              prefetch={false}
              className="group rounded-[24px] border border-border/80 bg-surface p-5 shadow-none transition hover:border-foreground/20 hover:bg-surface-secondary"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold">{module.title}</p>
                  <ArrowRight className="text-muted h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
                <p className="text-3xl font-semibold">{module.value}</p>
                <p className="text-muted text-sm leading-6">{module.helper}</p>
              </div>
            </Link>
          ))}
        </div>
      </PageSection>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] xl:items-start">
        <PageSection
          title="Volgende lessen"
          description="Aankomende lessen met trainer en capaciteit."
        >
          {upcomingSessions.length > 0 ? (
            <ListView aria-label="Volgende lessen" items={upcomingSessions.slice(0, 6)}>
              {(session) => {
                const chip = statusChip(session.status);

                return (
                  <ListView.Item id={session.id} textValue={session.title}>
                    <ListView.ItemContent>
                      <ListView.Title>{session.title}</ListView.Title>
                      <ListView.Description>
                        {formatDateTime(session.startsAt)} · {session.focus} · {session.bookedCount}/
                        {session.capacity}
                      </ListView.Description>
                    </ListView.ItemContent>
                    <Chip color={chip.color} size="sm" variant={chip.variant}>
                      {session.status}
                    </Chip>
                  </ListView.Item>
                );
              }}
            </ListView>
          ) : (
            <EmptyPanel
              title="Nog geen lessen"
              description="Plan je eerste les vanuit de workbench om reserveringen te openen."
            />
          )}
        </PageSection>

        <PageSection
          title="Platformstatus"
          description="De huidige status van betalingen, toegang en runtimechecks."
        >
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
            {[
              {
                label: "Betalingen",
                value: snapshot.payments.statusLabel,
                helper: snapshot.payments.helpText,
              },
              {
                label: "Toegang",
                value: snapshot.remoteAccess.statusLabel,
                helper: snapshot.remoteAccess.helpText,
              },
              {
                label: "Gezondheid",
                value:
                  openHealthChecks.length === 0
                    ? "Alles gezond"
                    : `${openHealthChecks.length} aandachtspunt${openHealthChecks.length === 1 ? "" : "en"}`,
                helper:
                  openHealthChecks[0]?.summary ?? "Runtime en synchronisatiechecks.",
              },
            ].map((item) => (
              <Card key={item.label} className="rounded-2xl border-border/70 bg-surface-secondary">
                <Card.Content className="space-y-2">
                  <p className="text-muted text-sm">{item.label}</p>
                  <p className="text-lg font-semibold">{item.value}</p>
                  <p className="text-muted text-sm leading-6">{item.helper}</p>
                </Card.Content>
              </Card>
            ))}
          </div>
        </PageSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
        <PageSection
          title="Recente reserveringen"
          description="Laatste reserveringsactiviteit, inclusief wachtlijstdruk."
        >
          {recentBookings.length > 0 ? (
            <ListView aria-label="Recente reserveringen" items={recentBookings.slice(0, 6)}>
              {(booking) => {
                const chip = statusChip(booking.status);

                return (
                  <ListView.Item id={booking.id} textValue={booking.memberName}>
                    <ListView.ItemContent>
                      <ListView.Title>{booking.memberName}</ListView.Title>
                      <ListView.Description>
                        {booking.source} · {booking.phone}
                      </ListView.Description>
                    </ListView.ItemContent>
                    <Chip color={chip.color} size="sm" variant={chip.variant}>
                      {booking.status}
                    </Chip>
                  </ListView.Item>
                );
              }}
            </ListView>
          ) : (
            <EmptyPanel
              title="Nog geen reserveringen"
              description="Reserveringen verschijnen hier zodra de eerste les live staat."
            />
          )}
        </PageSection>

        <PageSection title="Teamnotities" description="Herbruikbare context voor het team.">
          <div className="grid gap-3">
            <Card className="rounded-2xl border-border/70 bg-surface-secondary">
              <Card.Content className="space-y-2">
                <p className="text-muted text-sm">Notificatievoorbeeld</p>
                <p className="text-sm leading-6">{snapshot.notificationPreview}</p>
              </Card.Content>
            </Card>
            <Card className="rounded-2xl border-border/70 bg-surface-secondary">
              <Card.Content className="space-y-2">
                <p className="text-muted text-sm">Laatste auditregels</p>
                <div className="grid gap-2">
                  {recentAuditEntries.map((entry) => (
                    <div
                      key={entry.eventId}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-surface px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{entry.action}</p>
                        <p className="text-muted text-xs">{formatDateTime(entry.occurredAt)}</p>
                      </div>
                      <ArrowRight className="text-muted h-4 w-4 shrink-0" />
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>
          </div>
        </PageSection>
      </div>

      <LazyPlatformWorkbench
        sections={["locations", "contracts", "trainers", "classes", "members"]}
        showLaunchHeader
        snapshot={snapshot}
      />

      {overviewFeatures.length > 0 ? (
        <PageSection
          title="Owner-inzicht"
          description="Compact overzicht van analytics en operationele signalen."
        >
          <FeatureModuleBoard currentPage="overview" features={overviewFeatures} snapshot={snapshot} />
        </PageSection>
      ) : null}
    </div>
  );
}
