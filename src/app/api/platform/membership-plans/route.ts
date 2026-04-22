import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createMembershipPlanSchema = z.object({
  name: z.string().min(2),
  priceMonthly: z.number().positive(),
  billingCycle: z.enum(["monthly", "semiannual", "annual"]),
  perks: z.array(z.string().min(1)).default([]),
});
const updateMembershipPlanSchema = createMembershipPlanSchema.extend({
  id: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  status: z.enum(["active", "paused", "archived"]),
});
const entityMutationSchema = z.object({
  id: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    const snapshot = await services.getDashboardSnapshot(
      viewer.actor,
      viewer.tenantContext,
    );
    return snapshot.membershipPlans;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = createMembershipPlanSchema.parse(await request.json());

      return services.createMembershipPlan(
        viewer.actor,
        viewer.tenantContext,
        payload,
      );
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
      return services.archiveMembershipPlan(
        viewer.actor,
        viewer.tenantContext,
        entityMutationSchema.parse(payload),
      );
    }

    return services.updateMembershipPlan(
      viewer.actor,
      viewer.tenantContext,
      updateMembershipPlanSchema.parse(payload),
    );
  });
}

export async function DELETE(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    await services.deleteMembershipPlan(
      viewer.actor,
      viewer.tenantContext,
      entityMutationSchema.parse(await request.json()),
    );
    return { deleted: true };
  });
}
