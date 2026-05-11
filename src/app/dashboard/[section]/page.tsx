import { notFound } from "next/navigation";
import { GymDashboardShell } from "@/components/GymDashboardShell";
import {
  resolveDashboardRouteKey,
} from "@/lib/dashboard-pages";

export default async function DashboardSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{
    section: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  const currentPage = resolveDashboardRouteKey(section);

  if (!currentPage || currentPage === "overview") {
    notFound();
  }

  const search = (await searchParams) ?? {};
  const asTenantRaw = search.asTenant;
  const asTenantId = Array.isArray(asTenantRaw) ? asTenantRaw[0] : asTenantRaw;

  return <GymDashboardShell currentPage={currentPage} asTenantId={asTenantId} />;
}
