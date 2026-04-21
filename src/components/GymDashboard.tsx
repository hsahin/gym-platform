"use client";

import Link from "next/link";
import { formatPhoneForDisplay } from "@claimtech/i18n";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CurrencyValue,
} from "@claimtech/ui";
import { AttendanceButton } from "@/components/AttendanceButton";
import { BookingDialog } from "@/components/BookingDialog";
import { BookingManagementView } from "@/components/BookingManagementView";
import { ClassSessionView } from "@/components/ClassSessionView";
import { DashboardLiveSync } from "@/components/DashboardLiveSync";
import { LocationView } from "@/components/LocationView";
import { MemberView } from "@/components/MemberView";
import { PlatformWorkbench } from "@/components/PlatformWorkbench";
import { getDashboardExperience } from "@/lib/dashboard-experience";
import {
  getDashboardPageForWorkbenchStep,
  getDashboardPageHref,
  getDashboardPages,
  type DashboardPageKey,
} from "@/lib/dashboard-pages";
import { getMembershipBillingCycleLabel } from "@/lib/memberships";
import type { GymDashboardSnapshot } from "@/server/types";

function formatSessionMoment(startsAt: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(startsAt));
}

function getFeatureVariant(enabled: boolean) {
  return enabled ? "success" : "secondary";
}

function getMetricToneLabel(tone: string) {
  if (tone === "success") {
    return "Groeit gezond";
  }

  if (tone === "warning") {
    return "Aandacht gewenst";
  }

  if (tone === "info") {
    return "Live inzicht";
  }

  return "Operationeel";
}

function getBookingVariant(status: string) {
  if (status === "checked_in") {
    return "success";
  }

  if (status === "waitlisted") {
    return "warning";
  }

  return "info";
}

function getFeatureLabel(featureKey: string) {
  switch (featureKey) {
    case "bookings.waitlist":
      return "Wachtlijst";
    case "attendance.self_check_in":
      return "Self check-in";
    case "waivers.digital_upload":
      return "Digitale waivers";
    case "marketing.automations":
      return "Marketing opvolging";
    case "analytics.multi_location":
      return "Multi-locatie inzichten";
    default:
      return featureKey;
  }
}

function getAuditActionLabel(action: string) {
  switch (action) {
    case "platform.runtime_ready":
      return "Platform is klaar voor gebruik";
    case "staff.created":
      return "Teamlid toegevoegd";
    case "location.created":
      return "Vestiging toegevoegd";
    case "membership.created":
    case "membership_plan.created":
      return "Contract aangemaakt";
    case "trainer.created":
      return "Trainer toegevoegd";
    case "class.created":
    case "class_session.created":
      return "Les gepland";
    case "member.created":
      return "Lid toegevoegd";
    case "booking.created":
      return "Reservering aangemaakt";
    case "booking.cancelled":
      return "Reservering geannuleerd";
    case "attendance.recorded":
      return "Check-in geregistreerd";
    case "remote_access.updated":
      return "Remote toegang bijgewerkt";
    case "billing.updated":
      return "Betalingen bijgewerkt";
    default:
      return action.replaceAll(".", " ");
  }
}

function getAuditCategoryLabel(category: string) {
  switch (category) {
    case "system":
      return "Systeem";
    case "staff":
      return "Personeel";
    case "locations":
    case "location":
      return "Vestigingen";
    case "memberships":
    case "membership":
      return "Contracten";
    case "members":
    case "member":
      return "Leden";
    case "bookings":
    case "booking":
      return "Reserveringen";
    case "attendance":
      return "Check-ins";
    case "settings":
      return "Instellingen";
    default:
      return category;
  }
}

function getFriendlyHealthSummary(summary: string) {
  const lowerSummary = summary.toLowerCase();

  if (lowerSummary.includes("redis") || lowerSummary.includes("cache")) {
    return "Je dashboard draait soepel voor de launch. Bij hogere drukte kan performance later worden opgeschaald.";
  }

  if (lowerSummary.includes("mongo") || lowerSummary.includes("database")) {
    return "Je dataopslag is klaar voor leden, contracten, reserveringen en teambeheer.";
  }

  if (
    lowerSummary.includes("waha") ||
    lowerSummary.includes("whatsapp") ||
    lowerSummary.includes("messaging")
  ) {
    return "Berichten zijn voorbereid voor bevestigingen en opvolging richting leden.";
  }

  if (lowerSummary.includes("spaces") || lowerSummary.includes("storage")) {
    return "Documenten en uploads zijn voorbereid voor waivers en ledenbestanden.";
  }

  return summary;
}

