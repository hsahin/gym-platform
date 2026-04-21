import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createClassSchema = z.object({
  title: z.string().min(2),
  locationId: z.string().min(1),
  trainerId: z.string().min(1),
  startsAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  capacity: z.number().int().positive(),
  level: z.enum(["beginner", "mixed", "advanced"]),
  focus: z.string().min(2),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    return services.listClassSessions(viewer.actor, viewer.tenantContext);
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = createClassSchema.parse(await request.json());

      return services.createClassSession(viewer.actor, viewer.tenantContext, payload);
    },
    { successStatus: 201 },
  );
}
