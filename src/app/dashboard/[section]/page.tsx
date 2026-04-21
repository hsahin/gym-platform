import { notFound } from "next/navigation";
import { GymDashboardShell } from "@/components/GymDashboardShell";
import {
  resolveDashboardRouteKey,
} from "@/lib/dashboard-pages";

export default async function DashboardSectionPage({
  params,
}: {
  params: {
    section: string;
  };
}) {
  const currentPage = resolveDashboardRouteKey(params.section);

  if (!currentPage || currentPage === "overview") {
    notFound();
  }

  return <GymDashboardShell currentPage={currentPage} />;
}
