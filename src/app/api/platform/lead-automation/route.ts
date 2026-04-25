import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const leadAutomationSchema = z.object({
  trigger: z.enum(["manual", "schedule", "booking_cancellation"]).default("manual"),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();

    return (await services.getDashboardSnapshot(viewer.actor, viewer.tenantContext)).leadAutomation;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    const payload = leadAutomationSchema.parse(await request.json());

    return services.runLeadAutomations(viewer.actor, viewer.tenantContext, payload);
  });
}
