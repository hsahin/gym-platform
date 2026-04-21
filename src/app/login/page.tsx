import { cookies } from "next/headers";
import Link from "next/link";
import { Badge, Button } from "@claimtech/ui";
import { LoginExperiencePanel } from "@/components/LoginExperiencePanel";
import {
  hasLocalPlatformSetup,
  listLocalPlatformAccounts,
  listLocalTenants,
} from "@/server/persistence/local-platform-state";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";
import { PLATFORM_ROLE_OPTIONS, getRoleLabel } from "@/server/runtime/platform-roles";

function readSearchParam(
  value: string | ReadonlyArray<string> | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

function fieldClassName() {
  return "mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const viewer = await resolveViewerFromToken(token);
  const isSetupComplete = await hasLocalPlatformSetup();
  const accounts = isSetupComplete ? await listLocalPlatformAccounts() : [];
  const tenants = isSetupComplete ? await listLocalTenants() : [];
  const tenantNameById = new Map(tenants.map((tenant) => [tenant.id, tenant.name] as const));
  const loginError = readSearchParam(searchParams?.error);
  const setupError = readSearchParam(searchParams?.setupError);
  const mode = !isSetupComplete || readSearchParam(searchParams?.mode) === "signup"
    ? "signup"
    : "login";

  return (
    <main className="relative overflow-hidden px-4 py-10 md:px-8">
      <div className="halo-orb halo-orb-left" aria-hidden="true" />
      <div className="halo-orb halo-orb-right" aria-hidden="true" />

      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="spotlight-shell overflow-hidden">
          <div className="space-y-5">
            <Badge variant={isSetupComplete ? "info" : "warning"}>
              {isSetupComplete ? "Inloggen" : "Eerste inrichting"}
            </Badge>
            {viewer ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm text-teal-800">
                <span className="font-medium">Actieve sessie:</span>
                <span>{viewer.roleLabel}</span>
              </div>
            ) : null}
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              {isSetupComplete
                ? "Open de operatie van je club in één premium flow."
                : "Lanceer je sportschoolplatform zonder demo-gevoel."}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              {isSetupComplete
                ? "Gebruik je teamaccount om locaties, leden, reserveringen en planning te beheren in een ervaring die merkwaardig en vertrouwd aanvoelt."
                : "Start schoon, zet je eerste owner live en bouw daarna een clubervaring waar zowel leden als team direct doorheen bewegen."}
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="signal-card">
              <p className="text-sm font-medium text-slate-500">Positionering</p>
              <p className="mt-3 text-xl font-semibold text-slate-950">
                Boutique merkgevoel
              </p>
            </div>
            <div className="signal-card">
              <p className="text-sm font-medium text-slate-500">Teamrust</p>
              <p className="mt-3 text-xl font-semibold text-slate-950">
                Frontdesk tot trainer op één ritme
              </p>
            </div>
            <div className="signal-card">
              <p className="text-sm font-medium text-slate-500">Conversie</p>
              <p className="mt-3 text-xl font-semibold text-slate-950">
                Leden willen meteen boeken
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.45)]">
            {isSetupComplete ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <Link
                    href="/login"
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      mode === "login"
                        ? "border-teal-200 bg-teal-50 text-teal-900"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Inloggen op bestaande gym
                  </Link>
                  <Link
                    href="/login?mode=signup"
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      mode === "signup"
                        ? "border-teal-200 bg-teal-50 text-teal-900"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Nieuwe gym aanmelden
                  </Link>
                </div>

                {mode === "login" ? (
              <form action="/api/auth/login" method="post" className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-slate-800">
                    Gym
                    <select
                      className={`${fieldClassName()} brand-select`}
                      name="tenantSlug"
                      defaultValue={tenants[0]?.id ?? ""}
                      required
                    >
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-800">
                    E-mailadres
                    <input
                      className={`${fieldClassName()} brand-input`}
                      type="email"
                      name="email"
                      autoComplete="username"
                      placeholder="eigenaar@jouwgym.nl"
                      required
                    />
                  </label>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-800">
                    Wachtwoord
                    <input
                      className={`${fieldClassName()} brand-input`}
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      placeholder="Minimaal 8 tekens"
                      minLength={8}
                      required
                    />
                  </label>
                </div>

                {loginError ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {loginError}
                  </p>
                ) : null}

                <Button type="submit" size="lg" className="w-full bg-teal-700 hover:bg-teal-800">
                  Inloggen
                </Button>
              </form>
                ) : (
                  <form action="/api/auth/setup" method="post" className="space-y-5">
                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="text-sm font-medium text-slate-800">
                        Naam sportschool
                        <input
                          className={`${fieldClassName()} brand-input`}
                          type="text"
                          name="tenantName"
                          autoComplete="organization"
                          placeholder="Bijvoorbeeld: Northside Athletics"
                          required
                        />
                      </label>

                      <label className="text-sm font-medium text-slate-800">
                        Naam eigenaar
                        <input
                          className={`${fieldClassName()} brand-input`}
                          type="text"
                          name="ownerName"
                          autoComplete="name"
                          placeholder="Bijvoorbeeld: Amina Hassan"
                          required
                        />
                      </label>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="text-sm font-medium text-slate-800">
                        E-mailadres eigenaar
                        <input
                          className={`${fieldClassName()} brand-input`}
                          type="email"
                          name="ownerEmail"
                          autoComplete="username"
                          placeholder="eigenaar@jouwgym.nl"
                          required
                        />
                      </label>

                      <label className="text-sm font-medium text-slate-800">
                        Wachtwoord
                        <input
                          className={`${fieldClassName()} brand-input`}
                          type="password"
                          name="password"
                          autoComplete="new-password"
                          placeholder="Minimaal 8 tekens"
                          minLength={8}
                          required
                        />
                      </label>
                    </div>

                    {setupError ? (
                      <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {setupError}
                      </p>
                    ) : null}

                    <Button type="submit" size="lg" className="w-full bg-teal-700 hover:bg-teal-800">
                      Gym owner aanmelden
                    </Button>
                  </form>
                )}
              </div>
            ) : (
              <form action="/api/auth/setup" method="post" className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="text-sm font-medium text-slate-800">
                    Naam sportschool
                    <input
                      className={`${fieldClassName()} brand-input`}
                      type="text"
                      name="tenantName"
                      autoComplete="organization"
                      placeholder="Bijvoorbeeld: Northside Athletics"
                      required
                    />
                  </label>

                  <label className="text-sm font-medium text-slate-800">
                    Naam eigenaar
                    <input
                      className={`${fieldClassName()} brand-input`}
                      type="text"
                      name="ownerName"
                      autoComplete="name"
                      placeholder="Bijvoorbeeld: Amina Hassan"
                      required
                    />
                  </label>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="text-sm font-medium text-slate-800">
                    E-mailadres eigenaar
                    <input
                      className={`${fieldClassName()} brand-input`}
                      type="email"
                      name="ownerEmail"
                      autoComplete="username"
                      placeholder="eigenaar@jouwgym.nl"
                      required
                    />
                  </label>

                  <label className="text-sm font-medium text-slate-800">
                    Wachtwoord
                    <input
                      className={`${fieldClassName()} brand-input`}
                      type="password"
                      name="password"
                      autoComplete="new-password"
                      placeholder="Minimaal 8 tekens"
                      minLength={8}
                      required
                    />
                  </label>
                </div>

                {setupError ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {setupError}
                  </p>
                ) : null}

                <Button type="submit" size="lg" className="w-full bg-teal-700 hover:bg-teal-800">
                  Eerste gym aanmelden
                </Button>
              </form>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <LoginExperiencePanel
            accountCount={accounts.length}
            isSetupComplete={isSetupComplete}
          />

          <section className="section-shell space-y-6">
          <div className="space-y-3">
            <p className="eyebrow">
              {isSetupComplete ? "Beschikbare rollen" : "Wat je hierna kunt doen"}
            </p>
            <h2 className="text-2xl font-semibold text-slate-950">
              {isSetupComplete ? "Werk met echte teamaccounts" : "Leeg starten, daarna opbouwen"}
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              {isSetupComplete
                ? `Er ${accounts.length === 1 ? "is" : "zijn"} nu ${accounts.length} account${accounts.length === 1 ? "" : "s"} beschikbaar. Voeg later extra teamleden toe vanuit het platform.`
                : "Na de eerste inrichting kun je zelf locaties, memberships, trainers, leden, lessen en teamleden invoeren."}
            </p>
          </div>

          {isSetupComplete ? (
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                <p className="font-medium text-slate-900">Leden reserveren per gym</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Elke gym heeft zijn eigen publieke reserveringsflow. Kies hieronder
                  een club om direct de juiste member experience te openen.
                </p>
              </div>
              {tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="rounded-2xl border border-slate-200/70 bg-slate-950/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{tenant.name}</p>
                      <p className="mt-1 text-sm text-slate-500">Gym slug: {tenant.id}</p>
                    </div>
                    <Button asChild variant="outline" className="bg-white">
                      <Link href={`/reserve?gym=${tenant.id}`}>Open reserveringspagina</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-3">
            {PLATFORM_ROLE_OPTIONS.map((role) => {
              const matches = accounts.filter((account) => account.roleKey === role.key);

              return (
                <div
                  key={role.key}
                  className="rounded-2xl border border-slate-200/70 bg-slate-950/[0.03] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{role.label}</p>
                    <Badge variant={role.badgeVariant}>{role.scopeLabel}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {role.description}
                  </p>
                  {isSetupComplete ? (
                    <p className="mt-3 text-sm text-slate-500">
                      {matches.length > 0
                        ? `${matches.length} account${matches.length === 1 ? "" : "s"}: ${matches
                            .map(
                              (account) =>
                                `${account.displayName} (${tenantNameById.get(account.tenantId) ?? account.tenantId})`,
                            )
                            .join(", ")}`
                        : `Nog geen ${getRoleLabel(role.key).toLowerCase()} toegevoegd.`}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
