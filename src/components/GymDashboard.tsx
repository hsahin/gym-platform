"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  DoorOpen,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Card, Chip } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react/empty-state";
import { KPI } from "@heroui-pro/react/kpi";
import { ListView } from "@heroui-pro/react/list-view";
import { Segment } from "@heroui-pro/react/segment";
import { AttendanceButton } from "@/components/AttendanceButton";
import { BookingDialog } from "@/components/BookingDialog";
import { CancelBookingButton } from "@/components/CancelBookingButton";
import { PlatformWorkbench } from "@/components/PlatformWorkbench";
import { getMembershipBillingCycleLabel } from "@/lib/memberships";
import type { DashboardPageKey } from "@/lib/dashboard-pages";
import type { GymDashboardSnapshot } from "@/server/types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

function statusChip(status: string) {
  if (
    ["active", "confirmed", "checked_in", "healthy", "configured", "signed"].includes(
      status,
    )
  ) {
    return { color: "success" as const, variant: "soft" as const };
  }

  if (["waitlisted", "trial", "attention", "requested", "expired"].includes(status)) {
    return { color: "warning" as const, variant: "soft" as const };
  }

  if (["paused", "cancelled", "archived"].includes(status)) {
    return { color: "default" as const, variant: "tertiary" as const };
  }

  return { color: "accent" as const, variant: "tertiary" as const };
}

