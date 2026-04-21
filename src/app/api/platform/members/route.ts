import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createMemberSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(3),
  phoneCountry: z.string().length(2),
  membershipPlanId: z.string().min(1),
  homeLocationId: z.string().min(1),
  status: z.enum(["active", "trial", "paused"]),
  tags: z.array(z.string().min(1)).default([]),
  waiverStatus: z.enum(["complete", "pending"]),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    return services.listMembers(viewer.actor, viewer.tenantContext);
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = createMemberSchema.parse(await request.json());

      return services.createMember(viewer.actor, viewer.tenantContext, {
        ...payload,
        phoneCountry: payload.phoneCountry as never,
      });
    },
    { successStatus: 201 },
  );
}
