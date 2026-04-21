import type { NextRequest } from "next/server";
import { runApiHandler } from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    return services.getDashboardSnapshot(viewer.actor, viewer.tenantContext);
  });
}
