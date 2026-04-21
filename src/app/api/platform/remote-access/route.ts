import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const updateRemoteAccessSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["nuki", "salto_ks", "tedee", "yale_smart"]),
  bridgeType: z.enum(["cloud_api", "bridge", "hub"]),
  locationId: z.string().min(1).nullable().optional(),
  deviceLabel: z.string().min(2),
  externalDeviceId: z.string().min(2),
  notes: z.string().max(280).optional(),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = updateRemoteAccessSchema.parse(await request.json());

      return services.updateRemoteAccessSettings(
        viewer.actor,
        viewer.tenantContext,
        {
          enabled: payload.enabled,
          provider: payload.provider,
          bridgeType: payload.bridgeType,
          locationId: payload.locationId ?? null,
          deviceLabel: payload.deviceLabel,
          externalDeviceId: payload.externalDeviceId,
          notes: payload.notes,
        },
      );
    },
    { successStatus: 201 },
  );
}
