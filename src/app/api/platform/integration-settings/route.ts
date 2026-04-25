import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const integrationSettingsSchema = z.object({
  hardwareVendors: z.array(z.string()),
  softwareIntegrations: z.array(z.string()),
  equipmentIntegrations: z.array(z.string()),
  migrationProvider: z.string().min(2),
  bodyCompositionProvider: z.string(),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);

      return services.updateIntegrationWorkspace(
        viewer.actor,
        viewer.tenantContext,
        integrationSettingsSchema.parse(await request.json()),
      );
    },
    { successStatus: 201 },
  );
}
