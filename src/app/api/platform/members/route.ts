import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const memberSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(3),
  phoneCountry: z.string().length(2),
  membershipPlanId: z.string().min(1),
  homeLocationId: z.string().min(1),
  status: z.enum(["active", "trial", "paused", "archived"]),
  tags: z.array(z.string().min(1)).default([]),
  waiverStatus: z.enum(["complete", "pending"]),
});
const createMemberSchema = memberSchema.extend({
  portalPassword: z.string().min(8).optional(),
});
const updateMemberSchema = memberSchema.extend({
  id: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});
const entityMutationSchema = z.object({
  id: z.string().min(1),
  expectedVersion: z.number().int().positive(),
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

export async function PATCH(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    const payload = await request.json();

    if (
      typeof payload === "object" &&
      payload !== null &&
      "operation" in payload &&
      payload.operation === "archive"
    ) {
      return services.archiveMember(
        viewer.actor,
        viewer.tenantContext,
        entityMutationSchema.parse(payload),
      );
    }

    const parsed = updateMemberSchema.parse(payload);
    return services.updateMember(viewer.actor, viewer.tenantContext, {
      ...parsed,
      phoneCountry: parsed.phoneCountry as never,
    });
  });
}

export async function DELETE(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    await services.deleteMember(
      viewer.actor,
      viewer.tenantContext,
      entityMutationSchema.parse(await request.json()),
    );
    return { deleted: true };
  });
}
