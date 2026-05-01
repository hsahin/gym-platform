import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const supportEmailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .refine(
    (value) => value === "" || z.string().email().safeParse(value).success,
    "Vul een geldig support e-mailadres in of laat het leeg zolang betalingen nog niet actief zijn.",
  );

const updateBillingSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["mollie"]),
  profileLabel: z.string().min(2),
  profileId: z.string().min(4),
  settlementLabel: z.string().min(2),
  supportEmail: supportEmailSchema,
  paymentMethods: z
    .array(z.enum(["direct_debit", "one_time", "payment_request"]))
    .min(1),
  notes: z.string().max(280).optional(),
}).superRefine((payload, context) => {
  if (payload.enabled && !payload.supportEmail) {
    context.addIssue({
      code: "custom",
      path: ["supportEmail"],
      message: "Vul een support e-mailadres in voordat je betalingen actief zet.",
    });
  }
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = updateBillingSchema.parse(await request.json());

      return services.updateBillingSettings(viewer.actor, viewer.tenantContext, payload);
    },
    { successStatus: 201 },
  );
}
