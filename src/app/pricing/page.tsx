import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  CreditCardIcon,
  GymOsAmbient,
  GymOsBadge,
  GymOsLogo,
  LockIcon,
  UsersIcon,
} from "@/components/GymOsPrimitives";

const plans = [
  {
    name: "Launch",
    price: "€49",
    helper: "Voor één gym die snel live wil.",
    features: ["Ledenbeheer", "Rooster en reserveringen", "Contracten", "Owner dashboard"],
  },
  {
    name: "Growth",
    price: "€99",
    helper: "Voor gyms met teamrollen en automatisering.",
    features: ["Alles uit Launch", "Mollie betalingen", "Smartdeurs", "Import van leden en contracten"],
    highlighted: true,
  },
  {
    name: "Multi-gym",
    price: "Op maat",
    helper: "Voor ondernemers met meerdere locaties of labels.",
    features: ["Meerdere gyms", "Teamrollen per gym", "Segmenten en marketing", "Livegang begeleiding"],
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <GymOsAmbient />

      <nav className="relative z-50 border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <GymOsLogo />
          <div className="flex items-center gap-3">
            <Link href="/reserve" className="hidden text-sm text-white/60 transition hover:text-white sm:inline-flex">
              Boek een les
            </Link>
            <Link href="/login?mode=signup" className="gym-os-button">
              Starten
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <GymOsBadge>Prijzen</GymOsBadge>
          <h1 className="mb-6 mt-6 text-4xl font-bold leading-tight md:text-6xl">
            Kies het model dat past bij je gymgroei
          </h1>
          <p className="text-lg leading-8 text-white/45">
            Deze pagina is bewust simpel: de echte omzet komt uit contracten,
            reserveringen, betalingen en member experience die je in het platform beheert.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`glass-card p-8 ${
                plan.highlighted ? "border-orange-500/30 bg-orange-500/10 shadow-2xl shadow-orange-500/10" : ""
              }`}
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">{plan.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/45">{plan.helper}</p>
                </div>
                {plan.highlighted ? <GymOsBadge>Populair</GymOsBadge> : null}
              </div>
              <p className="mb-6 text-5xl font-bold">
                {plan.price}
                {plan.price.startsWith("€") ? (
                  <span className="text-base font-medium text-white/35"> / maand</span>
                ) : null}
              </p>
              <div className="mb-8 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3 text-sm text-white/55">
                    <CheckIcon className="h-4 w-4 text-emerald-400" />
                    {feature}
                  </div>
                ))}
              </div>
              <Link href="/login?mode=signup" className={plan.highlighted ? "gym-os-button w-full" : "gym-os-button-secondary w-full"}>
                Gym aanmelden
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Betalingen",
              copy: "Mollie voor incasso, eenmalig en betaalverzoeken.",
              icon: CreditCardIcon,
            },
            {
              title: "Toegang",
              copy: "Nuki-first smartdoor beheer, voorbereid op andere sloten.",
              icon: LockIcon,
            },
            {
              title: "Leden",
              copy: "Importeer bestaande klanten en bouw contracten automatisch op.",
              icon: UsersIcon,
            },
          ].map((item) => (
            <div key={item.title} className="glass-card p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                <item.icon className="h-5 w-5 text-orange-400" />
              </div>
              <h2 className="mb-2 font-semibold">{item.title}</h2>
              <p className="text-sm leading-6 text-white/40">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
