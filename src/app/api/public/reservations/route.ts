import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createPublicReservationSchema = z.object({
  tenantSlug: z.string().min(2).optional(),
  classSessionId: z.string().min(1),
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email(),
  phone: z.string().min(3),
  phoneCountry: z.string().length(2).optional(),
  notes: z.string().max(280).optional(),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = createPublicReservationSchema.parse(await request.json());

      return services.createPublicReservation({
        tenantSlug: payload.tenantSlug,
        classSessionId: payload.classSessionId,
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        phoneCountry: payload.phoneCountry as never,
        notes: payload.notes,
      });
    },
    { successStatus: 201 },
  );
}
