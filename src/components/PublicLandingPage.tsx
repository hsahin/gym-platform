import Link from "next/link";
import { LazyThemeModeSwitch } from "@/components/theme/LazyThemeModeSwitch";
import type { PublicReservationSnapshot } from "@/server/types";

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

function MetricCard({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <article className="rounded-2xl border border-border/70 bg-surface px-5 py-4">
      <p className="text-muted text-sm">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </article>
  );
}

function FeatureCard({
  title,
  copy,
}: {
  readonly title: string;
  readonly copy: string;
}) {
  return (
    <article className="rounded-2xl border border-border/80 bg-surface px-6 py-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted mt-3 text-sm leading-6">{copy}</p>
    </article>
  );
}

export function PublicLandingPage({
  snapshot,
}: {
  snapshot: PublicReservationSnapshot;
}) {
  const activeGymCount = snapshot.availableGyms.length || (snapshot.tenantSlug ? 1 : 0);
  const totalCapacity = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.capacity,
    0,
  );
  const bookedSpots = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.bookedCount,
    0,
  );
  const occupancy =
    totalCapacity > 0 ? Math.round((bookedSpots / totalCapacity) * 100) : 0;

  return (
    <main className="app-page section-stack py-8 md:py-10">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-surface flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold">
            G
          </div>
          <div className="app-header__brand-copy">
            <p className="text-sm font-semibold">GymOS</p>
            <p className="text-muted text-sm">Operations for multi-location gyms</p>
          </div>
        </div>

        <div className="app-header__actions">
          <nav className="app-header__nav text-sm">
            <Link
              href="/pricing"
              prefetch={false}
              className="text-muted transition hover:text-foreground"
            >
              Prijzen
            </Link>
            <Link
              href="/reserve"
              prefetch={false}
              className="text-muted transition hover:text-foreground"
            >
              Reserveren
            </Link>
            <Link
              href="/join"
              prefetch={false}
              className="text-muted transition hover:text-foreground"
            >
              Lid worden
            </Link>
            <Link
              href="/login"
              prefetch={false}
              className="text-muted transition hover:text-foreground"
            >
              Team login
            </Link>
          </nav>
          <LazyThemeModeSwitch />
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section className="subtle-grid rounded-[28px] border border-border/80 bg-background px-6 py-7 md:px-8 md:py-9">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-border/70 bg-surface-secondary px-3 py-1 text-xs font-medium">
              Multi-gym
            </span>
            <span className="inline-flex rounded-full border border-border/70 bg-surface-secondary px-3 py-1 text-xs font-medium">
              Live booking data
            </span>
          </div>

          <div className="mt-5 max-w-4xl space-y-3">
            <h1 className="text-4xl leading-tight font-semibold md:text-5xl">
              Run bookings, members, payments, and access from one calm surface.
            </h1>
            <p className="text-muted max-w-3xl text-base leading-7">
              The product is focused on actual gym operations: schedule fill, member
              state, revenue readiness, and launch setup. No marketing-shell dashboard.
            </p>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Gyms" value={String(activeGymCount)} />
            <MetricCard label="Classes live" value={String(snapshot.classSessions.length)} />
            <MetricCard label="Occupancy" value={`${occupancy}%`} />
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/login?mode=signup"
              prefetch={false}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground"
            >
              Nieuwe gym starten
            </Link>
            <Link
              href="/reserve"
              prefetch={false}
              className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium"
            >
              Lessen bekijken
            </Link>
            <Link
              href="/join"
              prefetch={false}
              className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium"
            >
              Lid aanmelden
            </Link>
          </div>
        </section>

        <section className="rounded-[28px] border border-border/80 bg-background px-6 py-7 md:px-8 md:py-9">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">Live demand</p>
              <p className="text-muted mt-1 text-sm leading-6">
                The public flow exposes what is actually available, not a static brochure.
              </p>
            </div>
            <span className="inline-flex rounded-full border border-border/70 bg-surface-secondary px-3 py-1 text-xs font-medium">
              {occupancy}% gevuld
            </span>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Booked</span>
              <span className="tabular-nums">
                {bookedSpots} / {totalCapacity || 0}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-secondary">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${occupancy}%` }}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {snapshot.classSessions.slice(0, 4).map((classSession) => (
              <article
                key={classSession.id}
                className="rounded-2xl border border-border/70 bg-surface-secondary px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{classSession.title}</p>
                  <span className="inline-flex rounded-full border border-border/70 bg-surface px-3 py-1 text-xs font-medium">
                    {classSession.bookedCount}/{classSession.capacity}
                  </span>
                </div>
                <p className="text-muted mt-2 text-sm">
                  {formatSessionMoment(classSession.startsAt)} · {classSession.locationName}
                </p>
                <p className="text-muted mt-1 text-sm">{classSession.trainerName}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          title="Operations first"
          copy="Pages are organized by work: classes, members, contracts, access, payments, settings."
        />
        <FeatureCard
          title="Real setup flows"
          copy="The workbench creates locations, memberships, trainers, staff, payments, and legal setup."
        />
        <FeatureCard
          title="Consumer flow included"
          copy="Every gym gets its own reservation flow and live schedule without separate tooling."
        />
      </section>
    </main>
  );
}
