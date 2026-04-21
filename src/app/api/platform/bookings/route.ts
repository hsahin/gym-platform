import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createBookingSchema = z.object({
  classSessionId: z.string().min(1),
  memberId: z.string().min(1),
  phone: z.string().min(3).optional(),
  phoneCountry: z.string().length(2).optional(),
  notes: z.string().max(280).optional(),
  source: z.enum(["frontdesk", "coach", "member_app"]).optional(),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    return services.listBookings(viewer.actor, viewer.tenantContext);
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      const { idempotencyKey } = requireMutationSecurity(request);
      const payload = createBookingSchema.parse(await request.json());

      return services.createBooking(viewer.actor, viewer.tenantContext, {
        ...payload,
        idempotencyKey,
        phoneCountry: payload.phoneCountry as never,
      });
    },
    { successStatus: 201 },
  );
}
