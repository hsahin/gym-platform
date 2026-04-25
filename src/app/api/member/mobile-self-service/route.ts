import type { NextRequest } from "next/server";
import { AppError } from "@claimtech/core";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const memberMobileSelfServiceSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("request_payment_method_update"),
    memberId: z.string().min(1),
    memberName: z.string().min(2),
    requestedMethodLabel: z.string().min(2),
    note: z.string().max(280).optional(),
  }),
  z.object({
    operation: z.literal("request_pause"),
    memberId: z.string().min(1),
    memberName: z.string().min(2),
    startsAt: z.string().min(10),
    endsAt: z.string().min(10),
    reason: z.string().min(2).max(280),
  }),
]);

export async function POST(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);

    if (viewer.roleKey !== "member") {
      throw new AppError("Deze route is alleen voor member self-service.", {
        code: "FORBIDDEN",
      });
    }

    const services = await getGymPlatformServices();
    requireMutationSecurity(request, {
      rateLimit: {
        scope: "member.mobile-self-service",
        maxRequests: 6,
        windowMs: 10 * 60_000,
      },
    });
    const payload = memberMobileSelfServiceSchema.parse(await request.json());

    switch (payload.operation) {
      case "request_payment_method_update":
        return services.requestMobilePaymentMethodUpdate(
          viewer.actor,
          viewer.tenantContext,
          payload,
        );
      case "request_pause":
        return services.requestMembershipPause(viewer.actor, viewer.tenantContext, payload);
    }
  });
}
