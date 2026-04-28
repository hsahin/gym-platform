import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const publicMemberSignupSchema = z.object({
  tenantSlug: z.string().min(2).optional(),
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6),
  phoneCountry: z.string().length(2),
  membershipPlanId: z.string().min(1),
  preferredLocationId: z.string().min(1),
  paymentMethod: z.enum(["direct_debit", "one_time", "payment_request"]),
  contractAccepted: z.boolean(),
  waiverAccepted: z.boolean(),
  portalPassword: z.string().min(8),
  notes: z.string().max(280).optional(),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      requireMutationSecurity(request, {
        rateLimit: {
          scope: "public.member-signups",
          maxRequests: 4,
          windowMs: 15 * 60_000,
        },
      });
      const services = await getGymPlatformServices();
      const payload = publicMemberSignupSchema.parse(await request.json());

      return services.submitPublicMemberSignup({
        ...payload,
        phoneCountry: payload.phoneCountry as "NL" | "BE" | "DE" | "GB" | "US" | "AE",
      });
    },
    { successStatus: 201 },
  );
}
