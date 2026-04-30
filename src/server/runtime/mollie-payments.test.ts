import { describe, expect, it, vi } from "vitest";
import {
  createMolliePaymentProvider,
  isMolliePaymentConfigured,
  toMolliePaymentMethod,
} from "@/server/runtime/mollie-payments";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

describe("mollie payment provider", () => {
  it("detects configured Mollie credentials without treating empty env as live", () => {
    expect(isMolliePaymentConfigured({ MOLLIE_API_KEY: "" })).toBe(false);
    expect(isMolliePaymentConfigured({ MOLLIE_API_KEY: "test_live_key" })).toBe(true);
  });

  it("maps gym payment methods to Mollie checkout methods", () => {
    expect(toMolliePaymentMethod("direct_debit")).toBe("directdebit");
    expect(toMolliePaymentMethod("one_time")).toBeUndefined();
    expect(toMolliePaymentMethod("payment_request")).toBeUndefined();
  });

  it("creates a real Mollie payment intent with checkout and webhook urls", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

      expect(init?.method).toBe("POST");
      expect(body).toMatchObject({
        amount: {
          currency: "EUR",
          value: "24.95",
        },
        description: "Intake bundle",
        redirectUrl: "https://gym.example/dashboard/payments?invoice=inv_1",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
        metadata: {
          invoiceId: "inv_1",
          tenantId: "tenant_1",
        },
      });

      return jsonResponse({
        id: "tr_checkout_1",
        status: "open",
        _links: {
          checkout: {
            href: "https://pay.mollie.com/p/test",
          },
        },
      });
    });
    const provider = createMolliePaymentProvider({
      apiKey: "test_live_key",
      fetchImpl: fetchMock,
    });

    const intent = await provider.createPaymentIntent({
      amountCents: 2495,
      currency: "EUR",
      description: "Intake bundle",
      paymentMethod: "payment_request",
      redirectUrl: "https://gym.example/dashboard/payments?invoice=inv_1",
      webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
      metadata: {
        invoiceId: "inv_1",
        tenantId: "tenant_1",
      },
    });

    expect(intent).toEqual({
      providerPaymentId: "tr_checkout_1",
      checkoutUrl: "https://pay.mollie.com/p/test",
      status: "open",
    });
  });

  it("reads Mollie payment status and creates refunds through the API", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      if (target.endsWith("/payments/tr_paid_1/refunds")) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          amount: {
            currency: "EUR",
            value: "49.00",
          },
          description: "Goodwill",
        });

        return jsonResponse({
          id: "re_1",
          status: "queued",
        });
      }

      expect(target).toContain("/payments/tr_paid_1");
      return jsonResponse({
        id: "tr_paid_1",
        status: "paid",
        metadata: {
          invoiceId: "inv_1",
          tenantId: "tenant_1",
        },
      });
    });
    const provider = createMolliePaymentProvider({
      apiKey: "test_live_key",
      fetchImpl: fetchMock,
    });

    await expect(provider.getPayment("tr_paid_1")).resolves.toMatchObject({
      providerPaymentId: "tr_paid_1",
      invoiceId: "inv_1",
      status: "paid",
    });
    await expect(
      provider.createRefund("tr_paid_1", {
        amountCents: 4900,
        currency: "EUR",
        description: "Goodwill",
      }),
    ).resolves.toMatchObject({
      providerRefundId: "re_1",
      status: "queued",
    });
  });

  it("fails loudly when Mollie rejects a request", async () => {
    const provider = createMolliePaymentProvider({
      apiKey: "test_live_key",
      fetchImpl: vi.fn(async () =>
        jsonResponse({ detail: "The API key is invalid." }, { status: 401 }),
      ),
    });

    await expect(
      provider.createPaymentIntent({
        amountCents: 1000,
        currency: "EUR",
        description: "Drop-in",
        paymentMethod: "one_time",
        redirectUrl: "https://gym.example/dashboard/payments",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
        metadata: {
          invoiceId: "inv_1",
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("uses OAuth app access tokens with testmode query parameters", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      expect(target).toBe("https://api.mollie.com/v2/payments?testmode=true");
      expect(init?.headers).toMatchObject({
        authorization: "Bearer access_123",
      });

      return jsonResponse({
        id: "tr_oauth_1",
        status: "open",
        _links: {
          checkout: {
            href: "https://pay.mollie.com/p/oauth",
          },
        },
      });
    });
    const provider = createMolliePaymentProvider({
      accessToken: "access_123",
      fetchImpl: fetchMock,
      testMode: true,
    });

    await expect(
      provider.createPaymentIntent({
        amountCents: 1000,
        currency: "EUR",
        description: "OAuth checkout",
        paymentMethod: "one_time",
        redirectUrl: "https://gym.example/dashboard/payments",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
        metadata: {
          invoiceId: "inv_1",
        },
      }),
    ).resolves.toMatchObject({
      providerPaymentId: "tr_oauth_1",
      checkoutUrl: "https://pay.mollie.com/p/oauth",
    });
  });
});
