import { cookies } from "next/headers";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  GymOsAmbient,
  GymOsBadge,
  GymOsLogo,
  ShieldIcon,
  UsersIcon,
  ZapIcon,
} from "@/components/GymOsPrimitives";
import {
  hasLocalPlatformSetup,
  listLocalPlatformAccounts,
  listLocalTenants,
} from "@/server/persistence/local-platform-state";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";
import { PLATFORM_ROLE_OPTIONS } from "@/server/runtime/platform-roles";

function readSearchParam(
  value: string | ReadonlyArray<string> | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
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
  const loginError = readSearchParam(searchParams?.error);
  const setupError = readSearchParam(searchParams?.setupError);
  const mode =
    !isSetupComplete || readSearchParam(searchParams?.mode) === "signup"
      ? "signup"
      : "login";

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white lg:flex">
      <GymOsAmbient />

      <section className="relative z-10 flex flex-1 flex-col justify-center px-6 py-10 md:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <GymOsLogo className="mb-12" />

          <div className="mb-10">
            <div className="mb-4 flex flex-wrap gap-2">
              <GymOsBadge>{mode === "login" ? "Team login" : "Nieuwe gym aanmelden"}</GymOsBadge>
              {viewer ? <GymOsBadge tone="green">Actieve sessie: {viewer.roleLabel}</GymOsBadge> : null}
            </div>
            <h1 className="mb-4 text-3xl font-bold leading-tight text-white md:text-4xl">
              {mode === "login"
                ? "Welkom terug in je gym cockpit"
                : "Lanceer je gym zonder admin-chaos"}
            </h1>
            <p className="text-lg leading-8 text-white/50">
              {mode === "login"
                ? "Log in als owner, manager, trainer of frontdesk en beheer je operatie per sportschool."
                : "Maak een nieuwe gym aan met een owner-account. Daarna beheer je leden, contracten, betalingen, reserveringen en smartdeurs."}
            </p>
          </div>

          {isSetupComplete ? (
            <div className="mb-8 grid grid-cols-2 gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1.5">
              <Link
                href="/login"
                className={`rounded-xl px-4 py-3 text-center text-sm font-medium transition ${
                  mode === "login"
                    ? "bg-white text-zinc-950"
                    : "text-white/55 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                Inloggen
              </Link>
              <Link
                href="/login?mode=signup"
                className={`rounded-xl px-4 py-3 text-center text-sm font-medium transition ${
                  mode === "signup"
                    ? "bg-white text-zinc-950"
                    : "text-white/55 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                Nieuwe gym
              </Link>
            </div>
          ) : null}

          {mode === "login" && isSetupComplete ? (
            <form action="/api/auth/login" method="post" className="space-y-6">
              <label className="block space-y-2 text-sm font-medium text-white/70">
                <span>Sportschool</span>
                <select
                  className="gym-os-select"
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

              <label className="block space-y-2 text-sm font-medium text-white/70">
                <span>E-mailadres</span>
                <input
                  className="gym-os-input"
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="owner@jouwgym.nl"
                  required
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-white/70">
                <span>Wachtwoord</span>
                <input
                  className="gym-os-input"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="Minimaal 8 tekens"
                  minLength={8}
                  required
                />
              </label>

              {loginError ? (
                <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {loginError}
                </p>
              ) : null}

              <button type="submit" className="gym-os-button h-12 w-full">
                Inloggen
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <form action="/api/auth/setup" method="post" className="space-y-6">
              <label className="block space-y-2 text-sm font-medium text-white/70">
                <span>Naam sportschool</span>
                <input
                  className="gym-os-input"
                  type="text"
                  name="tenantName"
                  autoComplete="organization"
                  placeholder="Bijvoorbeeld: Northside Athletics"
                  required
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-white/70">
                <span>Naam eigenaar</span>
                <input
                  className="gym-os-input"
                  type="text"
                  name="ownerName"
                  autoComplete="name"
                  placeholder="Bijvoorbeeld: Amina Hassan"
                  required
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-white/70">
                <span>E-mailadres eigenaar</span>
                <input
                  className="gym-os-input"
                  type="email"
                  name="ownerEmail"
                  autoComplete="username"
                  placeholder="eigenaar@jouwgym.nl"
                  required
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-white/70">
                <span>Wachtwoord</span>
                <input
                  className="gym-os-input"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="Minimaal 8 tekens"
                  minLength={8}
                  required
                />
              </label>

              {setupError ? (
                <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {setupError}
                </p>
              ) : null}

              <button type="submit" className="gym-os-button h-12 w-full">
                Gym owner aanmelden
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </form>
          )}

          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-sm text-white/30">of</span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/reserve" className="gym-os-button-secondary h-12">
              Boek als lid
            </Link>
            <Link href="/" className="gym-os-button-secondary h-12">
              Terug naar site
            </Link>
          </div>
        </div>
      </section>

      <aside className="relative z-10 border-t border-white/[0.06] bg-white/[0.02] px-6 py-10 md:px-10 lg:flex lg:w-[520px] lg:flex-col lg:justify-center lg:border-l lg:border-t-0 xl:w-[620px] xl:p-16">
        <div className="mx-auto w-full max-w-xl space-y-10">
          <div className="space-y-6">
            {[
              {
                title: "Owner-ready vanaf minuut één",
                copy: "Je maakt hier geen workspace aan, maar een echte gym-tenant met eigen team, data en member flow.",
                icon: ShieldIcon,
              },
              {
                title: "Teamrollen zonder verwarring",
                copy: "Owner, manager, trainer en frontdesk hebben een duidelijke ingang en beheercontext.",
                icon: UsersIcon,
              },
              {
                title: "Reserveren blijft publiek",
                copy: "Leden hoeven niet in te loggen om een les te boeken; de booking komt direct in beheer terecht.",
                icon: ZapIcon,
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
                  <item.icon className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="mb-1 font-semibold text-white">{item.title}</h2>
                  <p className="text-sm leading-6 text-white/40">{item.copy}</p>
                </div>
              </div>
            ))}
          </div>

          {isSetupComplete ? (
            <div className="glass-card p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-white/30">
                    Live platform
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {tenants.length} gyms · {accounts.length} accounts
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <CheckIcon className="h-5 w-5 text-emerald-400" />
                </div>
              </div>
              <div className="grid gap-3">
                {tenants.slice(0, 4).map((tenant) => (
                  <Link
                    key={tenant.id}
                    href={`/reserve?gym=${tenant.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]"
                  >
                    <span className="text-sm font-medium text-white">{tenant.name}</span>
                    <span className="text-xs text-orange-300">reserveren</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="glass-card p-6">
            <div className="mb-5 flex items-center gap-3">
              <CalendarIcon className="h-5 w-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">
                Beschikbare rollen
              </h2>
            </div>
            <div className="grid gap-3">
              {PLATFORM_ROLE_OPTIONS.map((role) => {
                const count = accounts.filter((account) => account.roleKey === role.key).length;

                return (
                  <div
                    key={role.key}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{role.label}</p>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45">
                        {isSetupComplete ? `${count} account${count === 1 ? "" : "s"}` : role.scopeLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/40">
                      {role.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
