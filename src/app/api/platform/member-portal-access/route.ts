import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const memberPortalAccessSchema = z.object({
  memberId: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = memberPortalAccessSchema.parse(await request.json());

      return services.setMemberPortalPassword(viewer.actor, viewer.tenantContext, payload);
    },
    { successStatus: 201 },
  );
}
