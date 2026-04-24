import { GymDashboardShell } from "@/components/GymDashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardIndexPage() {
  return <GymDashboardShell currentPage="overview" />;
}
