import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/HeroCompat";
import { AttendanceButton } from "@/components/AttendanceButton";
import { CancelBookingButton } from "@/components/CancelBookingButton";
import {
  getBookingSourceLabel,
  getBookingStatusLabel,
  getClassLevelLabel,
} from "@/lib/ui-labels";
import type { GymDashboardSnapshot } from "@/server/types";

function formatSessionMoment(startsAt: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(startsAt));
}

function getBookingVariant(status: string) {
  if (status === "checked_in") {
    return "success";
  }

  if (status === "waitlisted") {
    return "warning";
  }

  if (status === "cancelled") {
    return "secondary";
  }

  return "info";
}

export function BookingManagementView({
  snapshot,
}: {
  snapshot: GymDashboardSnapshot;
}) {
  const bookings = [...snapshot.bookings].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const classSessionById = new Map(
    snapshot.classSessions.map((classSession) => [classSession.id, classSession] as const),
  );
  const locationById = new Map(
    snapshot.locations.map((location) => [location.id, location] as const),
  );

  const confirmedCount = bookings.filter((booking) => booking.status === "confirmed").length;
  const waitlistedCount = bookings.filter((booking) => booking.status === "waitlisted").length;
  const checkedInCount = bookings.filter((booking) => booking.status === "checked_in").length;
  const cancelledCount = bookings.filter((booking) => booking.status === "cancelled").length;

  return (
    <div className="space-y-5">
      <section className="command-deck">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Reserveringsbalie
            </p>
            <h3 className="text-3xl font-semibold tracking-tight text-white">
              Volledige grip op bevestigingen, wachtlijst en aanwezigheid.
            </h3>
            <p className="text-sm leading-6 text-white/70">
              Dit scherm moet voelen als een sterke balieconsole: snel scanbaar,
              direct actiegericht en zonder ruis tussen status en opvolging.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/70">
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">
              Totaal live
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{bookings.length}</p>
            <p className="mt-1">
              reservering{bookings.length === 1 ? "" : "en"} in deze tenant
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="soft-card">
          <p className="text-sm font-medium text-slate-500">Bevestigd</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{confirmedCount}</p>
        </div>
        <div className="soft-card">
          <p className="text-sm font-medium text-slate-500">Wachtlijst</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{waitlistedCount}</p>
        </div>
        <div className="soft-card">
          <p className="text-sm font-medium text-slate-500">Ingecheckt</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{checkedInCount}</p>
        </div>
        <div className="soft-card">
          <p className="text-sm font-medium text-slate-500">Geannuleerd</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{cancelledCount}</p>
        </div>
      </div>

      {bookings.length > 0 ? (
        <div className="grid gap-4">
          {bookings.map((booking) => {
            const classSession = classSessionById.get(booking.classSessionId);
            const locationName = classSession
              ? locationById.get(classSession.locationId)?.name ?? "Onbekende vestiging"
              : "Onbekende vestiging";

            return (
              <Card key={booking.id} className="overflow-hidden border-white/70 bg-white/90 shadow-[0_22px_80px_-58px_rgba(16,24,38,0.5)]">
                <CardHeader className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{booking.memberName}</CardTitle>
                      <p className="text-sm leading-6 text-slate-600">
                        {classSession?.title ?? "Onbekende les"} ·{" "}
                        {classSession ? formatSessionMoment(classSession.startsAt) : "Tijd onbekend"} ·{" "}
                        {locationName}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{getBookingSourceLabel(booking.source)}</Badge>
                      <Badge variant={getBookingVariant(booking.status)}>
                        {getBookingStatusLabel(booking.status)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">Contact</p>
                      <p className="mt-2 break-all">{booking.phone}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">Lesfocus</p>
                      <p className="mt-2">{classSession?.focus ?? "Niet beschikbaar"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">Niveau</p>
                      <p className="mt-2">
                        {classSession ? getClassLevelLabel(classSession.level) : "Niet beschikbaar"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">Notitie</p>
                      <p className="mt-2">{booking.notes ?? "Geen notitie"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {snapshot.uiCapabilities.canRecordAttendance &&
                    booking.status === "confirmed" ? (
                      <AttendanceButton
                        bookingId={booking.id}
                        expectedVersion={booking.version}
                      />
                    ) : null}

                    {snapshot.uiCapabilities.canCreateBooking &&
                    (booking.status === "confirmed" || booking.status === "waitlisted") ? (
                      <CancelBookingButton
                        bookingId={booking.id}
                        expectedVersion={booking.version}
                      />
                    ) : null}

                    {booking.status === "cancelled" ? (
                      <p className="text-sm text-slate-500">
                        Deze reservering is gesloten en telt niet meer mee in de bezetting.
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-white/70 bg-white/90 shadow-[0_20px_70px_-52px_rgba(16,24,38,0.45)]">
          <CardContent className="space-y-4 p-6 text-sm leading-6 text-slate-600">
            <div className="space-y-2">
              <p className="eyebrow">Nog leeg</p>
              <p className="text-xl font-semibold text-slate-950">
                Je eerste reservering verschijnt hier zodra de ledenroute live gaat.
              </p>
            </div>
            <p>
              Gebruik de reserveringsroute in het dashboard of laat leden reserveren via de
              publieke reserveringspagina.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/reserve" className="cta-primary">
                Open publieke route
              </Link>
              <Link href="/" className="cta-secondary">
                Terug naar dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
