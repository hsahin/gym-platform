import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const revenueSettingsSchema = z.object({
  webshopCollectionName: z.string().min(2),
  pointOfSaleMode: z.enum(["frontdesk", "kiosk", "hybrid"]),
  cardTerminalLabel: z.string().min(2),
  autocollectPolicy: z.string().min(2),
  directDebitLeadDays: z.coerce.number().int().min(1),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);

      return services.updateRevenueWorkspace(
        viewer.actor,
        viewer.tenantContext,
        revenueSettingsSchema.parse(await request.json()),
      );
    },
    { successStatus: 201 },
  );
}
