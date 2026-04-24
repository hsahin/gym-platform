import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const attendanceSchema = z.object({
  expectedVersion: z.number().int().positive(),
  channel: z.enum(["qr", "frontdesk", "coach"]),
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
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    const payload = attendanceSchema.parse(await request.json());
    const { bookingId } = await context.params;

    return services.recordAttendance(viewer.actor, viewer.tenantContext, {
      bookingId,
      expectedVersion: payload.expectedVersion,
      channel: payload.channel,
    });
  });
}
