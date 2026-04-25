import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const coachingSettingsSchema = z.object({
  workoutPlanFocus: z.string().min(2),
  nutritionCadence: z.enum(["weekly", "biweekly", "monthly"]),
  videoLibraryUrl: z.string(),
  progressMetric: z.string().min(2),
  heartRateProvider: z.string().min(2),
  aiCoachMode: z.string().min(2),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);

      return services.updateCoachingWorkspace(
        viewer.actor,
        viewer.tenantContext,
        coachingSettingsSchema.parse(await request.json()),
      );
    },
    { successStatus: 201 },
  );
}
