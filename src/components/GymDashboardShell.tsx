import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GymDashboardClientShell } from "@/components/GymDashboardClientShell";
import type { DashboardPageKey } from "@/lib/dashboard-pages";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";
import { getMembershipRole } from "@/server/runtime/platform-roles";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

export async function GymDashboardShell({
  currentPage,
  asTenantId,
}: {
  currentPage: DashboardPageKey;
  asTenantId?: string;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const viewer = await resolveViewerFromToken(token);

  if (!viewer) {
    redirect("/login");
  }

  if (viewer.roleKey === "member") {
    redirect("/reserve");
  }

  const services = await getGymPlatformServices();
  const isSuperadmin = viewer.actor.globalRoles.includes(
    getMembershipRole("superadmin"),
  );
  const effectiveTenantContext =
    isSuperadmin && asTenantId && asTenantId !== viewer.tenantContext.tenantId
      ? services.createRequestTenantContext(viewer.actor, asTenantId)
      : viewer.tenantContext;
  const snapshot = await services.getDashboardSnapshot(
    viewer.actor,
    effectiveTenantContext,
    { page: currentPage },
  );

  return (
    <GymDashboardClientShell
      currentPage={currentPage}
      roleLabel={viewer.roleLabel}
      snapshot={snapshot}
      tenantId={effectiveTenantContext.tenantId}
    />
  );
}
