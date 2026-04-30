import { describe, expect, it, vi } from "vitest";
import {
  MOLLIE_CONNECT_SCOPES,
  buildMollieConnectAuthorizationUrl,
  createMollieConnectClient,
  isMollieConnectConfigured,
  isMollieTestMode,
} from "@/server/runtime/mollie-connect";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

describe("mollie connect oauth", () => {
  it("requests the gym platform scopes in test mode", () => {
    expect(MOLLIE_CONNECT_SCOPES).toEqual([
      "payments.read",
      "payments.write",
      "refunds.read",
      "refunds.write",
      "payment-links.read",
      "payment-links.write",
      "customers.read",
      "customers.write",
      "mandates.read",
      "mandates.write",
      "subscriptions.read",
      "subscriptions.write",
      "organizations.read",
      "organizations.write",
      "profiles.read",
      "profiles.write",
      "onboarding.read",
      "onboarding.write",
      "invoices.read",
      "settlements.read",
      "balances.read",
      "webhooks.read",
      "webhooks.write",
    ]);
    expect(isMollieTestMode({})).toBe(true);
    expect(isMollieTestMode({ MOLLIE_TEST_MODE: "false" })).toBe(false);
    expect(
      isMollieConnectConfigured({
        MOLLIE_CLIENT_ID: "app_123",
        MOLLIE_CLIENT_SECRET: "secret",
      }),
    ).toBe(true);
  });

  it("builds the OAuth authorize URL with state, redirect url, scopes and testmode", () => {
    const url = new URL(
      buildMollieConnectAuthorizationUrl({
        clientId: "app_123",
        redirectUri: "https://gym.example/api/mollie/redirect",
        state: "tenant_1:nonce",
        testMode: true,
      }),
    );

    expect(`${url.origin}${url.pathname}`).toBe("https://my.mollie.com/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe("app_123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://gym.example/api/mollie/redirect",
    );
    expect(url.searchParams.get("state")).toBe("tenant_1:nonce");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("approval_prompt")).toBe("auto");
    expect(url.searchParams.get("testmode")).toBe("true");
    expect(url.searchParams.get("scope")).toBe(MOLLIE_CONNECT_SCOPES.join(" "));
  });

  it("exchanges authorization codes and creates client links with the right credentials", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      if (target.endsWith("/oauth2/tokens")) {
        expect(init?.headers).toMatchObject({
          authorization: `Basic ${Buffer.from("app_123:secret").toString("base64")}`,
        });
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          grant_type: "authorization_code",
          code: "auth_code",
          redirect_uri: "https://gym.example/api/mollie/redirect",
        });

        return jsonResponse({
          access_token: "access_123",
          refresh_token: "refresh_123",
          expires_in: 3600,
          scope: "payments.read payments.write",
          token_type: "Bearer",
        });
      }

      if (target.endsWith("/v2/client-links?testmode=true")) {
        expect(init?.headers).toMatchObject({
          authorization: "Bearer org_token",
        });
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          owner: {
            name: "Northside Athletics",
          },
        });

        return jsonResponse(
          {
            id: "cl_123",
            _links: {
              clientLink: {
                href: "https://my.mollie.com/dashboard/client-link/cl_123",
              },
            },
          },
          { status: 201 },
        );
      }

      throw new Error(`Unhandled Mollie request: ${target}`);
    });
    const client = createMollieConnectClient({
      clientId: "app_123",
      clientSecret: "secret",
      organizationAccessToken: "org_token",
      redirectUri: "https://gym.example/api/mollie/redirect",
      fetchImpl: fetchMock,
      testMode: true,
    });

    await expect(client.exchangeAuthorizationCode("auth_code")).resolves.toMatchObject({
      accessToken: "access_123",
      refreshToken: "refresh_123",
      scope: "payments.read payments.write",
    });

    const link = await client.createClientLink({
      owner: {
        name: "Northside Athletics",
        email: "owner@northside.test",
        address: {
          streetAndNumber: "Teststraat 1",
          postalCode: "1011AA",
          city: "Amsterdam",
          country: "NL",
        },
        registrationNumber: "12345678",
        vatNumber: null,
        legalEntity: "limited-liability-company",
        registrationOffice: "NL",
        incorporationDate: null,
      },
      state: "tenant_1:client-link",
    });

    const onboardingUrl = new URL(link.onboardingUrl);
    expect(link.id).toBe("cl_123");
    expect(onboardingUrl.searchParams.get("client_id")).toBe("app_123");
    expect(onboardingUrl.searchParams.get("state")).toBe("tenant_1:client-link");
    expect(onboardingUrl.searchParams.get("scope")).toBe(MOLLIE_CONNECT_SCOPES.join(" "));
    expect(onboardingUrl.searchParams.get("testmode")).toBe("true");
  });

  it("lists customers and direct debit mandates in OAuth test mode", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      expect(init?.headers).toMatchObject({
        authorization: "Bearer access_123",
      });

      if (target.endsWith("/v2/customers?limit=250&testmode=true")) {
        return jsonResponse({
          _embedded: {
            customers: [
              {
                id: "cst_123",
                name: "Lena Bakker",
                email: "lena@northside.test",
              },
            ],
          },
        });
      }

      if (target.endsWith("/v2/customers/cst_123/mandates?limit=250&testmode=true")) {
        return jsonResponse({
          _embedded: {
            mandates: [
              {
                id: "mdt_123",
                method: "directdebit",
                status: "valid",
                signatureDate: "2026-01-01",
              },
            ],
          },
        });
      }

      throw new Error(`Unhandled Mollie request: ${target}`);
    });
    const client = createMollieConnectClient({
      clientId: "app_123",
      clientSecret: "secret",
      redirectUri: "https://gym.example/api/mollie/redirect",
      fetchImpl: fetchMock,
      testMode: true,
    });

    await expect(client.listCustomers("access_123")).resolves.toEqual([
      {
        id: "cst_123",
        name: "Lena Bakker",
        email: "lena@northside.test",
      },
    ]);
    await expect(client.listMandates("access_123", "cst_123")).resolves.toEqual([
      {
        id: "mdt_123",
        method: "directdebit",
        status: "valid",
        signatureDate: "2026-01-01",
      },
    ]);
  });
});