export function GymDashboard({
  snapshot,
  currentPage = "overview",
}: {
  snapshot: GymDashboardSnapshot;
  currentPage?: DashboardPageKey;
}) {
  const planById = new Map(
    snapshot.membershipPlans.map((plan) => [plan.id, plan] as const),
  );
  const locationById = new Map(
    snapshot.locations.map((location) => [location.id, location] as const),
  );
  const trainerById = new Map(
    snapshot.trainers.map((trainer) => [trainer.id, trainer] as const),
  );

  const upcomingSessions = [...snapshot.classSessions].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  );
  const nextSession = upcomingSessions[0];
  const pendingWaivers = snapshot.waivers.filter(
    (waiver) => waiver.status !== "signed",
  );
  const openChecks = snapshot.healthReport.checks.filter(
    (check) => check.status !== "healthy",
  );
  const highlightedMembers = [...snapshot.members].sort((left, right) => {
    const priorityFor = (member: (typeof snapshot.members)[number]) =>
      (member.waiverStatus !== "complete" ? 2 : 0) +
      (member.status !== "active" ? 1 : 0);

    return (
      priorityFor(right) - priorityFor(left) ||
      left.fullName.localeCompare(right.fullName)
    );
  });
  const recentBookings = snapshot.bookings.slice(0, 4);
  const confirmedBookings = snapshot.bookings.filter(
    (booking) => booking.status === "confirmed" || booking.status === "checked_in",
  );
  const waitlistedBookings = snapshot.bookings.filter(
    (booking) => booking.status === "waitlisted",
  );
  const activeMembers = snapshot.members.filter(
    (member) => member.status === "active",
  );
  const dashboardExperience = getDashboardExperience({
    locationsCount: snapshot.locations.length,
    membershipPlansCount: snapshot.membershipPlans.length,
    trainersCount: snapshot.trainers.length,
    membersCount: snapshot.members.length,
    classSessionsCount: snapshot.classSessions.length,
    bookingsCount: snapshot.bookings.length,
    healthAttentionCount: openChecks.length,
  });
  const dashboardPages = getDashboardPages({
    locationsCount: snapshot.locations.length,
    membershipPlansCount: snapshot.membershipPlans.length,
    trainersCount: snapshot.trainers.length,
    membersCount: snapshot.members.length,
    classSessionsCount: snapshot.classSessions.length,
    bookingsCount: snapshot.bookings.length,
    staffCount: snapshot.staff.length,
    healthAttentionCount: openChecks.length,
    paymentsStatusLabel: snapshot.payments.statusLabel,
    remoteAccessStatusLabel: snapshot.remoteAccess.statusLabel,
    canManagePayments: snapshot.uiCapabilities.canManagePayments,
    canManageRemoteAccess: snapshot.uiCapabilities.canManageRemoteAccess,
    canManageStaff: snapshot.uiCapabilities.canManageStaff,
  });
  const currentPageDetails =
    dashboardPages.find((page) => page.key === currentPage) ?? dashboardPages[0]!;

  const pageContent = {
    overview: (
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-slate-950">
              Planning vandaag
            </h3>
            <p className="text-sm leading-6 text-slate-600">
              De eerstvolgende lessen met bezetting, coach en locatie.
            </p>
          </div>

          {upcomingSessions.length > 0 ? (
            upcomingSessions.map((classSession) => (
              <ClassSessionView
                key={classSession.id}
                classSession={classSession}
                trainerName={trainerById.get(classSession.trainerId)?.fullName}
                locationName={locationById.get(classSession.locationId)?.name}
              />
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
              Nog geen lessen ingepland. Open Rooster om je eerste les toe te voegen.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <Card className="border-slate-200/80 bg-white/80">
            <CardHeader>
              <CardTitle className="text-lg">Open acties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingWaivers.length > 0 ? (
                pendingWaivers.map((waiver) => (
                  <div key={waiver.id} className="soft-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {waiver.memberName}
                        </p>
                        <p className="text-sm text-slate-600">
                          {waiver.fileName ?? "Nog geen upload ontvangen"}
                        </p>
                      </div>
                      <Badge variant="warning">{waiver.status}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                  Geen open acties. Alle waivers zijn afgerond.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/80">
            <CardHeader>
              <CardTitle className="text-lg">Laatste reserveringen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentBookings.length > 0 ? (
                recentBookings.map((booking) => {
                  const classSession = snapshot.classSessions.find(
                    (entry) => entry.id === booking.classSessionId,
                  );

                  return (
                    <div key={booking.id} className="soft-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">
                            {booking.memberName}
                          </p>
                          <p className="text-sm text-slate-600">
                            {classSession?.title ?? "Onbekende les"} ·{" "}
                            {formatPhoneForDisplay(
                              booking.phone,
                              booking.phoneCountry,
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {snapshot.uiCapabilities.canRecordAttendance &&
                          booking.status === "confirmed" ? (
                            <AttendanceButton
                              bookingId={booking.id}
                              expectedVersion={booking.version}
                            />
                          ) : null}
                          <Badge variant={getBookingVariant(booking.status)}>
                            {booking.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                  Nog geen reserveringen. Zodra leden boeken, zie je ze hier direct.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    ),
    reservations: <BookingManagementView snapshot={snapshot} />,
    members: (
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-slate-950">
                Leden die aandacht vragen
              </h3>
              <p className="text-sm leading-6 text-slate-600">
                Trialleden, open waivers en gepauzeerde leden komen automatisch bovenaan.
              </p>
            </div>

            {highlightedMembers.length > 0 ? (
              highlightedMembers.map((member) => (
                <MemberView
                  key={member.id}
                  member={member}
                  plan={planById.get(member.membershipPlanId)}
                  homeLocationName={locationById.get(member.homeLocationId)?.name}
                />
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                Nog geen leden. Voeg leden toe of importeer bestaande klanten.
              </p>
            )}
          </div>

          <Card className="border-slate-200/80 bg-white/80">
            <CardHeader>
              <CardTitle className="text-lg">Ledenfacts</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="soft-card p-4">
                <p className="text-sm text-slate-500">Actief</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {activeMembers.length}
                </p>
              </div>
              <div className="soft-card p-4">
                <p className="text-sm text-slate-500">Open waivers</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {pendingWaivers.length}
                </p>
              </div>
              <div className="soft-card p-4">
                <p className="text-sm text-slate-500">Contracttypes</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {snapshot.membershipPlans.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <PlatformWorkbench
          snapshot={snapshot}
          sections={["members"]}
          showLaunchHeader={false}
        />
      </div>
    ),
    contracts: (
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-slate-200/80 bg-white/80">
          <CardHeader>
            <CardTitle className="text-lg">Actieve contracten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.membershipPlans.length > 0 ? (
              snapshot.membershipPlans.map((plan) => (
                <div key={plan.id} className="soft-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{plan.name}</p>
                      <p className="text-sm text-slate-600">
                        {plan.activeMembers} actieve leden ·{" "}
                        {getMembershipBillingCycleLabel(plan.billingCycle)}
                      </p>
                    </div>
                    <CurrencyValue
                      amount={plan.priceMonthly}
                      currency={plan.currency}
                      language="nl"
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {plan.perks.join(" · ")}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                Nog geen contracten. Maak een maand-, halfjaar- of jaarcontract aan.
              </p>
            )}
          </CardContent>
        </Card>

        <PlatformWorkbench
          snapshot={snapshot}
          sections={["contracts"]}
          showLaunchHeader={false}
        />
      </div>
    ),
    schedule: (
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          {upcomingSessions.length > 0 ? (
            upcomingSessions.map((classSession) => (
              <ClassSessionView
                key={classSession.id}
                classSession={classSession}
                trainerName={trainerById.get(classSession.trainerId)?.fullName}
                locationName={locationById.get(classSession.locationId)?.name}
              />
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
              Nog geen lessen. Voeg eerst een vestiging en trainer toe.
            </p>
          )}
        </div>

        <PlatformWorkbench
          snapshot={snapshot}
          sections={["classes"]}
          showLaunchHeader={false}
        />
      </div>
    ),
    locations: (
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          {snapshot.locations.length > 0 ? (
            snapshot.locations.map((location) => (
              <LocationView key={location.id} location={location} />
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
              Nog geen vestigingen. Voeg hier je eerste gym-locatie toe.
            </p>
          )}
        </div>

        <PlatformWorkbench
          snapshot={snapshot}
          sections={["locations"]}
          showLaunchHeader={false}
        />
      </div>
    ),
    staff: (
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-slate-200/80 bg-white/80">
          <CardHeader>
            <CardTitle className="text-lg">Teamaccounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.staff.length > 0 ? (
              snapshot.staff.map((staff) => (
                <div key={staff.id} className="soft-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {staff.displayName}
                      </p>
                      <p className="text-sm text-slate-600">{staff.email}</p>
                    </div>
                    <Badge variant="secondary">{staff.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {staff.roles.join(" · ")}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                Nog geen teamaccounts. De eigenaar kan hier rollen uitnodigen.
              </p>
            )}
          </CardContent>
        </Card>

        <PlatformWorkbench
          snapshot={snapshot}
          sections={["trainers", "staff"]}
          showLaunchHeader={false}
        />
      </div>
    ),
    payments: (
      <PlatformWorkbench
        snapshot={snapshot}
        sections={["payments"]}
        showLaunchHeader={false}
      />
    ),
    smartdoors: (
      <PlatformWorkbench
        snapshot={snapshot}
        sections={["remote-access"]}
        showLaunchHeader={false}
      />
    ),
    imports: (
      <PlatformWorkbench
        snapshot={snapshot}
        sections={["imports"]}
        showLaunchHeader={false}
      />
    ),
    status: (
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-200/80 bg-white/80">
          <CardHeader>
            <CardTitle className="text-lg">Platformstatus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                Data: {snapshot.runtime.storeMode === "mongo" ? "Live klaar" : "Launch klaar"}
              </Badge>
              <Badge variant="outline">
                Snelheid: {snapshot.runtime.cacheMode === "redis" ? "Opschaalbaar" : "Prima voor launch"}
              </Badge>
              <Badge variant="outline">
                Berichten: {snapshot.runtime.messagingMode === "preview" ? "Klaar voor test" : "Live"}
              </Badge>
              <Badge variant="outline">
                Documenten: {snapshot.runtime.storageMode === "spaces" ? "Cloud klaar" : "Launch klaar"}
              </Badge>
            </div>

            <div className="space-y-3">
              {snapshot.healthReport.checks.map((check) => (
                <div key={check.name} className="soft-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">
                      {check.name}
                    </p>
                    <Badge
                      variant={check.status === "healthy" ? "success" : "warning"}
                    >
                      {check.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {getFriendlyHealthSummary(check.summary)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/80">
          <CardHeader>
            <CardTitle className="text-lg">Modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.featureFlags.map((feature) => (
              <div key={feature.key} className="soft-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {getFeatureLabel(feature.key)}
                    </p>
                    <p className="text-sm leading-6 text-slate-600">
                      {feature.description}
                    </p>
                  </div>
                  <Badge variant={getFeatureVariant(feature.enabled)}>
                    {feature.enabled ? "Actief" : "Uit"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/80">
          <CardHeader>
            <CardTitle className="text-lg">Revenue en berichten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-semibold text-slate-950">
                {snapshot.projectedRevenueLabel}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Geprojecteerd op basis van actieve memberships in deze gym.
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50/90 p-4 text-sm leading-6 text-slate-700">
              {snapshot.notificationPreview}
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Documenten</p>
              <p>
                Waivers en ledenbestanden worden veilig aan de juiste gym en
                leden gekoppeld.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {snapshot.supportedLanguages.map((language) => (
                <Badge key={language} variant="secondary">
                  {language}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/80">
          <CardHeader>
            <CardTitle className="text-lg">Laatste gebeurtenissen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.auditEntries.map((entry) => (
              <div key={entry.eventId} className="soft-card p-4">
                <p className="font-medium text-slate-900">
                  {getAuditActionLabel(entry.action)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {getAuditCategoryLabel(entry.category)} ·{" "}
                  {entry.actorId ?? "systeem"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    ),
  } satisfies Record<DashboardPageKey, JSX.Element>;

  return (
    <div className="space-y-6">
      <DashboardLiveSync />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.metrics.map((metric) => (
          <article
            key={metric.label}
            className="dashboard-metric-card"
            data-tone={metric.tone}
          >
            <p className="eyebrow">{metric.label}</p>
            <p className="relative z-10 mt-5 text-4xl font-semibold tracking-tight text-slate-950">
              {metric.value}
            </p>
            <p className="relative z-10 mt-3 max-w-xs text-sm leading-6 text-slate-600">
              {metric.helper}
            </p>
            <div className="relative z-10 mt-5 inline-flex items-center rounded-full border border-slate-900/8 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {getMetricToneLabel(metric.tone)}
            </div>
          </article>
        ))}
      </section>

      <section className="section-shell grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="eyebrow">Owner facts</p>
            <h2 className="text-2xl font-semibold text-slate-950 md:text-3xl">
              Wat moet je vandaag weten?
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Geen configuratiecanvas maar directe bedrijfsinformatie: omzet,
              bezetting, ledenstatus, planning en risico&apos;s.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="soft-card">
              <p className="text-sm font-medium text-slate-500">Omzetindicatie</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {snapshot.projectedRevenueLabel}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Op basis van actieve contracten.
              </p>
            </div>
            <div className="soft-card">
              <p className="text-sm font-medium text-slate-500">Volgende les</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {nextSession?.title ?? "Geen les"}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {nextSession
                  ? `${formatSessionMoment(nextSession.startsAt)} · ${
                      locationById.get(nextSession.locationId)?.name ?? "Locatie onbekend"
                    }`
                  : "Plan je eerste les op de roosterpagina."}
              </p>
            </div>
            <div className="soft-card">
              <p className="text-sm font-medium text-slate-500">Boekingsdruk</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {confirmedBookings.length} / {waitlistedBookings.length}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Bevestigd versus wachtlijst.
              </p>
            </div>
            <div className="soft-card">
              <p className="text-sm font-medium text-slate-500">Open risico</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {pendingWaivers.length}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Waivers of intakes die opvolging vragen.
              </p>
            </div>
          </div>
        </div>

        <div className="command-deck">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
            Snel handelen
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-white">
            {dashboardExperience.actionTitle}
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/70">
            {dashboardExperience.actionDescription}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                Live fase
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {dashboardExperience.progressValue}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/60">
                {dashboardExperience.progressHelper}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                Ledenbasis
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {activeMembers.length} actief
              </p>
              <p className="mt-2 text-sm leading-6 text-white/60">
                {snapshot.members.length} profielen totaal.
              </p>
            </div>
          </div>

          <div className="mt-5">
            {dashboardExperience.isLaunchMode &&
            snapshot.uiCapabilities.canManagePlatform ? (
              <div className="space-y-3">
                {dashboardExperience.launchSteps.map((step, index) => {
                  const targetPage = getDashboardPageForWorkbenchStep(step.key);
                  const targetHref = getDashboardPageHref(targetPage);

                  return (
                    <div key={step.key} className="launch-step-card">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Stap {index + 1}
                          </p>
                          <p className="mt-1 font-medium text-slate-900">
                            {step.label}
                          </p>
                        </div>
                        {step.complete ? (
                          <Badge variant="success">{step.statusLabel}</Badge>
                        ) : (
                          <Link href={targetHref}>
                            <Badge variant="info">{step.statusLabel}</Badge>
                          </Link>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {step.helper}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : snapshot.uiCapabilities.canCreateBooking ? (
              <BookingDialog
                members={snapshot.members}
                classSessions={snapshot.classSessions}
              />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/6 p-4 text-sm leading-6 text-white/70">
                Deze rol kan geen nieuwe bookings aanmaken. Gebruik deze view
                voor planning, ledencontext en check-ins.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="section-shell h-fit space-y-4 lg:sticky lg:top-6">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Owner menu
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Elke instelling en operatie heeft een eigen pagina.
            </p>
          </div>

          <nav className="space-y-2" aria-label="Dashboard pagina's">
            {dashboardPages.map((page) => {
              const isActive = page.key === currentPage;

              return (
                <Link
                  key={page.key}
                  href={page.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`block rounded-2xl border px-4 py-3 transition ${
                    isActive
                      ? "border-teal-200 bg-teal-50 text-teal-950 shadow-[0_18px_45px_-35px_rgba(15,118,110,0.9)]"
                      : "border-slate-200/80 bg-white/70 text-slate-700 hover:border-teal-100 hover:bg-white"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-semibold">
                        {page.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {page.helper}
                      </span>
                    </span>
                    <span className="rounded-full bg-white/80 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {page.value}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="space-y-5">
          <div className="section-shell">
            <p className="eyebrow">Pagina</p>
            <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                  {currentPageDetails.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {currentPageDetails.helper}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Fact
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  {currentPageDetails.value}
                </p>
              </div>
            </div>
          </div>

          {pageContent[currentPage]}
        </section>
      </section>
    </div>
  );
}
