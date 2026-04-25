import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const retentionSettingsSchema = z.object({
  retentionCadence: z.enum(["weekly", "biweekly", "monthly"]),
  communityChannel: z.string().min(2),
  challengeTheme: z.string().min(2),
  questionnaireTrigger: z.string().min(2),
  proContentPath: z.string(),
  fitZoneOffer: z.string().min(2),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);

      return services.updateRetentionWorkspace(
        viewer.actor,
        viewer.tenantContext,
        retentionSettingsSchema.parse(await request.json()),
      );
    },
    { successStatus: 201 },
  );
}
