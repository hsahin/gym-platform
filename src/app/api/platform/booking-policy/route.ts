import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const bookingPolicySchema = z.object({
  cancellationWindowHours: z.number().int().nonnegative(),
  lateCancelFeeCents: z.number().int().nonnegative(),
  noShowFeeCents: z.number().int().nonnegative(),
  maxDailyBookingsPerMember: z.number().int().positive(),
  maxDailyWaitlistPerMember: z.number().int().positive(),
  autoPromoteWaitlist: z.boolean(),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    return (await services.getDashboardSnapshot(viewer.actor, viewer.tenantContext))
      .bookingPolicy;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    return services.updateBookingPolicy(
      viewer.actor,
      viewer.tenantContext,
      bookingPolicySchema.parse(await request.json()),
    );
  });
}
