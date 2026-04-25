import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const reviewSignupSchema = z.object({
  signupRequestId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  ownerNotes: z.string().max(280).optional(),
  memberStatus: z.enum(["active", "trial", "paused", "archived"]).default("trial"),
  portalPassword: z.string().min(8).optional(),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();

    return (await services.getDashboardSnapshot(viewer.actor, viewer.tenantContext)).memberSignups;
  });
}

export async function PATCH(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    const payload = reviewSignupSchema.parse(await request.json());

    return services.reviewMemberSignupRequest(viewer.actor, viewer.tenantContext, payload);
  });
}
