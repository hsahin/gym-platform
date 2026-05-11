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
  it("requires either a platform API key or connected-account access token", () => {
    const previousApiKey = process.env.MOLLIE_API_KEY;
    delete process.env.MOLLIE_API_KEY;

    try {
      expect(() => createMolliePaymentProvider()).toThrow("Mollie API-key ontbreekt.");
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.MOLLIE_API_KEY;
      } else {
        process.env.MOLLIE_API_KEY = previousApiKey;
      }
    }
  });

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

  it("can create a Mollie payment intent without a webhook url for local development", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

      expect(init?.method).toBe("POST");
      expect(body).toMatchObject({
        amount: {
          currency: "EUR",
          value: "24.95",
        },
        description: "Local intake bundle",
        redirectUrl: "http://localhost:3003/dashboard/payments?invoice=inv_local",
      });
      expect(body).not.toHaveProperty("webhookUrl");

      return jsonResponse({
        id: "tr_local_checkout_1",
        status: "open",
        _links: {
          checkout: {
            href: "https://pay.mollie.com/p/local-test",
          },
        },
      });
    });
    const provider = createMolliePaymentProvider({
      apiKey: "test_live_key",
      fetchImpl: fetchMock,
      testMode: true,
    });

    const intent = await provider.createPaymentIntent({
      amountCents: 2495,
      currency: "EUR",
      description: "Local intake bundle",
      paymentMethod: "payment_request",
      redirectUrl: "http://localhost:3003/dashboard/payments?invoice=inv_local",
      metadata: {
        invoiceId: "inv_local",
        tenantId: "tenant_local",
      },
    });

    expect(intent).toEqual({
      providerPaymentId: "tr_local_checkout_1",
      checkoutUrl: "https://pay.mollie.com/p/local-test",
      status: "open",
    });
  });

  it("does not send testmode for api-key based payment intents", async () => {
    const previousTestMode = process.env.MOLLIE_TEST_MODE;
    process.env.MOLLIE_TEST_MODE = "true";

    try {
      const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

        expect(body).not.toHaveProperty("testmode");

        return jsonResponse({
          id: "tr_env_testmode_1",
          status: "open",
          _links: {
            checkout: {
              href: "https://pay.mollie.com/p/env-testmode",
            },
          },
        });
      });
      const provider = createMolliePaymentProvider({
        apiKey: "test_live_key",
        fetchImpl: fetchMock,
      });

      await expect(
        provider.createPaymentIntent({
          amountCents: 300,
          currency: "EUR",
          description: "Testmode invoice",
          paymentMethod: "payment_request",
          redirectUrl: "http://localhost:3003/dashboard/payments?invoice=inv_testmode",
          metadata: {
            invoiceId: "inv_testmode",
            tenantId: "tenant_testmode",
          },
        }),
      ).resolves.toMatchObject({
        providerPaymentId: "tr_env_testmode_1",
      });
    } finally {
      if (previousTestMode === undefined) {
        delete process.env.MOLLIE_TEST_MODE;
      } else {
        process.env.MOLLIE_TEST_MODE = previousTestMode;
      }
    }
  });

  it("does not append testmode to read calls for api-key based requests", async () => {
    const previousTestMode = process.env.MOLLIE_TEST_MODE;
    process.env.MOLLIE_TEST_MODE = "true";

    try {
      const fetchMock = vi.fn(async (url: string | URL | Request) => {
        expect(String(url)).toBe("https://api.mollie.com/v2/payments/tr_api_key_1");

        return jsonResponse({
          id: "tr_api_key_1",
          status: "paid",
        });
      });
      const provider = createMolliePaymentProvider({
        apiKey: "test_live_key",
        fetchImpl: fetchMock,
      });

      await expect(provider.getPayment("tr_api_key_1")).resolves.toMatchObject({
        providerPaymentId: "tr_api_key_1",
        status: "paid",
      });
    } finally {
      if (previousTestMode === undefined) {
        delete process.env.MOLLIE_TEST_MODE;
      } else {
        process.env.MOLLIE_TEST_MODE = previousTestMode;
      }
    }
  });

  it("creates a customer first for automatic direct debit mandate checkout", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

      if (target === "https://api.mollie.com/v2/customers") {
        expect(init?.method).toBe("POST");
        expect(body).toMatchObject({
          name: "Jade Vermeer",
          email: "jade@northside.test",
          testmode: true,
        });

        return jsonResponse({
          id: "cst_signup_1",
        });
      }

      expect(target).toBe("https://api.mollie.com/v2/customers/cst_signup_1/payments");
      expect(init?.method).toBe("POST");
      expect(body).toMatchObject({
        amount: {
          currency: "EUR",
          value: "119.00",
        },
        description: "Membership checkout",
        sequenceType: "first",
        testmode: true,
        metadata: {
          invoiceId: "inv_1",
          tenantId: "tenant_1",
        },
      });
      expect(body).not.toHaveProperty("method");

      return jsonResponse({
        id: "tr_first_1",
        status: "open",
        _links: {
          checkout: {
            href: "https://pay.mollie.com/p/first",
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
        amountCents: 11900,
        currency: "EUR",
        description: "Membership checkout",
        paymentMethod: "direct_debit",
        redirectUrl: "https://gym.example/dashboard/payments?invoice=inv_1",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
        customer: {
          name: "Jade Vermeer",
          email: "jade@northside.test",
        },
        sequenceType: "first",
        metadata: {
          invoiceId: "inv_1",
          tenantId: "tenant_1",
        },
      }),
    ).resolves.toMatchObject({
      providerPaymentId: "tr_first_1",
      providerCustomerId: "cst_signup_1",
      checkoutUrl: "https://pay.mollie.com/p/first",
    });
  });

  it("creates a direct SEPA mandate without a checkout link", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

      if (target === "https://api.mollie.com/v2/customers") {
        expect(init?.method).toBe("POST");
        expect(body).toMatchObject({
          name: "Jade Vermeer",
          email: "jade@northside.test",
          testmode: true,
        });

        return jsonResponse({ id: "cst_direct_debit_1" });
      }

      expect(target).toBe(
        "https://api.mollie.com/v2/customers/cst_direct_debit_1/mandates",
      );
      expect(init?.method).toBe("POST");
      expect(body).toMatchObject({
        method: "directdebit",
        consumerName: "Jade Vermeer",
        consumerAccount: "NL91ABNA0417164300",
        consumerEmail: "jade@northside.test",
        testmode: true,
      });

      return jsonResponse({
        id: "mdt_direct_debit_1",
        status: "valid",
        method: "directdebit",
      });
    });
    const provider = createMolliePaymentProvider({
      accessToken: "access_123",
      fetchImpl: fetchMock,
      testMode: true,
    });
    const customer = await provider.createCustomer({
      name: "Jade Vermeer",
      email: "jade@northside.test",
    });

    await expect(
      provider.createDirectDebitMandate({
        customerId: customer.providerCustomerId,
        consumerName: "Jade Vermeer",
        consumerAccount: "nl91 abna 0417 1643 00",
        consumerEmail: "jade@northside.test",
      }),
    ).resolves.toEqual({
      providerMandateId: "mdt_direct_debit_1",
      method: "directdebit",
      status: "valid",
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
        customerId: "cst_1",
        sequenceType: "first",
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
      providerCustomerId: "cst_1",
      sequenceType: "first",
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

  it("adds testmode to read calls for connected accounts outside request bodies", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("https://api.mollie.com/v2/payments/tr_paid_1?testmode=true");

      return jsonResponse({
        id: "tr_paid_1",
        status: "paid",
      });
    });
    const provider = createMolliePaymentProvider({
      accessToken: "access_123",
      fetchImpl: fetchMock,
      testMode: true,
    });

    await expect(provider.getPayment("tr_paid_1")).resolves.toMatchObject({
      providerPaymentId: "tr_paid_1",
      status: "paid",
    });
  });

  it("creates a Mollie subscription for monthly direct debit after the first mandate payment", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.mollie.com/v2/customers/cst_1/subscriptions",
      );
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        amount: {
          currency: "EUR",
          value: "119.00",
        },
        interval: "1 month",
        method: "directdebit",
        description: "Maandelijkse incasso · Jade Vermeer",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
        testmode: true,
        metadata: {
          invoiceId: "inv_1",
          tenantId: "tenant_1",
        },
      });

      return jsonResponse({
        id: "sub_1",
        status: "active",
      });
    });
    const provider = createMolliePaymentProvider({
      accessToken: "access_123",
      fetchImpl: fetchMock,
      testMode: true,
    });

    await expect(
      provider.createSubscription({
        customerId: "cst_1",
        amountCents: 11900,
        currency: "EUR",
        interval: "1 month",
        description: "Maandelijkse incasso · Jade Vermeer",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
        startDate: "2026-06-01",
        metadata: {
          invoiceId: "inv_1",
          tenantId: "tenant_1",
        },
      }),
    ).resolves.toEqual({
      providerSubscriptionId: "sub_1",
      status: "active",
    });
  });

  it("rejects incomplete Mollie customer, mandate, payment, subscription and refund responses", async () => {
    const customerProvider = createMolliePaymentProvider({
      accessToken: "access_123",
      fetchImpl: vi.fn(async (url: string | URL | Request) => {
        if (String(url).endsWith("/customers")) {
          return jsonResponse({});
        }

        return jsonResponse({
          id: "tr_never_used",
          _links: { checkout: { href: "https://pay.mollie.com/p/never" } },
        });
      }),
      testMode: true,
    });

    await expect(
      customerProvider.createPaymentIntent({
        amountCents: 11900,
        currency: "EUR",
        description: "Membership checkout",
        paymentMethod: "direct_debit",
        redirectUrl: "https://gym.example/dashboard/payments",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
        customer: {
          name: "Jade Vermeer",
          email: "jade@northside.test",
        },
        sequenceType: "first",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Mollie gaf geen geldige klantreferentie terug.",
    });

    const mandateProvider = createMolliePaymentProvider({
      accessToken: "access_123",
      fetchImpl: vi.fn(async () => jsonResponse({ status: "invalid" })),
      testMode: true,
    });

    await expect(
      mandateProvider.createDirectDebitMandate({
        customerId: "cst_1",
        consumerName: "Jade Vermeer",
        consumerAccount: "NL91ABNA0417164300",
        consumerEmail: "jade@northside.test",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Mollie gaf geen geldige incassomachtiging terug.",
    });

    const paymentProvider = createMolliePaymentProvider({
      apiKey: "test_live_key",
      fetchImpl: vi.fn(async () => jsonResponse({ id: "tr_without_checkout" })),
    });

    await expect(
      paymentProvider.createPaymentIntent({
        amountCents: 1000,
        currency: "EUR",
        description: "Drop-in",
        paymentMethod: "one_time",
        redirectUrl: "https://gym.example/dashboard/payments",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Mollie gaf geen geldige betaallink terug.",
    });

    const emptyResponseProvider = createMolliePaymentProvider({
      apiKey: "test_live_key",
      fetchImpl: vi.fn(async () => jsonResponse({})),
    });

    await expect(
      emptyResponseProvider.createSubscription({
        customerId: "cst_1",
        amountCents: 11900,
        currency: "EUR",
        interval: "1 month",
        description: "Maandelijkse incasso",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Mollie gaf geen geldige incassoreferentie terug.",
    });

    await expect(
      emptyResponseProvider.createRefund("tr_1", {
        amountCents: 1000,
        currency: "EUR",
        description: "Refund",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Mollie gaf geen geldige refundreferentie terug.",
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

  it("uses OAuth app access tokens with testmode body parameters for payment creation", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      expect(target).toBe("https://api.mollie.com/v2/payments");
      expect(init?.headers).toMatchObject({
        authorization: "Bearer access_123",
      });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        testmode: true,
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

  it("surfaces Mollie validation details in a business-readable error", async () => {
    const provider = createMolliePaymentProvider({
      accessToken: "access_123",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          {
            status: 422,
            title: "Unprocessable Entity",
            detail: "The profile id is invalid.",
            field: "profileId",
          },
          { status: 422 },
        ),
      ),
      testMode: true,
    });

    await expect(
      provider.createPaymentIntent({
        amountCents: 1000,
        currency: "EUR",
        description: "Testbetaling",
        paymentMethod: "one_time",
        profileId: "pfl_invalid",
        redirectUrl: "https://gym.example/dashboard/payments",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
        metadata: {
          invoiceId: "inv_1",
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: expect.stringContaining("gekoppelde betaalprofiel"),
    });
  });

  it("translates embedded Mollie method errors and text responses to owner-readable messages", async () => {
    const methodProvider = createMolliePaymentProvider({
      accessToken: "access_123",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          {
            _embedded: {
              errors: [
                null,
                { title: "Payment method is not enabled for this profile." },
              ],
            },
          },
          { status: 422 },
        ),
      ),
      testMode: true,
    });

    await expect(
      methodProvider.createPaymentIntent({
        amountCents: 1000,
        currency: "EUR",
        description: "Testbetaling",
        paymentMethod: "direct_debit",
        redirectUrl: "https://gym.example/dashboard/payments",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: expect.stringContaining("betaalmethode"),
    });

    const textProvider = createMolliePaymentProvider({
      apiKey: "test_live_key",
      fetchImpl: vi.fn(async () => new Response("Temporary Mollie outage", { status: 503 })),
    });

    await expect(
      textProvider.createPaymentIntent({
        amountCents: 1000,
        currency: "EUR",
        description: "Testbetaling",
        paymentMethod: "one_time",
        redirectUrl: "https://gym.example/dashboard/payments",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Mollie weigerde de betaallink: Temporary Mollie outage",
    });
  });

  it("falls back to a generic owner-readable message when Mollie returns no detail at all", async () => {
    const provider = createMolliePaymentProvider({
      accessToken: "access_123",
      fetchImpl: vi.fn(async () => new Response("", { status: 502 })),
      testMode: true,
    });

    await expect(
      provider.createPaymentIntent({
        amountCents: 1000,
        currency: "EUR",
        description: "Testbetaling",
        paymentMethod: "one_time",
        redirectUrl: "https://gym.example/dashboard/payments",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: expect.stringContaining("Controleer het gekoppelde betaalprofiel"),
    });
  });

  it("reads embedded Mollie errors when only the message field is present", async () => {
    const provider = createMolliePaymentProvider({
      accessToken: "access_123",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          {
            _embedded: {
              errors: [
                { message: "The profile id cannot be resolved." },
              ],
            },
          },
          { status: 422 },
        ),
      ),
      testMode: true,
    });

    await expect(
      provider.createPaymentIntent({
        amountCents: 1000,
        currency: "EUR",
        description: "Testbetaling",
        paymentMethod: "one_time",
        profileId: "pfl_invalid",
        redirectUrl: "https://gym.example/dashboard/payments",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: expect.stringContaining("gekoppelde betaalprofiel"),
    });
  });

  it("returns no errors when Mollie body shape is unrecognised", async () => {
    const provider = createMolliePaymentProvider({
      accessToken: "access_123",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          {
            _embedded: {
              errors: "not-an-array",
            },
            unrelated: true,
          },
          { status: 502 },
        ),
      ),
      testMode: true,
    });

    await expect(
      provider.createPaymentIntent({
        amountCents: 1000,
        currency: "EUR",
        description: "Testbetaling",
        paymentMethod: "one_time",
        redirectUrl: "https://gym.example/dashboard/payments",
        webhookUrl: "https://gym.example/api/platform/billing/mollie/webhook?tenantId=tenant_1",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: expect.stringContaining("Controleer het gekoppelde betaalprofiel"),
    });
  });
});
