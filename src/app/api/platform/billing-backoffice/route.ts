import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const billingBackofficeSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("create_invoice"),
    memberId: z.string().min(1).optional(),
    memberName: z.string().min(2),
    description: z.string().min(2).max(120),
    amountCents: z.number().int().nonnegative(),
    dueAt: z.string().min(10),
    source: z.enum(["membership", "signup_checkout", "appointment_pack", "late_fee", "manual"]),
    currency: z.string().length(3).optional(),
  }),
  z.object({
    operation: z.literal("retry_invoice"),
    invoiceId: z.string().min(1),
    reason: z.string().min(2).max(120),
  }),
  z.object({
    operation: z.literal("refund_invoice"),
    invoiceId: z.string().min(1),
    amountCents: z.number().int().positive(),
    reason: z.string().min(2).max(120),
  }),
  z.object({
    operation: z.literal("record_webhook"),
    invoiceId: z.string().min(1),
    eventType: z.string().min(2),
    status: z.enum(["received", "processed", "failed"]),
    providerReference: z.string().min(2),
    payloadSummary: z.string().min(2).max(200),
  }),
  z.object({
    operation: z.literal("reconcile"),
    note: z.string().max(160).optional(),
  }),
]);

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();

    return (await services.getDashboardSnapshot(viewer.actor, viewer.tenantContext)).billingBackoffice;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    const payload = billingBackofficeSchema.parse(await request.json());

    switch (payload.operation) {
      case "create_invoice":
        return services.createBillingInvoice(viewer.actor, viewer.tenantContext, payload);
      case "retry_invoice":
        return services.retryBillingInvoice(viewer.actor, viewer.tenantContext, payload);
      case "refund_invoice":
        return services.refundBillingInvoice(viewer.actor, viewer.tenantContext, payload);
      case "record_webhook":
        return services.recordBillingWebhook(viewer.actor, viewer.tenantContext, payload);
      case "reconcile":
        return services.reconcileBillingLedger(viewer.actor, viewer.tenantContext, payload);
    }
  });
}
