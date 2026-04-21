import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createTrainerSchema = z.object({
  fullName: z.string().min(2),
  specialties: z.array(z.string().min(1)).default([]),
  certifications: z.array(z.string().min(1)).default([]),
  homeLocationId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = createTrainerSchema.parse(await request.json());

      return services.createTrainer(viewer.actor, viewer.tenantContext, payload);
    },
    { successStatus: 201 },
  );
}
