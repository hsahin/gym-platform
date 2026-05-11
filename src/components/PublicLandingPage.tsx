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
    <article className="border-border/70 bg-surface rounded-2xl border px-5 py-4">
      <p className="text-muted text-sm">{label}</p>
      <p className="text-foreground mt-2 text-3xl font-semibold tabular-nums">{value}</p>
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
    <article className="border-border/80 bg-surface rounded-2xl border px-6 py-5">
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <p className="text-muted mt-3 text-sm leading-6">{copy}</p>
    </article>
  );
}

function PillTag({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="border-border/70 bg-surface-secondary text-foreground inline-flex rounded-full border px-3 py-1 text-xs font-medium">
      {children}
    </span>
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
    <main className="app-page section-stack py-6 md:py-10">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-surface flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold">
            G
          </div>
          <div className="app-header__brand-copy">
            <p className="text-sm font-semibold">GymOS</p>
            <p className="text-muted text-sm">Sportscholen met meerdere vestigingen</p>
          </div>
        </div>

        <div className="app-header__actions">
          <nav className="app-header__nav text-sm">
            <Link
              href="/pricing"
              prefetch={false}
              className="text-muted hover:text-foreground transition"
            >
              Prijzen
            </Link>
            <Link
              href="/reserve"
              prefetch={false}
              className="text-muted hover:text-foreground transition"
            >
              Reserveren
            </Link>
            <Link
              href="/join"
              prefetch={false}
              className="text-muted hover:text-foreground transition"
            >
              Lid worden
            </Link>
            <Link
              href="/login"
              prefetch={false}
              className="text-muted hover:text-foreground transition"
            >
              Inloggen
            </Link>
          </nav>
          <LazyThemeModeSwitch />
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:gap-6">
        <section className="subtle-grid border-border/80 bg-background rounded-[28px] border px-5 py-6 sm:px-6 sm:py-7 md:px-8 md:py-9">
          <div className="flex flex-wrap gap-2">
            <PillTag>Meerdere clubs</PillTag>
            <PillTag>Live roosterdata</PillTag>
          </div>

          <div className="mt-5 max-w-4xl space-y-3">
            <h1 className="text-3xl leading-tight font-semibold sm:text-4xl md:text-5xl">
              Beheer reserveringen, leden, betalingen en toegang vanuit één rustig overzicht.
            </h1>
            <p className="text-muted max-w-3xl text-base leading-7">
              Dit platform is gebouwd voor echte gym-operatie: roosterbezetting,
              lidstatus, betaalgereedheid en een duidelijke livegang. Geen losse
              marketinglaag, wel direct bruikbaar clubbeheer.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <MetricCard label="Clubs" value={String(activeGymCount)} />
            <MetricCard label="Lessen live" value={String(snapshot.classSessions.length)} />
            <MetricCard label="Bezetting" value={`${occupancy}%`} />
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/login?mode=signup" prefetch={false} className="cta-primary">
              Nieuwe gym starten
            </Link>
            <Link href="/reserve" prefetch={false} className="cta-secondary">
              Lessen bekijken
            </Link>
            <Link href="/join" prefetch={false} className="cta-secondary">
              Lid aanmelden
            </Link>
          </div>
        </section>

        <section className="border-border/80 bg-background rounded-[28px] border px-5 py-6 sm:px-6 sm:py-7 md:px-8 md:py-9">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <p className="text-foreground text-lg font-semibold">Live vraag</p>
              <p className="text-muted text-sm leading-6">
                De publieke flow laat alleen zien wat echt boekbaar is, niet een
                statische brochure.
              </p>
            </div>
            <PillTag>{occupancy}% gevuld</PillTag>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Geboekt</span>
              <span className="tabular-nums">
                {bookedSpots} / {totalCapacity || 0}
              </span>
            </div>
            <div
              aria-label={`Bezetting ${occupancy}%`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={occupancy}
              className="bg-surface-secondary h-2 overflow-hidden rounded-full"
              role="progressbar"
            >
              <div
                className="bg-accent h-full rounded-full transition-[width]"
                style={{ width: `${occupancy}%` }}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {snapshot.classSessions.slice(0, 4).map((classSession) => (
              <article
                key={classSession.id}
                className="border-border/70 bg-surface-secondary rounded-2xl border px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-foreground min-w-0 truncate font-medium">
                    {classSession.title}
                  </p>
                  <span className="border-border/70 bg-surface inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-medium tabular-nums">
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

      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
        <FeatureCard
          title="Operatie eerst"
          copy="Pagina's zijn ingedeeld op werk: lessen, leden, contracten, toegang, betalingen en instellingen."
        />
        <FeatureCard
          title="Echte inrichting"
          copy="De werkbank helpt je vestigingen, lidmaatschappen, trainers, medewerkers, betalingen en juridische basis opzetten."
        />
        <FeatureCard
          title="Ledenroute inbegrepen"
          copy="Elke club krijgt een eigen reserveringsproces en live rooster, zonder aparte tooling ernaast."
        />
      </section>
    </main>
  );
}
