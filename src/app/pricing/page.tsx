import Link from "next/link";
import { LazyThemeModeSwitch } from "@/components/theme/LazyThemeModeSwitch";

const plans = [
  {
    name: "Start",
    price: "€49",
    helper: "Voor één gym die snel live wil.",
    features: ["Ledenbeheer", "Rooster en reserveringen", "Lidmaatschappen", "Eigenaarsdashboard"],
  },
  {
    name: "Groei",
    price: "€99",
    helper: "Voor gyms met medewerkerrollen en automatisering.",
    features: [
      "Alles uit Start",
      "Mollie-betalingen",
      "Slimme deuren",
      "Import van leden en lidmaatschappen",
    ],
    highlighted: true,
  },
  {
    name: "Multi-gym",
    price: "Op maat",
    helper: "Voor ondernemers met meerdere vestigingen of labels.",
    features: ["Meerdere gyms", "Medewerkerrollen per gym", "Segmenten en marketing", "Livegang begeleiding"],
  },
];

export default function PricingPage() {
  return (
    <main className="app-page section-stack py-8 md:py-10">
      <header className="app-header">
        <div className="app-header__brand-copy">
          <p className="text-sm font-semibold">GymOS</p>
          <p className="text-muted text-sm">Prijzen bewust eenvoudig.</p>
        </div>

        <div className="app-header__actions">
          <div className="app-header__nav text-sm">
            <Link
              href="/reserve"
              prefetch={false}
              className="text-muted transition hover:text-foreground"
            >
              Boek een les
            </Link>
            <Link
              href="/login?mode=signup"
              prefetch={false}
              className="rounded-full bg-accent px-5 py-2.5 text-accent-foreground"
            >
              Starten
            </Link>
          </div>
          <LazyThemeModeSwitch />
        </div>
      </header>

      <section className="space-y-4">
        <span className="inline-flex w-fit rounded-full border border-border/70 bg-surface-secondary px-3 py-1 text-sm font-medium">
          Prijzen
        </span>
        <div className="max-w-3xl space-y-3">
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Kies de setup die past bij je sportschool.
          </h1>
          <p className="text-muted text-base leading-7">
            De waarde zit in dagelijkse operatie, niet in ingewikkelde pakketten.
            Deze plannen volgen hoeveel workflow je vanaf dag één live wilt hebben.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`rounded-[28px] border border-border/80 bg-surface ${plan.highlighted ? "ring-2 ring-accent/20" : ""}`}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                <p className="text-muted text-sm leading-6">{plan.helper}</p>
              </div>
              {plan.highlighted ? (
                <span className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  Populair
                </span>
              ) : null}
            </div>
            <div className="section-stack px-6 pb-6 pt-5">
              <p className="text-4xl font-semibold">
                {plan.price}
                {plan.price.startsWith("€") ? (
                  <span className="text-muted text-base font-medium"> / maand</span>
                ) : null}
              </p>

              <div className="grid gap-2">
                {plan.features.map((feature) => (
                  <div
                    key={feature}
                    className="rounded-2xl border border-border/70 bg-surface-secondary px-4 py-3 text-sm"
                  >
                    {feature}
                  </div>
                ))}
              </div>

              <Link
                href="/login?mode=signup"
                prefetch={false}
                className={`rounded-full px-5 py-2.5 text-center text-sm font-medium ${
                  plan.highlighted
                    ? "bg-accent text-accent-foreground"
                    : "border border-border bg-surface"
                }`}
              >
                Gym aanmelden
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
