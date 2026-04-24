import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GymDashboardClientShell } from "@/components/GymDashboardClientShell";
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
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const viewer = await resolveViewerFromToken(token);

  if (!viewer) {
    redirect("/login");
  }

  const services = await getGymPlatformServices();
  const snapshot = await services.getDashboardSnapshot(
    viewer.actor,
    viewer.tenantContext,
  );

  return (
    <GymDashboardClientShell
      currentPage={currentPage}
      roleLabel={viewer.roleLabel}
      snapshot={snapshot}
      tenantId={viewer.tenantContext.tenantId}
    />
  );
}
