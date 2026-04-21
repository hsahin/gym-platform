import Link from "next/link";
import { getLoginExperienceContent } from "@/lib/marketing-content";

export function LoginExperiencePanel({
  accountCount,
  isSetupComplete,
}: {
  accountCount: number;
  isSetupComplete: boolean;
}) {
  const content = getLoginExperienceContent({
    accountCount,
    isSetupComplete,
  });

  return (
    <div className="space-y-5">
      <section className="stage-card space-y-5">
        <div className="space-y-2">
          <p className="eyebrow">
            {isSetupComplete ? "Launch actief" : "Owner experience"}
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">
            {content.heroTitle}
          </h2>
          <p className="text-base leading-7 text-slate-600">
            Deze ingang moet niet voelen als een adminscherm, maar als de start
            van een premium operatie die meteen vertrouwen geeft aan teams en leden.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="signal-card">
            <p className="text-lg font-semibold text-slate-950">{content.ownerHighlights[0]}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Owners zien direct een merkwaardige ervaring die verkoopt nog voordat
              er een gesprek plaatsvindt.
            </p>
          </div>
          <div className="signal-card">
            <p className="text-lg font-semibold text-slate-950">
              {content.ownerHighlights[1]}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Planning, leden, reserveringen en teamaccounts landen in één systeem
              dat er ook nog premium uitziet.
            </p>
          </div>
        </div>
      </section>

      <section className="stage-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">
              {isSetupComplete ? "Live momentum" : "Na de inrichting"}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {content.momentumLabel}
            </p>
          </div>
          <div className="rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700">
            {isSetupComplete ? "Klaar voor teamgebruik" : "Zero demo-data"}
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-600">
          {content.bookingPromise}
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <Link href="/reserve" className="cta-secondary">
            {content.reservationCta}
          </Link>
          <Link href="/login" className="cta-primary">
            {isSetupComplete ? "Ga naar owner login" : "Start de launch"}
          </Link>
        </div>
      </section>
    </div>
  );
}
