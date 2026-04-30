import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as clientLinkRoute } from "@/app/api/platform/billing/mollie/client-link/route";
import { GET as connectRoute } from "@/app/api/platform/billing/mollie/connect/route";
import { POST as disconnectRoute } from "@/app/api/platform/billing/mollie/disconnect/route";
import { POST as mandatesRoute } from "@/app/api/platform/billing/mollie/mandates/route";
import { GET as redirectRoute } from "@/app/api/mollie/redirect/route";
import {
  IDEMPOTENCY_HEADER,
  MUTATION_CSRF_HEADER,
  MUTATION_CSRF_TOKEN,
} from "@/server/http/platform-api";
import { bootstrapLocalPlatform } from "@/server/persistence/platform-state";
import { SESSION_COOKIE_NAME, buildPlatformActor } from "@/server/runtime/demo-session";
import { getGymPlatformServices } from "@/server/runtime/gym-services";
import { MOLLIE_CONNECT_SCOPES } from "@/server/runtime/mollie-connect";

let tempDir = "";
const originalFetch = globalThis.fetch;
const originalEnv = {
  APP_BASE_URL: process.env.APP_BASE_URL,
  MOLLIE_CLIENT_ID: process.env.MOLLIE_CLIENT_ID,
  MOLLIE_CLIENT_SECRET: process.env.MOLLIE_CLIENT_SECRET,
  MOLLIE_CONNECT_REDIRECT_URL: process.env.MOLLIE_CONNECT_REDIRECT_URL,
  MOLLIE_ORGANIZATION_ACCESS_TOKEN: process.env.MOLLIE_ORGANIZATION_ACCESS_TOKEN,
  MOLLIE_TEST_MODE: process.env.MOLLIE_TEST_MODE,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function loginAndExtractSession(email: string, password: string) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  const response = await loginRoute(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: formData,
    }),
  );
  const setCookie = response.headers.get("set-cookie");
  const tokenMatch = setCookie?.match(
    new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`),
  );

  expect(tokenMatch?.[1]).toBeTruthy();

  return tokenMatch![1];
}

function createGetRequest(url: string, token: string) {
  return new NextRequest(url, {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
  });
}

function createMutationRequest(
  url: string,
  token: string,
  body: Record<string, unknown>,
) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
      origin: "http://localhost",
      "content-type": "application/json",
      [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
      [IDEMPOTENCY_HEADER]: crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "gym-platform-mollie-connect-"));
  process.env.LOCAL_PLATFORM_STATE_FILE = path.join(tempDir, "platform-state.json");
  process.env.APP_BASE_URL = "https://gym-platform-vc9yk.ondigitalocean.app";
  process.env.MOLLIE_CLIENT_ID = "app_123";
  process.env.MOLLIE_CLIENT_SECRET = "secret";
  process.env.MOLLIE_CONNECT_REDIRECT_URL =
    "https://gym-platform-vc9yk.ondigitalocean.app/api/mollie/redirect";
  process.env.MOLLIE_ORGANIZATION_ACCESS_TOKEN = "org_token";
  process.env.MOLLIE_TEST_MODE = "true";
  globalThis.__gymPlatformServices = undefined;
});

afterEach(async () => {
  delete process.env.LOCAL_PLATFORM_STATE_FILE;
  restoreEnv();
  globalThis.fetch = originalFetch;
  globalThis.__gymPlatformServices = undefined;
  await rm(tempDir, { recursive: true, force: true });
});

describe("mollie connect routes", () => {
  it("connects an existing Mollie account through OAuth and stores the test profile", async () => {
    const state = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });
    const token = await loginAndExtractSession(
      "owner@northside.test",
      "strong-pass-123",
    );

    const connectResponse = await connectRoute(
      createGetRequest("http://localhost/api/platform/billing/mollie/connect", token),
    );
    expect(connectResponse.status).toBe(307);
    const authorizeUrl = new URL(connectResponse.headers.get("location")!);
    expect(`${authorizeUrl.origin}${authorizeUrl.pathname}`).toBe(
      "https://my.mollie.com/oauth2/authorize",
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe("app_123");
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://gym-platform-vc9yk.ondigitalocean.app/api/mollie/redirect",
    );
    expect(authorizeUrl.searchParams.get("testmode")).toBe("true");
    expect(authorizeUrl.searchParams.get("scope")).toBe(MOLLIE_CONNECT_SCOPES.join(" "));
    const oauthState = authorizeUrl.searchParams.get("state");
    expect(oauthState).toBeTruthy();

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      if (target.endsWith("/oauth2/tokens")) {
        expect(init?.headers).toMatchObject({
          authorization: `Basic ${Buffer.from("app_123:secret").toString("base64")}`,
        });

        return new Response(
          JSON.stringify({
            access_token: "access_123",
            refresh_token: "refresh_123",
            expires_in: 3600,
            scope: MOLLIE_CONNECT_SCOPES.join(" "),
            token_type: "Bearer",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (target.endsWith("/v2/profiles?testmode=true")) {
        expect(init?.headers).toMatchObject({
          authorization: "Bearer access_123",
        });

        return new Response(
          JSON.stringify({
            _embedded: {
              profiles: [
                {
                  id: "pfl_test_northside",
                  name: "Northside Athletics Payments",
                  website: "https://northside.test",
                  status: "verified",
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`Unhandled Mollie request: ${target}`);
    }) as typeof fetch;

    const redirectResponse = await redirectRoute(
      new NextRequest(
        `http://localhost/api/mollie/redirect?code=auth_code&state=${encodeURIComponent(
          oauthState!,
        )}`,
      ),
    );
    expect(redirectResponse.status).toBe(307);
    expect(redirectResponse.headers.get("location")).toBe(
      "https://gym-platform-vc9yk.ondigitalocean.app/dashboard/payments?mollie=connected",
    );

    const services = await getGymPlatformServices();
    const ownerActor = buildPlatformActor(state.accounts[0]!, state.tenant.id);
    const snapshot = await services.getDashboardSnapshot(
      ownerActor,
      services.createRequestTenantContext(ownerActor, state.tenant.id),
    );

    expect(snapshot.payments.mollieConnectConnected).toBe(true);
    expect(snapshot.payments.mollieConnectTestMode).toBe(true);
    expect(snapshot.payments.profileId).toBe("pfl_test_northside");
    expect(snapshot.payments.profileLabel).toBe("Northside Athletics Payments");

    const disconnectResponse = await disconnectRoute(
      createMutationRequest(
        "http://localhost/api/platform/billing/mollie/disconnect",
        token,
        {},
      ),
    );
    expect(disconnectResponse.status).toBe(200);
    const disconnectPayload = await disconnectResponse.json();
    expect(disconnectPayload.data.mollieConnectConnected).toBe(false);

    const disconnectedSnapshot = await services.getDashboardSnapshot(
      ownerActor,
      services.createRequestTenantContext(ownerActor, state.tenant.id),
    );
    expect(disconnectedSnapshot.payments.mollieConnectConnected).toBe(false);
    expect(disconnectedSnapshot.payments.profileId).toBe("");
  });

  it("creates a Mollie client link for gyms that do not have a Mollie account yet", async () => {
    expect(mandatesRoute).toBeTypeOf("function");
    await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });
    const token = await loginAndExtractSession(
      "owner@northside.test",
      "strong-pass-123",
    );
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      expect(target).toBe("https://api.mollie.com/v2/client-links?testmode=true");
      expect(init?.headers).toMatchObject({
        authorization: "Bearer org_token",
      });

      return new Response(
        JSON.stringify({
          id: "cl_northside",
          _links: {
            clientLink: {
              href: "https://my.mollie.com/dashboard/client-link/cl_northside",
            },
          },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const response = await clientLinkRoute(
      createMutationRequest(
        "http://localhost/api/platform/billing/mollie/client-link",
        token,
        {
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
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    const onboardingUrl = new URL(payload.data.onboardingUrl);
    expect(payload.data.id).toBe("cl_northside");
    expect(onboardingUrl.searchParams.get("client_id")).toBe("app_123");
    expect(onboardingUrl.searchParams.get("scope")).toBe(MOLLIE_CONNECT_SCOPES.join(" "));
    expect(onboardingUrl.searchParams.get("testmode")).toBe("true");
  });
});
