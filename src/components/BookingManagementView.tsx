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
    <div className="section-stack">
      <section className="command-deck">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="eyebrow">Reserveringsbalie</p>
            <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Volledige grip op bevestigingen, wachtlijst en aanwezigheid.
            </h3>
            <p className="text-sm leading-6 opacity-90">
              Dit scherm moet voelen als een sterke balieconsole: snel scanbaar,
              direct actiegericht en zonder ruis tussen status en opvolging.
            </p>
          </div>

          <div className="rounded-2xl border border-current/20 bg-black/10 px-4 py-3 text-sm dark:bg-white/5">
            <p className="eyebrow">Totaal live</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{bookings.length}</p>
            <p className="mt-1 opacity-80">
              reservering{bookings.length === 1 ? "" : "en"} in deze tenant
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="soft-card">
          <p className="eyebrow">Bevestigd</p>
          <p className="text-foreground text-2xl font-semibold tabular-nums">{confirmedCount}</p>
        </div>
        <div className="soft-card">
          <p className="eyebrow">Wachtlijst</p>
          <p className="text-foreground text-2xl font-semibold tabular-nums">{waitlistedCount}</p>
        </div>
        <div className="soft-card">
          <p className="eyebrow">Ingecheckt</p>
          <p className="text-foreground text-2xl font-semibold tabular-nums">{checkedInCount}</p>
        </div>
        <div className="soft-card">
          <p className="eyebrow">Geannuleerd</p>
          <p className="text-foreground text-2xl font-semibold tabular-nums">{cancelledCount}</p>
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
              <Card key={booking.id} className="overflow-hidden">
                <CardHeader className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-lg">{booking.memberName}</CardTitle>
                      <p className="text-muted text-sm leading-6">
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
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="soft-card">
                      <p className="eyebrow">Contact</p>
                      <p className="text-foreground break-all text-sm">{booking.phone}</p>
                    </div>
                    <div className="soft-card">
                      <p className="eyebrow">Lesfocus</p>
                      <p className="text-foreground text-sm">
                        {classSession?.focus ?? "Niet beschikbaar"}
                      </p>
                    </div>
                    <div className="soft-card">
                      <p className="eyebrow">Niveau</p>
                      <p className="text-foreground text-sm">
                        {classSession ? getClassLevelLabel(classSession.level) : "Niet beschikbaar"}
                      </p>
                    </div>
                    <div className="soft-card">
                      <p className="eyebrow">Notitie</p>
                      <p className="text-foreground text-sm">{booking.notes ?? "Geen notitie"}</p>
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
                      <p className="text-muted text-sm">
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
        <Card>
          <CardContent className="text-muted space-y-4 p-6 text-sm leading-6">
            <div className="space-y-2">
              <p className="eyebrow">Nog leeg</p>
              <p className="text-foreground text-xl font-semibold">
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
