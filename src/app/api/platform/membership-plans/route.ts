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
