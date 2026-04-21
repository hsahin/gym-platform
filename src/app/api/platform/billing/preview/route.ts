import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const billingPreviewSchema = z.object({
  paymentMethod: z.enum(["direct_debit", "one_time", "payment_request"]),
  amountCents: z.number().int().positive().max(500_000),
  currency: z.string().trim().length(3).default("EUR"),
  description: z.string().min(2).max(120),
  memberName: z.string().min(2).max(80).optional(),
});

export async function POST(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    const payload = billingPreviewSchema.parse(await request.json());

    return services.requestBillingPreview(viewer.actor, viewer.tenantContext, payload);
  });
}
