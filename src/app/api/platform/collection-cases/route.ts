import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createCollectionCaseSchema = z.object({
  memberId: z.string().min(1).optional(),
  memberName: z.string().min(2),
  paymentMethod: z.enum([
    "direct_debit",
    "one_time",
    "payment_request",
    "cash",
    "bank_transfer",
  ]),
  status: z.enum(["open", "retrying", "resolved", "cancelled"]),
  amountCents: z.number().int().nonnegative(),
  reason: z.string().min(2),
  dueAt: z.string().min(10),
  notes: z.string().optional(),
});

const updateCollectionCaseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["open", "retrying", "resolved", "cancelled"]),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    return (await services.getDashboardSnapshot(viewer.actor, viewer.tenantContext))
      .collectionCases;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      return services.createCollectionCase(
        viewer.actor,
        viewer.tenantContext,
        createCollectionCaseSchema.parse(await request.json()),
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
    return services.updateCollectionCase(
      viewer.actor,
      viewer.tenantContext,
      updateCollectionCaseSchema.parse(await request.json()),
    );
  });
}
