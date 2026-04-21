import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const cancelBookingSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export async function PATCH(
  request: NextRequest,
  context: {
    params: {
      bookingId: string;
    };
  },
) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    const payload = cancelBookingSchema.parse(await request.json());

    return services.cancelBooking(viewer.actor, viewer.tenantContext, {
      bookingId: context.params.bookingId,
      expectedVersion: payload.expectedVersion,
    });
  });
}
