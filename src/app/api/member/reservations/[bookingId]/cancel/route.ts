import type { NextRequest } from "next/server";
import { AppError } from "@claimtech/core";
import { z } from "zod";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import {
  requireRateLimitedMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const memberCancelReservationSchema = z.object({
  expectedVersion: z.number().int().positive(),
  tenantSlug: z.string().min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      bookingId: string;
    }>;
  },
) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);

    if (viewer.roleKey !== "member") {
      throw new AppError("Deze actie is alleen beschikbaar voor leden.", {
        code: "FORBIDDEN",
      });
    }

    const services = await getGymPlatformServices();
    await requireRateLimitedMutationSecurity(request, {
      rateLimit: {
        scope: "member.reservation-cancel",
        maxRequests: 12,
        windowMs: 10 * 60_000,
      },
    });
    const payload = memberCancelReservationSchema.parse(await request.json());
    const { bookingId } = await context.params;

    return services.cancelMemberReservation(viewer.actor, {
      bookingId,
      expectedVersion: payload.expectedVersion,
      tenantSlug: payload.tenantSlug,
    });
  });
}
