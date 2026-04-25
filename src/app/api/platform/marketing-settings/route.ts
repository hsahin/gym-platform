import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const marketingSettingsSchema = z.object({
  emailSenderName: z.string().min(2),
  emailReplyTo: z.string().min(3),
  promotionHeadline: z.string().min(2),
  leadPipelineLabel: z.string().min(2),
  automationCadence: z.enum(["weekly", "biweekly", "monthly"]),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);

      return services.updateMarketingWorkspace(
        viewer.actor,
        viewer.tenantContext,
        marketingSettingsSchema.parse(await request.json()),
      );
    },
    { successStatus: 201 },
  );
}
