import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Button } from "@claimtech/ui";
import { GymDashboard } from "@/components/GymDashboard";
import { getDashboardExperience } from "@/lib/dashboard-experience";
import type { DashboardPageKey } from "@/lib/dashboard-pages";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

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
  const dashboardExperience = getDashboardExperience({
    locationsCount: snapshot.locations.length,
    membershipPlansCount: snapshot.membershipPlans.length,
    trainersCount: snapshot.trainers.length,
    membersCount: snapshot.members.length,
    classSessionsCount: snapshot.classSessions.length,
    bookingsCount: snapshot.bookings.length,
    healthAttentionCount: snapshot.healthReport.checks.filter(
      (check) => check.status !== "healthy",
    ).length,
  });

  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="spotlight-shell relative overflow-hidden">
          <div className="absolute inset-y-0 right-0 hidden w-80 bg-gradient-to-l from-[#ffd9bf]/70 to-transparent lg:block" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{viewer.roleLabel}</Badge>
                <Badge variant="outline">{snapshot.tenantName}</Badge>
                <span className="metric-chip">
                  {dashboardExperience.isLaunchMode ? "Launch actief" : "Live operatie"}
                </span>
              </div>
              <div className="space-y-3">
                <p className="eyebrow">Owner dashboard</p>
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                  {dashboardExperience.pageHeroTitle}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                  {dashboardExperience.pageHeroDescription}
                </p>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
              <p className="eyebrow">Nu actief</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {snapshot.actorName}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {dashboardExperience.isLaunchMode
                  ? `${viewer.roleLabel} binnen ${snapshot.tenantName}. Werk je basis af en ga daarna door met leden, betalingen en teamrollen.`
                  : `${viewer.roleLabel} binnen ${snapshot.tenantName}. Je werkt in de owner-omgeving van deze gym.`}
              </p>

              <div className="mt-5 flex flex-col gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-teal-700 hover:bg-teal-800"
                >
                  <Link href="/login">Andere gebruiker</Link>
                </Button>
                <form action="/api/auth/logout" method="post">
                  <Button
                    type="submit"
                    variant="outline"
                    size="lg"
                    className="w-full bg-white"
                  >
                    Uitloggen
                  </Button>
                </form>
                <Button asChild variant="outline" size="lg" className="w-full bg-white">
                  <Link href={`/reserve?gym=${viewer.tenantContext.tenantId}`}>
                    Publieke reserveringspagina
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <GymDashboard snapshot={snapshot} currentPage={currentPage} />
      </div>
    </main>
  );
}
