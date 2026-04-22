"use client";

import Link from "next/link";
import { useState } from "react";
import { AttendanceButton } from "@/components/AttendanceButton";
import { BookingManagementView } from "@/components/BookingManagementView";
import { DashboardEntityActions } from "@/components/DashboardEntityActions";
import { PlatformWorkbench } from "@/components/PlatformWorkbench";
import { filterManagementRecords } from "@/lib/dashboard-management";
import { getDashboardPageLayout } from "@/lib/dashboard-page-layout";
import { getDashboardPages, type DashboardPageKey } from "@/lib/dashboard-pages";
import { getMembershipBillingCycleLabel } from "@/lib/memberships";
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

function formatCurrency(value: number, currency = "EUR") {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const offsetMilliseconds = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMilliseconds).toISOString().slice(0, 16);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function statusClass(status: string) {
  if (["active", "confirmed", "checked_in", "healthy", "configured"].includes(status)) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (["waitlisted", "trial", "degraded", "attention", "requested"].includes(status)) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  return "border-white/10 bg-white/[0.04] text-white/50";
}

function MetricCard({
  label,
  value,
  helper,
  trend,
}: {
  label: string;
  value: string;
  helper: string;
  trend?: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-white/40">{label}</p>
        {trend ? (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            {trend}
          </span>
        ) : null}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-white/40">{helper}</p>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-white/40">{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] p-5 text-sm leading-6 text-white/45">
      {children}
    </div>
  );
}

function ManagementToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  filterLabel,
  options,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  filterLabel: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
      <label className="text-sm font-medium text-white/55">
        Zoeken
        <input
          className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-400"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Zoek op naam, mail, locatie, tag..."
        />
      </label>
      <label className="text-sm font-medium text-white/55">
        {filterLabel}
        <select
          className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none focus:border-orange-400"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        >
          <option value="all">Alles</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function GymDashboard({
  snapshot,
  currentPage = "overview",
}: {
  snapshot: GymDashboardSnapshot;
  currentPage?: DashboardPageKey;
}) {
  const [memberQuery, setMemberQuery] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("all");
  const [contractQuery, setContractQuery] = useState("");
  const [contractStatusFilter, setContractStatusFilter] = useState("all");
  const [classQuery, setClassQuery] = useState("");
  const [classStatusFilter, setClassStatusFilter] = useState("all");
  const [settingsQuery, setSettingsQuery] = useState("");
  const [settingsStatusFilter, setSettingsStatusFilter] = useState("all");
  const planById = new Map(snapshot.membershipPlans.map((plan) => [plan.id, plan]));
  const locationById = new Map(snapshot.locations.map((location) => [location.id, location]));
  const trainerById = new Map(snapshot.trainers.map((trainer) => [trainer.id, trainer]));
  const classById = new Map(snapshot.classSessions.map((classSession) => [classSession.id, classSession]));
  const upcomingSessions = [...snapshot.classSessions].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  );
  const activeMembers = snapshot.members.filter((member) => member.status === "active");
  const pendingWaivers = snapshot.waivers.filter((waiver) => waiver.status !== "signed");
  const confirmedBookings = snapshot.bookings.filter(
    (booking) => booking.status === "confirmed" || booking.status === "checked_in",
  );
  const waitlistedBookings = snapshot.bookings.filter((booking) => booking.status === "waitlisted");
  const openHealthChecks = snapshot.healthReport.checks.filter((check) => check.status !== "healthy");
  const dashboardPages = getDashboardPages({
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
  });
  const pageLayout = getDashboardPageLayout(currentPage);

  const totalCapacity = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.capacity,
    0,
  );
  const occupancy = totalCapacity === 0
    ? 0
    : Math.round((confirmedBookings.length / totalCapacity) * 100);
  const filteredMembers = filterManagementRecords(snapshot.members, {
    query: memberQuery,
    searchKeys: ["fullName", "email", "phone", "tags"],
    filterKey: "status",
    filterValue: memberStatusFilter,
  });
  const filteredPlans = filterManagementRecords(snapshot.membershipPlans, {
    query: contractQuery,
    searchKeys: ["name", "billingCycle", "perks"],
    filterKey: "status",
    filterValue: contractStatusFilter,
  });
  const filteredClasses = filterManagementRecords(snapshot.classSessions, {
    query: classQuery,
    searchKeys: ["title", "focus", "level"],
    filterKey: "status",
    filterValue: classStatusFilter,
  });
  const filteredLocations = filterManagementRecords(snapshot.locations, {
    query: settingsQuery,
    searchKeys: ["name", "city", "neighborhood", "managerName", "amenities"],
    filterKey: "status",
    filterValue: settingsStatusFilter,
  });
  const filteredTrainers = filterManagementRecords(snapshot.trainers, {
    query: settingsQuery,
    searchKeys: ["fullName", "specialties", "certifications"],
    filterKey: "status",
    filterValue: settingsStatusFilter,
  });
  const filteredStaff = filterManagementRecords(snapshot.staff, {
    query: settingsQuery,
    searchKeys: ["displayName", "email", "roles"],
    filterKey: "status",
    filterValue: settingsStatusFilter,
  });

  return (
    <div className="space-y-6 p-5 lg:p-8">
      {pageLayout.showOverviewCards ? (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Active members"
              value={String(activeMembers.length)}
              helper={`${snapshot.members.length} leden totaal in deze gym`}
              trend={activeMembers.length > 0 ? "Live" : undefined}
            />
            <MetricCard
              label="Classes"
              value={String(snapshot.classSessions.length)}
              helper={`${confirmedBookings.length} bevestigde reserveringen`}
              trend={`${occupancy}% bezet`}
            />
            <MetricCard
              label="Revenue MTD"
              value={snapshot.projectedRevenueLabel}
              helper="Gebaseerd op actieve contracten"
              trend={snapshot.membershipPlans.length > 0 ? "Projected" : undefined}
            />
            <MetricCard
              label="Attention"
              value={String(pendingWaivers.length + waitlistedBookings.length + openHealthChecks.length)}
              helper="Waivers, wachtlijst en owner checks"
            />
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            {dashboardPages.map((page) => (
              <Link
                key={page.key}
                href={page.href}
                className={`glass-card-hover p-4 ${
                  currentPage === page.key ? "border-orange-500/40 bg-orange-500/10" : ""
                }`}
              >
                <p className="text-sm font-medium text-white">{page.title}</p>
                <p className="mt-2 text-2xl font-bold text-white">{page.value}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/40">{page.helper}</p>
              </Link>
            ))}
          </section>
        </>
      ) : null}

      {currentPage === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <section className="glass-card p-6">
            <SectionHeader
              title="Today's schedule"
              description="Echte lessen uit je gym, inclusief capaciteit en coach."
              action={<Link href="/dashboard/classes" className="gym-os-button-secondary">View all</Link>}
            />
            <div className="space-y-3">
              {upcomingSessions.length > 0 ? (
                upcomingSessions.slice(0, 5).map((classSession) => (
                  <div key={classSession.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="min-w-[86px] text-sm font-semibold text-orange-300">
                          {formatDateTime(classSession.startsAt)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{classSession.title}</p>
                          <p className="mt-1 text-sm text-white/40">
                            {trainerById.get(classSession.trainerId)?.fullName ?? "Trainer"} ·{" "}
                            {locationById.get(classSession.locationId)?.name ?? "Locatie"} · {classSession.focus}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-white/60">
                          {classSession.bookedCount}/{classSession.capacity}
                        </span>
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                            style={{
                              width: `${Math.min(100, (classSession.bookedCount / classSession.capacity) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState>Plan je eerste class om je rooster, bookingflow en dashboard te activeren.</EmptyState>
              )}
            </div>
          </section>

          <section className="glass-card p-6">
            <SectionHeader
              title="Recent bookings"
              description="Laatste reserveringen en check-in acties."
            />
            <div className="space-y-3">
              {snapshot.bookings.slice(0, 5).map((booking) => (
                <div key={booking.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{booking.memberName}</p>
                      <p className="mt-1 text-sm text-white/40">
                        {classById.get(booking.classSessionId)?.title ?? "Class"} · {booking.source}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {snapshot.uiCapabilities.canRecordAttendance && booking.status === "confirmed" ? (
                        <AttendanceButton bookingId={booking.id} expectedVersion={booking.version} />
                      ) : null}
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {snapshot.bookings.length === 0 ? (
                <EmptyState>Nog geen reserveringen. Open de publieke bookingflow en maak de eerste boeking.</EmptyState>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {currentPage === "classes" ? (
        <div id="classes-workbench" className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="glass-card p-6">
            <SectionHeader
              title="Class schedule"
              description="Rooster en reserveringen zijn gekoppeld aan echte data."
            />
            <ManagementToolbar
              query={classQuery}
              onQueryChange={setClassQuery}
              filter={classStatusFilter}
              onFilterChange={setClassStatusFilter}
              filterLabel="Lesstatus"
              options={[
                { value: "active", label: "Actief" },
                { value: "paused", label: "Gepauzeerd" },
                { value: "archived", label: "Gearchiveerd" },
              ]}
            />
            <div className="mb-6 space-y-3">
              {filteredClasses.map((classSession) => (
                <div key={classSession.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium text-white">{classSession.title}</p>
                      <p className="mt-1 text-sm text-white/40">
                        {formatDateTime(classSession.startsAt)} · {trainerById.get(classSession.trainerId)?.fullName ?? "Trainer"} · {locationById.get(classSession.locationId)?.name ?? "Locatie"}
                      </p>
                      <p className="mt-1 text-sm text-white/45">{classSession.focus}</p>
                    </div>
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(classSession.status)}`}>
                      {classSession.status}
                    </span>
                  </div>
                  <DashboardEntityActions
                    endpoint="/api/platform/classes"
                    entityLabel="Les"
                    updatePayloadBase={{
                      id: classSession.id,
                      expectedVersion: classSession.version,
                    }}
                    archivePayload={{
                      id: classSession.id,
                      expectedVersion: classSession.version,
                    }}
                    deletePayload={{
                      id: classSession.id,
                      expectedVersion: classSession.version,
                    }}
                    fields={[
                      { name: "title", label: "Titel", defaultValue: classSession.title },
                      { name: "startsAt", label: "Start", defaultValue: toLocalDateTimeInput(classSession.startsAt), type: "datetime-local" },
                      { name: "locationId", label: "Vestiging", defaultValue: classSession.locationId, type: "select", options: snapshot.locations.map((location) => ({ value: location.id, label: location.name })) },
                      { name: "trainerId", label: "Trainer", defaultValue: classSession.trainerId, type: "select", options: snapshot.trainers.map((trainer) => ({ value: trainer.id, label: trainer.fullName })) },
                      { name: "durationMinutes", label: "Duur", defaultValue: classSession.durationMinutes, type: "number" },
                      { name: "capacity", label: "Capaciteit", defaultValue: classSession.capacity, type: "number" },
                      { name: "level", label: "Niveau", defaultValue: classSession.level, type: "select", options: [{ value: "beginner", label: "Beginner" }, { value: "mixed", label: "Mixed" }, { value: "advanced", label: "Advanced" }] },
                      { name: "status", label: "Status", defaultValue: classSession.status, type: "select", options: [{ value: "active", label: "Actief" }, { value: "paused", label: "Gepauzeerd" }, { value: "archived", label: "Gearchiveerd" }] },
                      { name: "focus", label: "Focus", defaultValue: classSession.focus, type: "textarea" },
                    ]}
                  />
                </div>
              ))}
              {filteredClasses.length === 0 ? <EmptyState>Geen lessen gevonden met deze zoek/filtercombinatie.</EmptyState> : null}
            </div>
            <BookingManagementView snapshot={snapshot} />
          </section>
          <section className="glass-card p-6">
            <SectionHeader title="Nieuwe class" description="Plan lessen, capaciteit en trainers." />
            <PlatformWorkbench snapshot={snapshot} sections={["classes"]} showLaunchHeader={false} />
          </section>
        </div>
      ) : null}

      {currentPage === "members" ? (
        <div id="members-workbench" className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="glass-card overflow-hidden">
            <div className="p-6">
              <SectionHeader title="Members" description="Actieve leden, contracten, waivers en status." />
              <ManagementToolbar
                query={memberQuery}
                onQueryChange={setMemberQuery}
                filter={memberStatusFilter}
                onFilterChange={setMemberStatusFilter}
                filterLabel="Lidstatus"
                options={[
                  { value: "active", label: "Actief" },
                  { value: "trial", label: "Trial" },
                  { value: "paused", label: "Gepauzeerd" },
                  { value: "archived", label: "Gearchiveerd" },
                ]}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-y border-white/[0.06]">
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/50">Member</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/50">Contract</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/50">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/50">Waiver</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/50">Beheer</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                    const plan = planById.get(member.membershipPlanId);

                    return (
                      <tr key={member.id} className="border-b border-white/[0.04]">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-white/60">
                              {initials(member.fullName)}
                            </div>
                            <div>
                              <p className="font-medium text-white">{member.fullName}</p>
                              <p className="text-sm text-white/40">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-white/60">{plan?.name ?? "Onbekend"}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(member.status)}`}>
                            {member.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-white/60">{member.waiverStatus}</td>
                        <td className="min-w-[320px] px-6 py-4">
                          <DashboardEntityActions
                            endpoint="/api/platform/members"
                            entityLabel="Lid"
                            updatePayloadBase={{
                              id: member.id,
                              expectedVersion: member.version,
                            }}
                            archivePayload={{
                              id: member.id,
                              expectedVersion: member.version,
                            }}
                            deletePayload={{
                              id: member.id,
                              expectedVersion: member.version,
                            }}
                            fields={[
                              { name: "fullName", label: "Naam", defaultValue: member.fullName },
                              { name: "email", label: "E-mail", defaultValue: member.email, type: "email" },
                              { name: "phone", label: "Telefoon", defaultValue: member.phone },
                              { name: "phoneCountry", label: "Landcode", defaultValue: member.phoneCountry },
                              { name: "membershipPlanId", label: "Contract", defaultValue: member.membershipPlanId, type: "select", options: snapshot.membershipPlans.map((membershipPlan) => ({ value: membershipPlan.id, label: membershipPlan.name })) },
                              { name: "homeLocationId", label: "Vestiging", defaultValue: member.homeLocationId, type: "select", options: snapshot.locations.map((location) => ({ value: location.id, label: location.name })) },
                              { name: "status", label: "Status", defaultValue: member.status, type: "select", options: [{ value: "active", label: "Actief" }, { value: "trial", label: "Trial" }, { value: "paused", label: "Gepauzeerd" }, { value: "archived", label: "Gearchiveerd" }] },
                              { name: "waiverStatus", label: "Waiver", defaultValue: member.waiverStatus, type: "select", options: [{ value: "pending", label: "Nog open" }, { value: "complete", label: "Rond" }] },
                              { name: "tags", label: "Tags", defaultValue: member.tags, type: "list" },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredMembers.length === 0 ? (
              <div className="p-6">
                <EmptyState>Geen leden gevonden. Pas je zoekterm/filter aan of voeg een lid toe.</EmptyState>
              </div>
            ) : null}
          </section>
          <section className="glass-card p-6">
            <SectionHeader title="Member acties" description="Nieuwe leden worden direct functioneel opgeslagen." />
            <PlatformWorkbench snapshot={snapshot} sections={["members"]} showLaunchHeader={false} />
          </section>
        </div>
      ) : null}

      {currentPage === "contracts" ? (
        <div id="contracts-workbench" className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="glass-card p-6">
            <SectionHeader title="Contracts" description="Maand, 6 maanden en jaarcontracten." />
            <ManagementToolbar
              query={contractQuery}
              onQueryChange={setContractQuery}
              filter={contractStatusFilter}
              onFilterChange={setContractStatusFilter}
              filterLabel="Contractstatus"
              options={[
                { value: "active", label: "Actief" },
                { value: "paused", label: "Gepauzeerd" },
                { value: "archived", label: "Gearchiveerd" },
              ]}
            />
            <div className="space-y-3">
              {filteredPlans.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">{plan.name}</p>
                      <p className="mt-1 text-sm text-white/40">
                        {getMembershipBillingCycleLabel(plan.billingCycle)} · {plan.activeMembers} actieve leden
                      </p>
                    </div>
                    <div className="space-y-2 text-right">
                      <p className="font-semibold text-orange-300">{formatCurrency(plan.priceMonthly, plan.currency)}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(plan.status)}`}>
                        {plan.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-white/45">{plan.perks.join(" · ")}</p>
                  <DashboardEntityActions
                    endpoint="/api/platform/membership-plans"
                    entityLabel="Contract"
                    updatePayloadBase={{
                      id: plan.id,
                      expectedVersion: plan.version,
                    }}
                    archivePayload={{
                      id: plan.id,
                      expectedVersion: plan.version,
                    }}
                    deletePayload={{
                      id: plan.id,
                      expectedVersion: plan.version,
                    }}
                    fields={[
                      { name: "name", label: "Naam", defaultValue: plan.name },
                      { name: "priceMonthly", label: "Prijs per maand", defaultValue: plan.priceMonthly, type: "number" },
                      { name: "billingCycle", label: "Contractduur", defaultValue: plan.billingCycle, type: "select", options: [{ value: "monthly", label: "Maand" }, { value: "semiannual", label: "6 maanden" }, { value: "annual", label: "Jaar" }] },
                      { name: "status", label: "Status", defaultValue: plan.status, type: "select", options: [{ value: "active", label: "Actief" }, { value: "paused", label: "Gepauzeerd" }, { value: "archived", label: "Gearchiveerd" }] },
                      { name: "perks", label: "Voordelen", defaultValue: plan.perks, type: "list" },
                    ]}
                  />
                </div>
              ))}
              {filteredPlans.length === 0 ? <EmptyState>Geen contracten gevonden met deze zoek/filtercombinatie.</EmptyState> : null}
            </div>
          </section>
          <section className="glass-card p-6">
            <SectionHeader title="Contracten & import" description="Maak contracten en importeer bestaande klanten." />
            <PlatformWorkbench snapshot={snapshot} sections={["contracts", "imports"]} showLaunchHeader={false} />
          </section>
        </div>
      ) : null}

      {currentPage === "access" ? (
        <section id="access-workbench" className="glass-card p-6">
          <SectionHeader title="Access Control" description="Smart lock instellingen en remote open preview." />
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <MetricCard label="Provider" value={snapshot.remoteAccess.providerLabel} helper={snapshot.remoteAccess.helpText} />
            <MetricCard label="Status" value={snapshot.remoteAccess.statusLabel} helper={snapshot.remoteAccess.deviceLabel || "Nog geen device label"} />
            <MetricCard label="Laatste actie" value={snapshot.remoteAccess.lastRemoteActionAt ? formatDateTime(snapshot.remoteAccess.lastRemoteActionAt) : "Nog geen"} helper={snapshot.remoteAccess.lastRemoteActionBy ?? "Owner-only"} />
          </div>
          <PlatformWorkbench snapshot={snapshot} sections={["remote-access"]} showLaunchHeader={false} />
        </section>
      ) : null}

      {currentPage === "payments" ? (
        <section id="payments-workbench" className="glass-card p-6">
          <SectionHeader title="Payments" description="Mollie incasso, eenmalige betalingen en Tikkie-achtige betaalverzoeken." />
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <MetricCard label="Provider" value={snapshot.payments.providerLabel} helper={snapshot.payments.helpText} />
            <MetricCard label="Status" value={snapshot.payments.statusLabel} helper={snapshot.payments.profileLabel || "Nog geen profiel"} />
            <MetricCard label="Methodes" value={String(snapshot.payments.paymentMethods.length)} helper={snapshot.payments.paymentMethods.join(" · ") || "Nog niet gekozen"} />
          </div>
          <PlatformWorkbench snapshot={snapshot} sections={["payments"]} showLaunchHeader={false} />
        </section>
      ) : null}

      {currentPage === "marketing" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="glass-card p-6">
            <SectionHeader title="Growth segments" description="Geen fake campagnes: segmenten worden afgeleid uit je echte leden en reserveringen." />
            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard label="Actieve leden" value={String(activeMembers.length)} helper="Segment voor retentie en upsell" />
              <MetricCard label="Wachtlijst" value={String(waitlistedBookings.length)} helper="Urgentie en class demand" />
              <MetricCard label="Open waivers" value={String(pendingWaivers.length)} helper="Onboarding nudges" />
              <MetricCard label="Bookings" value={String(snapshot.bookings.length)} helper="Terugkeer- en reminderflow" />
            </div>
          </section>
          <section className="glass-card p-6">
            <SectionHeader title="Message preview" description="Preview op basis van de bestaande notification-renderer." />
            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-5 text-sm leading-7 text-orange-100">
              {snapshot.notificationPreview}
            </div>
            <Link href={`/reserve?gym=${snapshot.tenantName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="gym-os-button mt-5">
              Bekijk member experience
            </Link>
          </section>
        </div>
      ) : null}

      {currentPage === "settings" ? (
        <div id="settings-workbench" className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="glass-card p-6">
            <SectionHeader title="Settings overview" description="Vestigingen, personeel, platformstatus en imports." />
            <ManagementToolbar
              query={settingsQuery}
              onQueryChange={setSettingsQuery}
              filter={settingsStatusFilter}
              onFilterChange={setSettingsStatusFilter}
              filterLabel="Status"
              options={[
                { value: "active", label: "Actief" },
                { value: "away", label: "Afwezig" },
                { value: "paused", label: "Gepauzeerd" },
                { value: "archived", label: "Gearchiveerd" },
              ]}
            />
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <MetricCard label="Vestigingen" value={String(snapshot.locations.length)} helper="Locaties met capaciteit en manager" />
                <MetricCard label="Team" value={String(snapshot.staff.length)} helper="Owner, manager, trainer en frontdesk" />
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-white">Vestigingen beheren</h3>
                {filteredLocations.map((location) => (
                  <div key={location.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{location.name}</p>
                        <p className="mt-1 text-sm text-white/45">{location.city} · {location.neighborhood} · manager {location.managerName}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(location.status)}`}>{location.status}</span>
                    </div>
                    <DashboardEntityActions
                      endpoint="/api/platform/locations"
                      entityLabel="Vestiging"
                      updatePayloadBase={{ id: location.id, expectedVersion: location.version }}
                      archivePayload={{ id: location.id, expectedVersion: location.version }}
                      deletePayload={{ id: location.id, expectedVersion: location.version }}
                      fields={[
                        { name: "name", label: "Naam", defaultValue: location.name },
                        { name: "managerName", label: "Manager", defaultValue: location.managerName },
                        { name: "city", label: "Stad", defaultValue: location.city },
                        { name: "neighborhood", label: "Wijk", defaultValue: location.neighborhood },
                        { name: "capacity", label: "Capaciteit", defaultValue: location.capacity, type: "number" },
                        { name: "status", label: "Status", defaultValue: location.status, type: "select", options: [{ value: "active", label: "Actief" }, { value: "paused", label: "Gepauzeerd" }, { value: "archived", label: "Gearchiveerd" }] },
                        { name: "amenities", label: "Faciliteiten", defaultValue: location.amenities, type: "list" },
                      ]}
                    />
                  </div>
                ))}
                {filteredLocations.length === 0 ? <EmptyState>Geen vestigingen gevonden.</EmptyState> : null}
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-white">Trainers beheren</h3>
                {filteredTrainers.map((trainer) => (
                  <div key={trainer.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{trainer.fullName}</p>
                        <p className="mt-1 text-sm text-white/45">{locationById.get(trainer.homeLocationId)?.name ?? "Vestiging"} · {trainer.specialties.join(", ") || "Geen specialisaties"}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(trainer.status)}`}>{trainer.status}</span>
                    </div>
                    <DashboardEntityActions
                      endpoint="/api/platform/trainers"
                      entityLabel="Trainer"
                      updatePayloadBase={{ id: trainer.id, expectedVersion: trainer.version }}
                      archivePayload={{ id: trainer.id, expectedVersion: trainer.version }}
                      deletePayload={{ id: trainer.id, expectedVersion: trainer.version }}
                      fields={[
                        { name: "fullName", label: "Naam", defaultValue: trainer.fullName },
                        { name: "homeLocationId", label: "Thuisvestiging", defaultValue: trainer.homeLocationId, type: "select", options: snapshot.locations.map((location) => ({ value: location.id, label: location.name })) },
                        { name: "status", label: "Status", defaultValue: trainer.status, type: "select", options: [{ value: "active", label: "Actief" }, { value: "away", label: "Afwezig" }, { value: "archived", label: "Gearchiveerd" }] },
                        { name: "specialties", label: "Specialisaties", defaultValue: trainer.specialties, type: "list" },
                        { name: "certifications", label: "Certificeringen", defaultValue: trainer.certifications, type: "list" },
                      ]}
                    />
                  </div>
                ))}
                {filteredTrainers.length === 0 ? <EmptyState>Geen trainers gevonden.</EmptyState> : null}
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-white">Personeel beheren</h3>
                {filteredStaff.map((staff) => (
                  <div key={staff.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{staff.displayName}</p>
                        <p className="mt-1 text-sm text-white/45">{staff.email} · {(staff.roleKey ?? staff.roles[0] ?? "frontdesk").toString()}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(staff.status)}`}>{staff.status}</span>
                    </div>
                    {staff.updatedAt ? (
                      <DashboardEntityActions
                        endpoint="/api/platform/staff"
                        entityLabel="Teamlid"
                        updatePayloadBase={{ userId: staff.id, expectedUpdatedAt: staff.updatedAt }}
                        archivePayload={{ userId: staff.id, expectedUpdatedAt: staff.updatedAt }}
                        deletePayload={{ userId: staff.id, expectedUpdatedAt: staff.updatedAt }}
                        fields={[
                          { name: "displayName", label: "Naam", defaultValue: staff.displayName },
                          { name: "email", label: "E-mail", defaultValue: staff.email, type: "email" },
                          { name: "roleKey", label: "Rol", defaultValue: staff.roleKey ?? "frontdesk", type: "select", options: [{ value: "owner", label: "Owner" }, { value: "manager", label: "Manager" }, { value: "trainer", label: "Trainer" }, { value: "frontdesk", label: "Frontdesk" }] },
                          { name: "status", label: "Status", defaultValue: staff.status === "archived" ? "archived" : "active", type: "select", options: [{ value: "active", label: "Actief" }, { value: "archived", label: "Gearchiveerd" }] },
                        ]}
                      />
                    ) : null}
                  </div>
                ))}
                {filteredStaff.length === 0 ? <EmptyState>Geen teamleden gevonden.</EmptyState> : null}
              </div>
              <div className="space-y-3">
                {snapshot.healthReport.checks.map((check) => (
                  <div key={check.name} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{check.name}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(check.status)}`}>
                        {check.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/45">{check.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="glass-card p-6">
            <SectionHeader title="Owner beheer" description="Alles op aparte pagina, geen tabs." />
            <PlatformWorkbench
              snapshot={snapshot}
              sections={["locations", "trainers", "staff", "imports", "legal"]}
              showLaunchHeader={false}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
