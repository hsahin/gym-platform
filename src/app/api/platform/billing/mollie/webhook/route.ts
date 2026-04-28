import { AppError } from "@claimtech/core";
import { z } from "zod";
import { runApiHandler } from "@/server/http/platform-api";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const mollieWebhookSchema = z.object({
  id: z.string().trim().min(2),
});

async function readMollieWebhookPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return mollieWebhookSchema.parse(await request.json());
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    return mollieWebhookSchema.parse(Object.fromEntries(formData.entries()));
  }

  const rawBody = await request.text();
  return mollieWebhookSchema.parse(Object.fromEntries(new URLSearchParams(rawBody)));
}

function requireMollieWebhookSecret(request: Request) {
  const configuredSecret = process.env.MOLLIE_WEBHOOK_SECRET?.trim();

  if (!configuredSecret) {
    return;
  }

  const requestUrl = new URL(request.url);
  const providedSecret =
    request.headers.get("x-mollie-webhook-secret")?.trim() ||
    requestUrl.searchParams.get("secret")?.trim();

  if (providedSecret !== configuredSecret) {
    throw new AppError("Mollie webhook secret ontbreekt of is ongeldig.", {
      code: "FORBIDDEN",
    });
  }
}

export async function POST(request: Request) {
  return runApiHandler(request, async () => {
    requireMollieWebhookSecret(request);
    const requestUrl = new URL(request.url);
    const payload = await readMollieWebhookPayload(request);
    const services = await getGymPlatformServices();

    return services.syncMollieBillingWebhook({
      tenantId: requestUrl.searchParams.get("tenantId")?.trim() || undefined,
      paymentId: payload.id,
    });
  });
}
