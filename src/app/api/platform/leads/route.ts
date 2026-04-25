import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createLeadSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(3),
  source: z.enum(["website", "instagram", "referral", "walk_in", "meta_ads", "booking"]),
  stage: z.enum(["new", "contacted", "trial_scheduled", "won", "lost"]),
  interest: z.string().min(2),
  notes: z.string().optional(),
  assignedStaffName: z.string().optional(),
  expectedValueCents: z.number().int().nonnegative().optional(),
});

const updateLeadSchema = z.object({
  id: z.string().min(1),
  stage: z.enum(["new", "contacted", "trial_scheduled", "won", "lost"]),
  notes: z.string().optional(),
  assignedStaffName: z.string().optional(),
});

const convertLeadSchema = z.object({
  operation: z.literal("convert"),
  leadId: z.string().min(1),
  membershipPlanId: z.string().min(1),
  homeLocationId: z.string().min(1),
  status: z.enum(["active", "trial", "paused", "archived"]),
  tags: z.array(z.string().min(1)).default([]),
  waiverStatus: z.enum(["complete", "pending"]),
  portalPassword: z.string().min(8).optional(),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    return (await services.getDashboardSnapshot(viewer.actor, viewer.tenantContext)).leads;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      return services.createLead(
        viewer.actor,
        viewer.tenantContext,
        createLeadSchema.parse(await request.json()),
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
      payload.operation === "convert"
    ) {
      return services.convertLeadToMember(
        viewer.actor,
        viewer.tenantContext,
        convertLeadSchema.parse(payload),
      );
    }

    return services.updateLead(
      viewer.actor,
      viewer.tenantContext,
      updateLeadSchema.parse(payload),
    );
  });
}
