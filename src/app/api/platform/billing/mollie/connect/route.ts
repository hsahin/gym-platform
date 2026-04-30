import { NextResponse, type NextRequest } from "next/server";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getRequestId, jsonError } from "@/server/http/platform-api";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    const { authorizationUrl } = await services.startMollieConnect(
      viewer.actor,
      viewer.tenantContext,
    );

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    return jsonError(getRequestId(request), error);
  }
}