function PageSection({
  title,
  description,
  actions,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="grid content-start gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-xl font-semibold leading-tight">{title}</h2>
          {description ? (
            <p className="text-muted max-w-3xl text-sm leading-6">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <EmptyState className="rounded-[28px] border border-border/80 bg-surface">
      <EmptyState.Header>
        <EmptyState.Title>{title}</EmptyState.Title>
      </EmptyState.Header>
      <EmptyState.Content>
        <EmptyState.Description>{description}</EmptyState.Description>
      </EmptyState.Content>
    </EmptyState>
  );
}

export function GymDashboard({
  snapshot,
  currentPage = "overview",
}: {
  snapshot: GymDashboardSnapshot;
  currentPage?: DashboardPageKey;
}) {
  const [classesView, setClassesView] = useState<"schedule" | "bookings">("schedule");
  const [membersView, setMembersView] = useState<"members" | "waivers">("members");
  const [settingsView, setSettingsView] = useState<"ops" | "team" | "legal">("ops");

  const upcomingSessions = useMemo(
    () =>
      [...snapshot.classSessions].sort((left, right) =>
        left.startsAt.localeCompare(right.startsAt),
      ),
    [snapshot.classSessions],
  );
  const recentBookings = useMemo(
    () =>
      [...snapshot.bookings].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [snapshot.bookings],
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

  const highlightedMetrics = [
    {
      icon: Users,
      label: "Members",
      value: snapshot.members.length,
      helper: "Active and trial member records.",
    },
    {
      icon: CalendarDays,
      label: "Classes",
      value: snapshot.classSessions.length,
      helper: "Live sessions on the schedule.",
    },
    {
      icon: DoorOpen,
      label: "Occupancy",
      value: occupancy,
      helper: `${confirmedBookings.length} confirmed across ${totalCapacity} available spots.`,
    },
    {
      icon: CreditCard,
      label: "Attention",
      value: openHealthChecks.length,
      helper: "Checks currently outside healthy state.",
    },
  ];

  const overviewContent = (
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] xl:items-start">
        <PageSection
          title="Next sessions"
          description="Upcoming classes with trainer and capacity state."
        >
          {upcomingSessions.length > 0 ? (
            <ListView aria-label="Next sessions" items={upcomingSessions.slice(0, 6)}>
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
              title="No sessions yet"
              description="Add the first class from the workbench to open the booking flow."
            />
          )}
        </PageSection>

        <PageSection
          title="Platform state"
          description="The current operational readiness of billing, access, and health."
        >
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
            {[
              {
                label: "Payments",
                value: snapshot.payments.statusLabel,
                helper: snapshot.payments.helpText,
              },
              {
                label: "Access",
                value: snapshot.remoteAccess.statusLabel,
                helper: snapshot.remoteAccess.helpText,
              },
              {
                label: "Health",
                value:
                  openHealthChecks.length === 0
                    ? "All healthy"
                    : `${openHealthChecks.length} attention items`,
                helper:
                  openHealthChecks[0]?.summary ?? "Core runtime and sync checks.",
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
          title="Recent bookings"
          description="Latest booking activity, including waitlist pressure."
        >
          {recentBookings.length > 0 ? (
            <ListView aria-label="Recent bookings" items={recentBookings.slice(0, 6)}>
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
              title="No bookings yet"
              description="Bookings will appear here as soon as the first class goes live."
            />
          )}
        </PageSection>

        <PageSection title="Operator notes" description="Reusable context for the floor team.">
          <div className="grid gap-3">
            <Card className="rounded-2xl border-border/70 bg-surface-secondary">
              <Card.Content className="space-y-2">
                <p className="text-muted text-sm">Notification preview</p>
                <p className="text-sm leading-6">{snapshot.notificationPreview}</p>
              </Card.Content>
            </Card>
            <Card className="rounded-2xl border-border/70 bg-surface-secondary">
              <Card.Content className="space-y-2">
                <p className="text-muted text-sm">Last audit entries</p>
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

      <PlatformWorkbench
        sections={["locations", "contracts", "trainers", "classes", "members"]}
        showLaunchHeader
        snapshot={snapshot}
      />
    </div>
  );

  const classesContent = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <div className="section-stack">
        <PageSection
          actions={<BookingDialog classSessions={snapshot.classSessions} members={snapshot.members} />}
          title="Classes and bookings"
          description="Switch between schedule and booking operations."
        >
          <div className="grid content-start gap-3">
            <Segment
              className="w-full max-w-[22rem]"
              selectedKey={classesView}
              size="sm"
              onSelectionChange={(key) => setClassesView(String(key) as typeof classesView)}
            >
              <Segment.Item id="schedule">Schedule</Segment.Item>
              <Segment.Item id="bookings">Bookings</Segment.Item>
            </Segment>

            {classesView === "schedule" ? (
              upcomingSessions.length > 0 ? (
                <ListView aria-label="Classes" items={upcomingSessions}>
                  {(session) => (
                    <ListView.Item id={session.id} textValue={session.title}>
                      <ListView.ItemContent>
                        <ListView.Title>{session.title}</ListView.Title>
                        <ListView.Description>
                          {formatDateTime(session.startsAt)} · {session.focus} · {session.bookedCount}/
                          {session.capacity}
                        </ListView.Description>
                      </ListView.ItemContent>
                      <Chip size="sm" variant="tertiary">
                        {session.level}
                      </Chip>
                    </ListView.Item>
                  )}
                </ListView>
              ) : (
                <EmptyPanel title="No classes yet" description="Schedule the first live class from the workbench." />
              )
            ) : recentBookings.length > 0 ? (
              <div className="grid gap-3">
                {recentBookings.map((booking) => {
                  const chip = statusChip(booking.status);

                  return (
                    <Card key={booking.id} className="rounded-2xl border-border/80">
                      <Card.Content className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{booking.memberName}</p>
                <Chip color={chip.color} size="sm" variant={chip.variant}>
                  {booking.status}
                </Chip>
                          </div>
                          <p className="text-muted text-sm">
                            {booking.phone} · {booking.source}
                          </p>
                          {booking.notes ? (
                            <p className="text-muted text-sm">{booking.notes}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {booking.status !== "checked_in" ? (
                            <AttendanceButton
                              bookingId={booking.id}
                              expectedVersion={booking.version}
                            />
                          ) : null}
                          {booking.status !== "cancelled" ? (
                            <CancelBookingButton
                              bookingId={booking.id}
                              expectedVersion={booking.version}
                            />
                          ) : null}
                        </div>
                      </Card.Content>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel title="No bookings yet" description="Bookings will populate here once members start reserving." />
            )}
          </div>
        </PageSection>
      </div>

      <PlatformWorkbench sections={["classes"]} showLaunchHeader={false} snapshot={snapshot} />
    </div>
  );

  const membersContent = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <PageSection title="Members" description="Review member state and waiver completion.">
        <div className="grid content-start gap-3">
          <Segment
            className="w-full max-w-[22rem]"
            selectedKey={membersView}
            size="sm"
            onSelectionChange={(key) => setMembersView(String(key) as typeof membersView)}
          >
            <Segment.Item id="members">Members</Segment.Item>
            <Segment.Item id="waivers">Waivers</Segment.Item>
          </Segment>

          {membersView === "members" ? (
            snapshot.members.length > 0 ? (
              <ListView aria-label="Members" items={snapshot.members}>
                {(member) => {
                  const chip = statusChip(member.status);

                  return (
                    <ListView.Item id={member.id} textValue={member.fullName}>
                      <ListView.ItemContent>
                        <ListView.Title>{member.fullName}</ListView.Title>
                        <ListView.Description>
                          {member.email} · {formatDate(member.joinedAt)}
                        </ListView.Description>
                      </ListView.ItemContent>
                      <div className="flex flex-wrap gap-2">
                        <Chip color={chip.color} size="sm" variant={chip.variant}>
                          {member.status}
                        </Chip>
                        <Chip size="sm" variant="tertiary">
                          {member.waiverStatus}
                        </Chip>
                      </div>
                    </ListView.Item>
                  );
                }}
              </ListView>
            ) : (
              <EmptyPanel title="No members yet" description="Add the first member or import your existing member list." />
            )
          ) : snapshot.waivers.length > 0 ? (
            <ListView aria-label="Waivers" items={snapshot.waivers}>
              {(waiver) => {
                const chip = statusChip(waiver.status);

                return (
                  <ListView.Item id={waiver.memberId} textValue={waiver.memberName}>
                    <ListView.ItemContent>
                      <ListView.Title>{waiver.memberName}</ListView.Title>
                      <ListView.Description>
                        {waiver.fileName ?? "Nog geen document"} · {waiver.expiresAt ? formatDate(waiver.expiresAt) : "Geen verloopdatum"}
                      </ListView.Description>
                    </ListView.ItemContent>
                    <Chip color={chip.color} size="sm" variant={chip.variant}>
                      {waiver.status}
                    </Chip>
                  </ListView.Item>
                );
              }}
            </ListView>
          ) : (
            <EmptyPanel title="No waivers tracked" description="Signed or requested waivers appear here once members are added." />
          )}
        </div>
      </PageSection>

      <PlatformWorkbench sections={["members"]} showLaunchHeader={false} snapshot={snapshot} />
    </div>
  );

  const contractsContent = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <PageSection
        title="Memberships"
        description="Commercial plans and imported member data."
      >
        {snapshot.membershipPlans.length > 0 ? (
          <div className="grid gap-3">
            {snapshot.membershipPlans.map((plan) => (
              <Card key={plan.id} className="rounded-2xl border-border/80">
                <Card.Content className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium">{plan.name}</p>
                    <Chip size="sm" variant="soft">
                      {getMembershipBillingCycleLabel(plan.billingCycle)}
                    </Chip>
                  </div>
                  <p className="text-muted text-sm">
                    EUR {plan.priceMonthly}/month · {plan.activeMembers} active members
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {plan.perks.map((perk) => (
                      <Chip key={perk} size="sm" variant="tertiary">
                        {perk}
                      </Chip>
                    ))}
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyPanel title="No memberships yet" description="Add the membership plans your gym actually sells." />
        )}
      </PageSection>

      <PlatformWorkbench
        sections={["contracts", "imports"]}
        showLaunchHeader={false}
        snapshot={snapshot}
      />
    </div>
  );

  const accessContent = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <PageSection
        title="Remote access"
        description="Current device state and recent operator actions."
      >
        <div className="grid gap-4">
          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-3">
              <div className="flex items-center gap-2">
                <DoorOpen className="h-4 w-4" />
                <p className="font-medium">{snapshot.remoteAccess.deviceLabel}</p>
              </div>
              <p className="text-muted text-sm">{snapshot.remoteAccess.helpText}</p>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="soft">
                  {snapshot.remoteAccess.statusLabel}
                </Chip>
                {snapshot.remoteAccess.locationName ? (
                  <Chip size="sm" variant="tertiary">
                    {snapshot.remoteAccess.locationName}
                  </Chip>
                ) : null}
              </div>
            </Card.Content>
          </Card>

          {recentAuditEntries.length > 0 ? (
            <ListView aria-label="Recent access events" items={recentAuditEntries}>
              {(entry) => (
                <ListView.Item
                  id={entry.eventId}
                  textValue={entry.action}
                >
                  <ListView.ItemContent>
                    <ListView.Title>{entry.action}</ListView.Title>
                    <ListView.Description>
                      {formatDateTime(entry.occurredAt)}
                    </ListView.Description>
                  </ListView.ItemContent>
                  <ShieldCheck className="text-muted h-4 w-4" />
                </ListView.Item>
              )}
            </ListView>
          ) : null}
        </div>
      </PageSection>

      <PlatformWorkbench sections={["remote-access"]} showLaunchHeader={false} snapshot={snapshot} />
    </div>
  );

  const paymentsContent = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <PageSection
        title="Payments"
        description="Billing profile, enabled flows, and settlement state."
      >
        <div className="grid gap-4">
          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <p className="font-medium">{snapshot.payments.profileLabel}</p>
              </div>
              <p className="text-muted text-sm">{snapshot.payments.helpText}</p>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="soft">
                  {snapshot.payments.statusLabel}
                </Chip>
                {snapshot.payments.paymentMethods.map((method) => (
                  <Chip key={method} size="sm" variant="tertiary">
                    {method}
                  </Chip>
                ))}
              </div>
            </Card.Content>
          </Card>

          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-2">
              <p className="text-muted text-sm">Support</p>
              <p className="font-medium">{snapshot.payments.supportEmail}</p>
              <p className="text-muted text-sm">
                {snapshot.payments.settlementLabel} · {snapshot.payments.profileId}
              </p>
            </Card.Content>
          </Card>
        </div>
      </PageSection>

      <PlatformWorkbench sections={["payments"]} showLaunchHeader={false} snapshot={snapshot} />
    </div>
  );

  const marketingContent = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PageSection
        title="Growth signals"
        description="Operational growth inputs pulled from actual bookings and member state."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-2">
              <p className="text-muted text-sm">Occupancy</p>
              <p className="text-3xl font-semibold">{occupancy}%</p>
              <p className="text-muted text-sm">Use this to spot fill pressure and class timing issues.</p>
            </Card.Content>
          </Card>
          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-2">
              <p className="text-muted text-sm">Trials</p>
              <p className="text-3xl font-semibold">
                {snapshot.members.filter((member) => member.status === "trial").length}
              </p>
              <p className="text-muted text-sm">Trial members are the clearest short-term conversion queue.</p>
            </Card.Content>
          </Card>
        </div>
      </PageSection>

      <PageSection
        title="Member messaging"
        description="Keep the outbound copy anchored to actual supply and member state."
      >
        <Card className="rounded-2xl border-border/80 bg-surface-secondary">
          <Card.Content className="space-y-2">
            <p className="text-sm leading-6">{snapshot.notificationPreview}</p>
          </Card.Content>
        </Card>
      </PageSection>
    </div>
  );

  const settingsContent = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <PageSection title="Settings" description="Locations, runtime state, staff, and legal readiness.">
        <div className="grid content-start gap-3">
          <Segment
            className="w-full max-w-[28rem]"
            selectedKey={settingsView}
            size="sm"
            onSelectionChange={(key) => setSettingsView(String(key) as typeof settingsView)}
          >
            <Segment.Item id="ops">Operations</Segment.Item>
            <Segment.Item id="team">Team</Segment.Item>
            <Segment.Item id="legal">Legal</Segment.Item>
          </Segment>

          {settingsView === "ops" ? (
            <div className="grid gap-3">
              {snapshot.locations.map((location) => (
                <Card key={location.id} className="rounded-2xl border-border/80">
                  <Card.Content className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium">{location.name}</p>
                      <Chip size="sm" variant="tertiary">
                        {location.status}
                      </Chip>
                    </div>
                    <p className="text-muted text-sm">
                      {location.city} · {location.neighborhood} · {location.capacity} capacity
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {location.amenities.map((amenity) => (
                        <Chip key={amenity} size="sm" variant="tertiary">
                          {amenity}
                        </Chip>
                      ))}
                    </div>
                  </Card.Content>
                </Card>
              ))}
            </div>
          ) : settingsView === "team" ? (
            snapshot.staff.length > 0 ? (
              <ListView aria-label="Team accounts" items={snapshot.staff}>
                {(member) => (
                  <ListView.Item id={member.id} textValue={member.displayName}>
                    <ListView.ItemContent>
                      <ListView.Title>{member.displayName}</ListView.Title>
                      <ListView.Description>
                        {member.email} · {member.roles.join(", ")}
                      </ListView.Description>
                    </ListView.ItemContent>
                    <Users className="text-muted h-4 w-4" />
                  </ListView.Item>
                )}
              </ListView>
            ) : (
              <EmptyPanel title="No staff accounts" description="Invite the rest of the floor team when the workspace is ready." />
            )
          ) : (
            <div className="grid gap-3">
              <Card className="rounded-2xl border-border/80 bg-surface-secondary">
                <Card.Content className="space-y-2">
                  <p className="font-medium">Terms</p>
                  <p className="text-muted text-sm">{snapshot.legal.termsUrl}</p>
                </Card.Content>
              </Card>
              <Card className="rounded-2xl border-border/80 bg-surface-secondary">
                <Card.Content className="space-y-2">
                  <p className="font-medium">Privacy</p>
                  <p className="text-muted text-sm">{snapshot.legal.privacyUrl}</p>
                </Card.Content>
              </Card>
              <Card className="rounded-2xl border-border/80 bg-surface-secondary">
                <Card.Content className="space-y-2">
                  <p className="font-medium">Waiver storage</p>
                  <p className="text-muted text-sm">
                    {snapshot.legal.waiverStorageKey} · {snapshot.legal.waiverRetentionMonths} months
                  </p>
                </Card.Content>
              </Card>
            </div>
          )}
        </div>
      </PageSection>

      <PlatformWorkbench
        sections={["locations", "trainers", "staff", "legal"]}
        showLaunchHeader={false}
        snapshot={snapshot}
      />
    </div>
  );

  switch (currentPage) {
    case "classes":
      return classesContent;
    case "members":
      return membersContent;
    case "contracts":
      return contractsContent;
    case "access":
      return accessContent;
    case "payments":
      return paymentsContent;
    case "marketing":
      return marketingContent;
    case "settings":
      return settingsContent;
    default:
      return overviewContent;
  }
}
