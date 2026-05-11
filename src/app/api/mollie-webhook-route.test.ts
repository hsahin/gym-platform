import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function readBody(response: Response) {
  return (await response.json()) as { ok?: boolean; error?: { code?: string } };
}

const originalSecret = process.env.MOLLIE_WEBHOOK_SECRET;
const syncMollieBillingWebhook = vi.fn(async () => ({ acknowledged: true }));

vi.mock("@/server/runtime/gym-services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/runtime/gym-services")>();
  return {
    ...actual,
    getGymPlatformServices: async () => ({
      syncMollieBillingWebhook,
    }),
  };
});

beforeEach(() => {
  syncMollieBillingWebhook.mockClear();
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.MOLLIE_WEBHOOK_SECRET;
  } else {
    process.env.MOLLIE_WEBHOOK_SECRET = originalSecret;
  }
});

describe("Mollie webhook route — content-type & secret handling", () => {
  it("accepts JSON payloads when content-type is application/json", async () => {
    process.env.MOLLIE_WEBHOOK_SECRET = "secret-json";
    const { POST } = await import("@/app/api/platform/billing/mollie/webhook/route");

    const response = await POST(
      new Request(
        "http://localhost/api/platform/billing/mollie/webhook?tenantId=tenant_1&secret=secret-json",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: "tr_json_1" }),
        },
      ),
    );
    const body = await readBody(response);

    expect(body.ok).toBe(true);
    expect(syncMollieBillingWebhook).toHaveBeenCalledWith({
      tenantId: "tenant_1",
      paymentId: "tr_json_1",
    });
  });

  it("accepts plain-text bodies by parsing them as urlencoded form data", async () => {
    process.env.MOLLIE_WEBHOOK_SECRET = "secret-text";
    const { POST } = await import("@/app/api/platform/billing/mollie/webhook/route");

    const response = await POST(
      new Request(
        "http://localhost/api/platform/billing/mollie/webhook?secret=secret-text",
        {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "id=tr_text_1",
        },
      ),
    );
    const body = await readBody(response);

    expect(body.ok).toBe(true);
    expect(syncMollieBillingWebhook).toHaveBeenCalledWith({
      tenantId: undefined,
      paymentId: "tr_text_1",
    });
  });

  it("rejects requests with a wrong webhook secret as FORBIDDEN", async () => {
    process.env.MOLLIE_WEBHOOK_SECRET = "the-only-valid-secret";
    const { POST } = await import("@/app/api/platform/billing/mollie/webhook/route");

    const response = await POST(
      new Request(
        "http://localhost/api/platform/billing/mollie/webhook?secret=wrong",
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ id: "tr_x" }),
        },
      ),
    );
    const body = await readBody(response);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("FORBIDDEN");
  });
});
