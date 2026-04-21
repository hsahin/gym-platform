import { notFound } from "next/navigation";
import { GymDashboardShell } from "@/components/GymDashboardShell";
import {
  isDashboardPageKey,
  type DashboardPageKey,
} from "@/lib/dashboard-pages";

export default async function DashboardSectionPage({
  params,
}: {
  params: {
    section: string;
  };
}) {
  if (!isDashboardPageKey(params.section) || params.section === "overview") {
    notFound();
  }

  return (
    <GymDashboardShell currentPage={params.section as DashboardPageKey} />
  );
}
