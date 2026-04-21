import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createLocationSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  neighborhood: z.string().min(2),
  capacity: z.number().int().positive(),
  managerName: z.string().min(2),
  amenities: z.array(z.string().min(1)).default([]),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    return services.listLocations(viewer.actor, viewer.tenantContext);
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = createLocationSchema.parse(await request.json());

      return services.createLocation(viewer.actor, viewer.tenantContext, payload);
    },
    { successStatus: 201 },
  );
}
