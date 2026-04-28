"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, CreditCard, DoorOpen, Users } from "lucide-react";
import { Card, Chip } from "@heroui/react";
import { KPI } from "@heroui-pro/react/kpi";
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
  const confirmedBookings = snapshot.bookings.filter((booking) =>
    ["confirmed", "checked_in"].includes(booking.status),
  );
  const occupancy =
    totalCapacity === 0
      ? 0
      : Math.round((confirmedBookings.length / totalCapacity) * 100);
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
      label: "Leden",
      value: snapshot.members.length,
      helper: "Actieve en trial-leden in deze gym.",
    },
    {
      icon: CalendarDays,
      label: "Lessen",
      value: snapshot.classSessions.length,
      helper: "Live sessies in het rooster.",
    },
    {
      icon: DoorOpen,
      label: "Bezetting",
      value: occupancy,
      helper: `${confirmedBookings.length} bevestigd van ${totalCapacity} beschikbare plekken.`,
    },
    {
      icon: CreditCard,
      label: "Aandacht",
      value: openHealthChecks.length,
      helper: "Checks die nu aandacht vragen.",
    },
  ];

  return (
    <div className="section-stack">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {highlightedMetrics.map((metric) => (
          <KPI
            key={metric.label}
            className="rounded-[24px] border border-border/80 bg-surface shadow-none"
          >
            <KPI.Header>
              <KPI.Icon>
                <metric.icon className="text-muted h-4 w-4" />
              </KPI.Icon>
            </KPI.Header>
            <KPI.Content>
              <KPI.Title>{metric.label}</KPI.Title>
              <KPI.Value value={metric.value} />
            </KPI.Content>
            <KPI.Footer>{metric.helper}</KPI.Footer>
          </KPI>
        ))}
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

      {overviewFeatures.length > 0 ? (
        <PageSection
          title="Owner-inzicht"
          description="Analytics en operationele signalen staan centraal op het overzicht."
        >
          <FeatureModuleBoard features={overviewFeatures} snapshot={snapshot} />
        </PageSection>
      ) : null}

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
    </div>
  );
}
