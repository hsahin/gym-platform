import { notFound } from "next/navigation";
import { GymDashboardShell } from "@/components/GymDashboardShell";
import {
  resolveDashboardRouteKey,
} from "@/lib/dashboard-pages";

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{
    section: string;
  }>;
}) {
  const { section } = await params;
  const currentPage = resolveDashboardRouteKey(section);

  if (!currentPage || currentPage === "overview") {
    notFound();
  }

  return <GymDashboardShell currentPage={currentPage} />;
}
