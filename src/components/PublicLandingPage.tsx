import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChartIcon,
  CreditCardIcon,
  DumbbellIcon,
  GymOsAmbient,
  GymOsBadge,
  GymOsLogo,
  LockIcon,
  UsersIcon,
  ZapIcon,
} from "@/components/GymOsPrimitives";
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

export function PublicLandingPage({
  snapshot,
}: {
  snapshot: PublicReservationSnapshot;
}) {
  const highlightedClasses = snapshot.classSessions.slice(0, 3);
  const activeGymCount =
    snapshot.availableGyms.length > 0
      ? snapshot.availableGyms.length
      : snapshot.tenantSlug
        ? 1
        : 0;
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
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <GymOsAmbient />

      <nav className="relative z-50 border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <GymOsLogo />

          <div className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm text-white/60 transition-colors hover:text-white">
              Features
            </Link>
            <Link href="/pricing" className="text-sm text-white/60 transition-colors hover:text-white">
              Prijzen
            </Link>
            <Link href="/reserve" className="text-sm text-white/60 transition-colors hover:text-white">
              Boek een les
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.05] hover:text-white sm:inline-flex"
            >
              Inloggen
            </Link>
            <Link href="/login?mode=signup" className="gym-os-button">
              Gym aanmelden
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative z-10 px-6 pb-28 pt-16 md:pt-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <div className="mb-8 flex flex-wrap items-center gap-3">
              <GymOsBadge>
                <ZapIcon className="mr-2 h-3.5 w-3.5" />
                Nu live
              </GymOsBadge>
              <GymOsBadge tone="neutral">Multi-gym platform</GymOsBadge>
              <GymOsBadge tone="neutral">Zonder demo-data op de homepage</GymOsBadge>
            </div>

            <h1 className="mb-8 text-5xl font-bold leading-[1.08] tracking-tight text-white md:text-7xl">
              Run je gym als een{" "}
              <span className="text-gradient-orange">premium merk</span>
            </h1>

            <p className="mb-12 max-w-2xl text-lg leading-relaxed text-white/50 md:text-xl">
              Eén platform voor meerdere sportscholen: inschrijven, reserveren,
              ledenbeheer, contracten, betalingen en smart access in een ervaring
              die meteen vertrouwen geeft.
            </p>

            <div className="mb-16 flex flex-wrap gap-4">
              <Link href="/login?mode=signup" className="inline-flex h-14 items-center gap-2 rounded-xl bg-orange-500 px-8 text-lg font-semibold text-white shadow-2xl shadow-orange-500/25 transition hover:bg-orange-600 hover:shadow-orange-500/40">
                Start als gym owner
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link href="/reserve" className="inline-flex h-14 items-center rounded-xl border border-white/10 px-8 text-lg font-semibold text-white/80 transition hover:bg-white/[0.05] hover:text-white">
                Boek een les
              </Link>
            </div>

            <div className="grid max-w-2xl gap-6 sm:grid-cols-3">
              <div className="relative">
                <div className="absolute -left-4 bottom-0 top-0 w-px bg-gradient-to-b from-orange-500/50 to-transparent" />
                <p className="mb-1 text-3xl font-bold text-white">{activeGymCount}</p>
                <p className="text-sm text-white/40">Gyms beschikbaar</p>
                <p className="mt-1 text-xs text-white/25">Uit tenantlijst</p>
              </div>
              <div className="relative">
                <div className="absolute -left-4 bottom-0 top-0 w-px bg-gradient-to-b from-orange-500/30 to-transparent" />
                <p className="mb-1 text-3xl font-bold text-white">{snapshot.classSessions.length}</p>
                <p className="text-sm text-white/40">Lessen zichtbaar</p>
                <p className="mt-1 text-xs text-white/25">Uit roosterdata</p>
              </div>
              <div className="relative">
                <div className="absolute -left-4 bottom-0 top-0 w-px bg-gradient-to-b from-orange-500/20 to-transparent" />
                <p className="mb-1 text-3xl font-bold text-white">{occupancy}%</p>
                <p className="text-sm text-white/40">Bezetting</p>
                <p className="mt-1 text-xs text-white/25">Boekingen/capaciteit</p>
              </div>
            </div>
          </div>

          <div className="absolute right-6 top-24 hidden w-[500px] xl:block">
            <div className="relative">
              <div className="glass-card animate-float p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                      <ChartIcon className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Live owner pulse</p>
                      <p className="text-sm text-white/40">{snapshot.tenantName}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                    operationeel
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/50">Lesbezetting</span>
                    <span className="text-sm font-medium text-white">{occupancy}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                      style={{ width: `${Math.min(100, occupancy)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">{bookedSpots} reserveringen</span>
                    <span className="text-emerald-400">{totalCapacity} plekken totaal</span>
                  </div>
                </div>
              </div>

              <div className="glass-card absolute -bottom-24 -left-16 animate-float p-4" style={{ animationDelay: "2s" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                    <CheckIcon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Nieuwe reservering</p>
                    <p className="text-xs text-white/40">Direct zichtbaar in dashboard</p>
                  </div>
                </div>
              </div>

              <div className="glass-card absolute -right-8 bottom-[-150px] p-4">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/30">
                  Volgende lessen
                </p>
                <div className="space-y-3">
                  {highlightedClasses.length > 0 ? (
                    highlightedClasses.map((classSession) => (
                      <div key={classSession.id} className="rounded-xl bg-white/[0.04] p-3">
                        <p className="text-sm font-medium text-white">{classSession.title}</p>
                        <p className="mt-1 text-xs text-white/40">
                          {formatSessionMoment(classSession.startsAt)} · {classSession.locationName}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl bg-white/[0.04] p-3 text-sm text-white/45">
                      Kies een gym om live lessen te zien.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 border-t border-white/[0.04] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <GymOsBadge tone="neutral">Voor gym owners</GymOsBadge>
            <h2 className="mx-auto mb-6 mt-6 max-w-3xl text-4xl font-bold text-white md:text-5xl">
              Een dashboard dat voelt alsof je club al groot is
            </h2>
            <p className="mx-auto max-w-2xl text-lg leading-8 text-white/40">
              Geen tab-chaos en geen technische meldingen voor de gebruiker. Elke
              hoofdtaak heeft een eigen pagina en een duidelijke actie.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Rooster & reserveringen",
                copy: "Plan lessen, beheer capaciteit en zie reserveringen direct terug.",
                icon: CalendarIcon,
              },
              {
                title: "Leden & contracten",
                copy: "Maand, 6 maanden en jaarcontracten inclusief import van bestaande klanten.",
                icon: UsersIcon,
              },
              {
                title: "Betalingen via Mollie",
                copy: "Voor automatische incasso, eenmalige betalingen en betaalverzoeken.",
                icon: CreditCardIcon,
              },
              {
                title: "Smartdeurs",
                copy: "Owner-only instellingen voor Nuki en andere gangbare smart locks.",
                icon: LockIcon,
              },
              {
                title: "Multi-gym klaar",
                copy: "Elke sportschool heeft eigen accounts, data en publieke reserveringsflow.",
                icon: DumbbellIcon,
              },
              {
                title: "Premium conversie",
                copy: "Consumenten zien wat vrij is, voelen vertrouwen en boeken zonder gedoe.",
                icon: ZapIcon,
              },
            ].map((feature) => (
              <div key={feature.title} className="glass-card-hover group p-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 transition-colors group-hover:bg-orange-500/15">
                  <feature.icon className="h-6 w-6 text-orange-400" />
                </div>
                <h3 className="mb-3 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="leading-relaxed text-white/40">{feature.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-[2rem] border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-white/[0.03] to-transparent p-8 md:p-12">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-orange-300">
                  Klaar voor livegang
                </p>
                <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
                  Laat owners én leden direct denken: dit wil ik gebruiken.
                </h2>
                <p className="text-lg leading-8 text-white/45">
                  Start met owner signup, voeg echte data toe en laat leden via de
                  publieke reserveringsflow instromen.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/login?mode=signup" className="gym-os-button">
                  Owner aanmelden
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link href="/reserve" className="gym-os-button-secondary">
                  Member flow bekijken
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
