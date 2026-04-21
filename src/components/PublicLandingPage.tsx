import Link from "next/link";
import { getPublicLandingContent } from "@/lib/marketing-content";
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
  const content = getPublicLandingContent(snapshot);

  return (
    <main className="relative overflow-hidden px-4 py-6 md:px-8 md:py-8">
      <div className="halo-orb halo-orb-left" aria-hidden="true" />
      <div className="halo-orb halo-orb-right" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="spotlight-shell overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/30 to-transparent" />
          <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-7">
              <div className="flex flex-wrap gap-2">
                <span className="metric-chip">Live reserveringen</span>
                <span className="metric-chip">Multi-locatie klaar</span>
              </div>

              <div className="space-y-5">
                <p className="eyebrow">Premium gym OS</p>
                <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-slate-950 md:text-7xl">
                  {content.heroTitle}
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-700 md:text-xl">
                  Van eerste indruk tot reservering en dagelijkse operatie:
                  deze ervaring laat zowel gym owners als leden meteen voelen dat
                  het platform premium, snel en klaar voor groei is.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/login" className="cta-primary">
                  {content.primaryCta}
                </Link>
                <Link href="/reserve" className="cta-secondary">
                  {content.secondaryCta}
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {content.proofCards.map((card) => (
                  <div key={card.label} className="signal-card">
                    <p className="text-sm font-medium text-slate-500">{card.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {card.value}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {card.helper}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex flex-col gap-4">
              <div className="float-card stage-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Owner pulse</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {snapshot.tenantName}
                    </p>
                  </div>
                  <div
                    className={
                      content.ownerStage.statusTone === "live"
                        ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
                        : "rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700"
                    }
                  >
                    {content.ownerStage.statusLabel}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                      {content.ownerStage.primaryMetric.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold">
                      {content.ownerStage.primaryMetric.value}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-amber-100 px-5 py-4 text-slate-950">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {content.ownerStage.secondaryMetric.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold">
                      {content.ownerStage.secondaryMetric.value}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-slate-600">
                  {content.ownerStage.helper}
                </p>
              </div>

              <div className="stage-card float-card delay-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Member flow</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                      Zien, voelen, boeken
                    </h2>
                  </div>
                  <span className="rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700">
                    Consument-proof
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {content.highlightedClasses.length > 0 ? (
                    content.highlightedClasses.map((classSession) => (
                      <div key={classSession.id} className="live-class-card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-950">
                              {classSession.title}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {formatSessionMoment(classSession.startsAt)} ·{" "}
                              {classSession.locationName}
                            </p>
                          </div>
                          <div className="rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm font-medium text-slate-800">
                            {classSession.fillLabel}
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          Coach {classSession.trainerName} · {classSession.focus} ·{" "}
                          {classSession.level}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="live-class-card">
                      <p className="font-semibold text-slate-950">
                        Klaar om live te gaan
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Voeg je eerste rooster toe en laat meteen een merkervaring
                        zien waar leden zonder uitleg doorheen gaan.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="section-shell space-y-5">
            <div className="space-y-2">
              <p className="eyebrow">{content.ownerSectionTitle}</p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Van launch tot volle lesroosters zonder enterprise-frictie.
              </h2>
              <p className="text-base leading-7 text-slate-600">
                Alles voelt premium voor je merk, maar ook praktisch voor je team.
                Geen losse systemen, geen demo-gevoel, geen rommelige operatie.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="signal-card">
                <p className="text-lg font-semibold text-slate-950">{content.ownerHighlights[0]}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Het platform ziet eruit alsof je club al een gevestigde brand is,
                  nog voordat je salespitch begint.
                </p>
              </div>
              <div className="signal-card">
                <p className="text-lg font-semibold text-slate-950">
                  {content.ownerHighlights[1]}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Leden, lesdrukte, reserveringen en frontdesk-werk zitten in één
                  ritme, zodat eigenaarschap niet voelt als handmatig coördineren.
                </p>
              </div>
              <div className="signal-card">
                <p className="text-lg font-semibold text-slate-950">{content.ownerHighlights[2]}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Start met een lege tenant, voeg je echte locaties en accounts toe
                  en ga live zonder workspaces of prototype-omwegen.
                </p>
              </div>
            </div>
          </div>

          <div className="section-shell space-y-5">
            <div className="space-y-2">
              <p className="eyebrow">{content.memberSectionTitle}</p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Een booking-ervaring die aanvoelt als een premium studio.
              </h2>
              <p className="text-base leading-7 text-slate-600">
                Leden hoeven niets uit te zoeken. Ze zien direct wat relevant is,
                voelen schaarste op de juiste manier en boeken zonder twijfel.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="signal-card">
                <p className="text-lg font-semibold text-slate-950">
                  {content.memberHighlights[0]}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Rooster, coach, locatie en beschikbaarheid staan meteen helder in beeld.
                </p>
              </div>
              <div className="signal-card">
                <p className="text-lg font-semibold text-slate-950">
                  {content.memberHighlights[1]}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Vrije plekken en wachtlijst maken urgentie tastbaar zonder stressvol te voelen.
                </p>
              </div>
              <div className="signal-card">
                <p className="text-lg font-semibold text-slate-950">
                  {content.memberHighlights[2]}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  De flow voelt als het begin van lidmaatschap, niet als een kale formulierstap.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section-shell flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="eyebrow">Launch-ready</p>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              Laat een eigenaar meteen “dit wil ik” voelen en een lid meteen “hier wil ik trainen”.
            </h2>
            <p className="text-base leading-7 text-slate-600">
              Bekijk eerst de owner-setup of loop de member-reserveringsflow direct door.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="cta-primary">
              Start owner flow
            </Link>
            <Link href="/reserve" className="cta-secondary">
              Bekijk member experience
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
