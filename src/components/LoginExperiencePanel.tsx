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
    <div className="section-stack">
      <section className="stage-card">
        <div className="space-y-2">
          <p className="eyebrow">
            {isSetupComplete ? "Launch actief" : "Eigenaarservaring"}
          </p>
          <h2 className="text-foreground text-2xl font-semibold tracking-tight md:text-3xl">
            {content.heroTitle}
          </h2>
          <p className="text-muted text-base leading-7">
            Deze ingang moet niet voelen als een adminscherm, maar als de start
            van een premium operatie die meteen vertrouwen geeft aan teams en leden.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="signal-card">
            <p className="text-foreground text-lg font-semibold">{content.ownerHighlights[0]}</p>
            <p className="text-muted text-sm leading-6">
              Eigenaren zien direct een merkwaardige ervaring die verkoopt nog voordat
              er een gesprek plaatsvindt.
            </p>
          </div>
          <div className="signal-card">
            <p className="text-foreground text-lg font-semibold">
              {content.ownerHighlights[1]}
            </p>
            <p className="text-muted text-sm leading-6">
              Planning, leden, reserveringen en medewerkeraccounts landen in één systeem
              dat er ook nog premium uitziet.
            </p>
          </div>
        </div>
      </section>

      <section className="stage-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">
              {isSetupComplete ? "Live momentum" : "Na de inrichting"}
            </p>
            <p className="text-foreground mt-2 text-2xl font-semibold">
              {content.momentumLabel}
            </p>
          </div>
          <div className="border-border bg-surface text-foreground rounded-full border px-4 py-2 text-sm font-medium">
            {isSetupComplete ? "Klaar voor teamgebruik" : "Schone start"}
          </div>
        </div>

        <p className="text-muted text-sm leading-6">
          {content.bookingPromise}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/reserve" className="cta-secondary">
            {content.reservationCta}
          </Link>
          <Link href="/login" className="cta-primary">
            {isSetupComplete ? "Ga naar inloggen" : "Start de launch"}
          </Link>
        </div>
      </section>
    </div>
  );
}
