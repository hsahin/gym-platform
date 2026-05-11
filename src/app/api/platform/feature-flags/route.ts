import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";
import { getMembershipRole } from "@/server/runtime/platform-roles";

const featureFlagSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
  tenantId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = featureFlagSchema.parse(await request.json());

      // A superadmin may toggle flags for any tenant by passing `tenantId`.
      // Non-superadmin viewers always act on their own tenant context;
      // the optional tenantId is ignored in that case.
      const isSuperadmin = viewer.actor.globalRoles.includes(
        getMembershipRole("superadmin"),
      );
      const tenantContext =
        isSuperadmin &&
        payload.tenantId &&
        payload.tenantId !== viewer.tenantContext.tenantId
          ? services.createRequestTenantContext(viewer.actor, payload.tenantId)
          : viewer.tenantContext;

      return services.updateFeatureFlag(viewer.actor, tenantContext, {
        key: payload.key,
        enabled: payload.enabled,
      });
    },
    { successStatus: 201 },
  );
}
