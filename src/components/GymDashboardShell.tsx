import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GymDashboard } from "@/components/GymDashboard";
import { GymOsNavigation } from "@/components/GymOsNavigation";
import type { DashboardPageKey } from "@/lib/dashboard-pages";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const pageCopy: Record<
  DashboardPageKey,
  { eyebrow: string; title: string; description: string; actionLabel: string; actionHref: string }
> = {
  overview: {
    eyebrow: "Owner command center",
    title: "Run je gym als een premium operatie.",
    description:
      "Alle facts die een eigenaar nodig heeft: leden, reserveringen, omzetprojectie, teamstatus en aandachtspunten in een donkere GymOS-interface.",
    actionLabel: "Publieke booking openen",
    actionHref: "/reserve",
  },
  classes: {
    eyebrow: "Schedule & bookings",
    title: "Rooster, bezetting en check-ins zonder frictie.",
    description:
      "Bekijk lessen, reserveringen, wachtlijsten en plan nieuwe sessies vanuit dezelfde operationele flow.",
    actionLabel: "Nieuwe les plannen",
    actionHref: "#classes-workbench",
  },
  members: {
    eyebrow: "Member intelligence",
    title: "Zie welke leden groeien, pauzeren of aandacht nodig hebben.",
    description:
      "Leden, waivers, contractstatus en intake-signalen komen samen in een overzicht dat snel stuurbaar is.",
    actionLabel: "Lid toevoegen",
    actionHref: "#members-workbench",
  },
  contracts: {
    eyebrow: "Contracts",
    title: "Maand, halfjaar en jaarcontracten helder beheren.",
    description:
      "Contracten, actieve leden, prijzen en import van bestaande klanten blijven zichtbaar en aanpasbaar.",
    actionLabel: "Contract aanmaken",
    actionHref: "#contracts-workbench",
  },
  access: {
    eyebrow: "Smart access",
    title: "Beheer toegang op afstand met Nuki-ready flows.",
    description:
      "Owner-only instellingen voor smartdeurs, toegang op afstand en de laatste unlock-preview zonder technische ruis.",
    actionLabel: "Toegang configureren",
    actionHref: "#access-workbench",
  },
  payments: {
    eyebrow: "Payments",
    title: "Mollie, incasso en betaalverzoeken op één plek.",
    description:
      "Koppel betaalprofielen, test betaalverzoeken en beheer automatische incasso of eenmalige betalingen.",
    actionLabel: "Betalingen instellen",
    actionHref: "#payments-workbench",
  },
  marketing: {
    eyebrow: "Growth",
    title: "Maak van reserveringen retentie- en verkoopmomenten.",
    description:
      "Gebruik bookingdata, segmenten en previews om leden terug te laten komen en twijfelaars te converteren.",
    actionLabel: "Member journey bekijken",
    actionHref: "/reserve",
  },
  settings: {
    eyebrow: "Settings",
    title: "Vestigingen, personeel, imports en status zonder tab-chaos.",
    description:
      "Alle owner-instellingen staan op een volwaardige pagina met duidelijke launchchecks en beheerblokken.",
    actionLabel: "Team beheren",
    actionHref: "#settings-workbench",
  },
};

export async function GymDashboardShell({
  currentPage,
}: {
  currentPage: DashboardPageKey;
}) {
  const services = await getGymPlatformServices();
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const viewer = await resolveViewerFromToken(token);

  if (!viewer) {
    redirect("/login");
  }

  const snapshot = await services.getDashboardSnapshot(
    viewer.actor,
    viewer.tenantContext,
  );
  const copy = pageCopy[currentPage];
  const actionHref =
    copy.actionHref === "/reserve"
      ? `/reserve?gym=${viewer.tenantContext.tenantId}`
      : copy.actionHref;

  return (
    <div className="gym-os-root min-h-screen bg-[#0a0a0a] text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute right-[-10%] top-[-20%] h-[560px] w-[560px] rounded-full bg-orange-500/10 blur-[150px]" />
        <div className="absolute bottom-[-20%] left-[-10%] h-[460px] w-[460px] rounded-full bg-orange-600/8 blur-[120px]" />
      </div>

      <GymOsNavigation
        currentPage={currentPage}
        tenantName={snapshot.tenantName}
        actorName={snapshot.actorName}
        roleLabel={viewer.roleLabel}
      />

      <main className="relative z-10 pt-[73px] lg:ml-[260px] lg:pt-0">
        <header className="sticky top-[57px] z-30 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl lg:top-0">
          <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300">
                  {copy.eyebrow}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/50">
                  {snapshot.tenantName}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/50">
                  {viewer.roleLabel}
                </span>
              </div>
              <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-white md:text-5xl">
                {copy.title}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-white/50 md:text-base">
                {copy.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href={actionHref} className="gym-os-button">
                {copy.actionLabel}
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="gym-os-button-secondary">
                  Uitloggen
                </button>
              </form>
            </div>
          </div>
        </header>

        <GymDashboard snapshot={snapshot} currentPage={currentPage} />
      </main>
    </div>
  );
}
