import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const featureFlagSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);

      return services.updateFeatureFlag(
        viewer.actor,
        viewer.tenantContext,
        featureFlagSchema.parse(await request.json()),
      );
    },
    { successStatus: 201 },
  );
}
