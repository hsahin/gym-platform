import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const mobileSettingsSchema = z.object({
  appDisplayName: z.string().min(2),
  onboardingHeadline: z.string().min(2),
  supportChannel: z.string().min(2),
  primaryAccent: z.string().min(4),
  checkInMode: z.enum(["qr", "frontdesk", "hybrid"]),
  whiteLabelDomain: z.string(),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);

      return services.updateMobileExperience(
        viewer.actor,
        viewer.tenantContext,
        mobileSettingsSchema.parse(await request.json()),
      );
    },
    { successStatus: 201 },
  );
}
