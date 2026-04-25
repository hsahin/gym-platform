import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as setupRoute } from "@/app/api/auth/setup/route";
import {
  GET as getOwnerMobileSelfServiceRoute,
  POST as ownerMobileSelfServiceRoute,
} from "@/app/api/platform/mobile-self-service/route";
import { POST as updateFeatureFlagRoute } from "@/app/api/platform/feature-flags/route";
import {
  authenticateLocalAccount,
  bootstrapLocalPlatform,
} from "@/server/persistence/platform-state";
import {
  IDEMPOTENCY_HEADER,
  MUTATION_CSRF_HEADER,
  MUTATION_CSRF_TOKEN,
} from "@/server/http/platform-api";
import {
  SESSION_COOKIE_NAME,
  buildPlatformActor,
} from "@/server/runtime/demo-session";
import {
  createGymPlatformServices,
  getGymPlatformServices,
} from "@/server/runtime/gym-services";

let tempDir = "";

async function bootstrapOwnerPlatform() {
  const state = await bootstrapLocalPlatform({
    tenantName: "Northside Athletics",
    ownerName: "Amina Hassan",
    ownerEmail: "owner@northside.test",
    password: "strong-pass-123",
  });
  const ownerAccount = state.accounts[0]!;
  const ownerActor = buildPlatformActor(ownerAccount, state.tenant.id);
  const services = await createGymPlatformServices();
  const tenantContext = services.createRequestTenantContext(ownerActor, state.tenant.id);

  return {
    state,
    ownerActor,
    services,
    tenantContext,
  };
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

  return {
    response,
    token: tokenMatch![1],
  };
}

function createMutationRequest(
  url: string,
  body: Record<string, unknown>,
  token: string,
) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
      [IDEMPOTENCY_HEADER]: crypto.randomUUID(),
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
    body: JSON.stringify(body),
  });
}

function createAuthenticatedGetRequest(url: string, token: string) {
  return new NextRequest(url, {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
  });
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "gym-platform-owner-routes-"));
  process.env.LOCAL_PLATFORM_STATE_FILE = path.join(tempDir, "platform-state.json");
  globalThis.__gymPlatformServices = undefined;
});

afterEach(async () => {
  delete process.env.LOCAL_PLATFORM_STATE_FILE;
  globalThis.__gymPlatformServices = undefined;
  await rm(tempDir, { recursive: true, force: true });
});

describe("owner platform route integrations", () => {
  it("bootstraps the platform through the setup route and issues an owner session", async () => {
    const formData = new FormData();
    formData.set("tenantName", "Atlas Forge Club");
    formData.set("ownerName", "Mustafa Ali");
    formData.set("ownerEmail", "owner@atlasforge.test");
    formData.set("password", "AtlasPass123!");

    const response = await setupRoute(
      new Request("http://localhost/api/auth/setup", {
        method: "POST",
        body: formData,
      }),
    );
    const body = await response.text();
    const authenticated = await authenticateLocalAccount(
      "owner@atlasforge.test",
      "AtlasPass123!",
      "atlas-forge-club",
    );

    expect(response.status).toBe(200);
    expect(body).toContain('window.location.replace("/")');
    expect(response.headers.get("set-cookie")).toContain(SESSION_COOKIE_NAME);
    expect(authenticated?.tenant.name).toBe("Atlas Forge Club");
    expect(authenticated?.account.roleKey).toBe("owner");
  });

  it("redirects back to login when setup input is invalid", async () => {
    const formData = new FormData();
    formData.set("tenantName", "A");
    formData.set("ownerName", "B");
    formData.set("ownerEmail", "geen-email");
    formData.set("password", "kort");

    const response = await setupRoute(
      new Request("http://localhost/api/auth/setup", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain("setupError=");
  });

  it("updates feature flags through the platform route and persists the new state", async () => {
    const { ownerActor, services, tenantContext } = await bootstrapOwnerPlatform();
    const initialSnapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);
    const targetFeature = initialSnapshot.featureFlags[0];

    expect(targetFeature).toBeTruthy();

    const { token } = await loginAndExtractSession("owner@northside.test", "strong-pass-123");
    const response = await updateFeatureFlagRoute(
      createMutationRequest(
        "http://localhost/api/platform/feature-flags",
        {
          key: targetFeature!.key,
          enabled: !targetFeature!.enabled,
        },
        token,
      ),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        key: string;
        enabled: boolean;
      };
    };

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data.key).toBe(targetFeature!.key);
    expect(payload.data.enabled).toBe(!targetFeature!.enabled);

    const refreshedServices = await getGymPlatformServices();
    const refreshedSnapshot = await refreshedServices.getDashboardSnapshot(
      ownerActor,
      refreshedServices.createRequestTenantContext(ownerActor, tenantContext.tenantId),
    );
    expect(
      refreshedSnapshot.featureFlags.find((feature) => feature.key === targetFeature!.key)?.enabled,
    ).toBe(!targetFeature!.enabled);
  });

  it("blocks members from updating feature flags via the owner route", async () => {
    const { ownerActor, services, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 85,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["Portal access"],
    });

    await services.createMember(ownerActor, tenantContext, {
      fullName: "Nina de Boer",
      email: "nina@northside.test",
      phone: "0611112222",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: ["member-app"],
      waiverStatus: "complete",
      portalPassword: "member-pass-123",
    });

    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);
    const { token: memberToken } = await loginAndExtractSession(
      "nina@northside.test",
      "member-pass-123",
    );
    const response = await updateFeatureFlagRoute(
      createMutationRequest(
        "http://localhost/api/platform/feature-flags",
        {
          key: snapshot.featureFlags[0]!.key,
          enabled: !snapshot.featureFlags[0]!.enabled,
        },
        memberToken,
      ),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: {
        code: string;
        message: string;
      };
    };

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.message).toContain("mist permissies");
  });

  it("lets owners read and review mobile self-service requests while blocking members on the owner route", async () => {
    const { state, ownerActor, services, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 85,
      managerName: "Saar de Jong",
      amenities: ["Recovery zone"],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["Portal access"],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Nina de Boer",
      email: "nina@northside.test",
      phone: "0611112222",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: ["mobile"],
      waiverStatus: "complete",
      portalPassword: "member-pass-123",
    });
    const { token: memberToken } = await loginAndExtractSession(
      "nina@northside.test",
      "member-pass-123",
    );

    const { token: ownerToken } = await loginAndExtractSession(
      "owner@northside.test",
      "strong-pass-123",
    );
    const createResponse = await ownerMobileSelfServiceRoute(
      createMutationRequest(
        "http://localhost/api/platform/mobile-self-service",
        {
          operation: "request_pause",
          memberId: member.id,
          memberName: member.fullName,
          startsAt: "2026-06-01",
          endsAt: "2026-06-15",
          reason: "Herstelperiode na wedstrijd",
        },
        ownerToken,
      ),
    );
    const createPayload = (await createResponse.json()) as {
      ok: boolean;
      data: {
        id: string;
        status: string;
      };
    };

    expect(createResponse.status).toBe(200);
    expect(createPayload.data.status).toBe("pending");

    const getResponse = await getOwnerMobileSelfServiceRoute(
      createAuthenticatedGetRequest(
        "http://localhost/api/platform/mobile-self-service",
        ownerToken,
      ),
    );
    const getPayload = (await getResponse.json()) as {
      ok: boolean;
      data: {
        pauseRequests: Array<{
          id: string;
          memberId: string;
          status: string;
        }>;
      };
    };

    expect(getResponse.status).toBe(200);
    expect(getPayload.data.pauseRequests).toHaveLength(1);
    expect(getPayload.data.pauseRequests[0]?.memberId).toBe(member.id);
    expect(getPayload.data.pauseRequests[0]?.status).toBe("pending");

    const reviewResponse = await ownerMobileSelfServiceRoute(
      createMutationRequest(
        "http://localhost/api/platform/mobile-self-service",
        {
          operation: "review_pause",
          requestId: createPayload.data.id,
          decision: "approved",
          ownerNotes: "Herstelperiode is ingepland.",
        },
        ownerToken,
      ),
    );
    const reviewPayload = (await reviewResponse.json()) as {
      ok: boolean;
    };

    expect(reviewResponse.status).toBe(200);
    expect(reviewPayload.ok).toBe(true);

    const approvedGetResponse = await getOwnerMobileSelfServiceRoute(
      createAuthenticatedGetRequest(
        "http://localhost/api/platform/mobile-self-service",
        ownerToken,
      ),
    );
    const approvedGetPayload = (await approvedGetResponse.json()) as {
      ok: boolean;
      data: {
        pauseRequests: Array<{
          id: string;
          status: string;
        }>;
      };
    };

    expect(approvedGetResponse.status).toBe(200);
    expect(approvedGetPayload.data.pauseRequests[0]?.id).toBe(createPayload.data.id);
    expect(approvedGetPayload.data.pauseRequests[0]?.status).toBe("approved");

    const memberGetResponse = await getOwnerMobileSelfServiceRoute(
      createAuthenticatedGetRequest(
        "http://localhost/api/platform/mobile-self-service",
        memberToken,
      ),
    );
    const memberGetPayload = (await memberGetResponse.json()) as {
      ok: boolean;
      error: {
        code: string;
        message: string;
      };
    };

    expect(memberGetResponse.status).toBe(403);
    expect(memberGetPayload.ok).toBe(false);
    expect(memberGetPayload.error.code).toBe("FORBIDDEN");
    expect(memberGetPayload.error.message).toContain("member self-service route");
    expect(state.tenant.id).toBe("northside-athletics");
  });

  it("returns auth errors when owner-only mobile self-service routes are called without a session", async () => {
    const getResponse = await getOwnerMobileSelfServiceRoute(
      new NextRequest("http://localhost/api/platform/mobile-self-service", {
        method: "GET",
      }),
    );
    const getPayload = (await getResponse.json()) as {
      ok: boolean;
      error: {
        code: string;
      };
    };

    expect(getResponse.status).toBe(401);
    expect(getPayload.ok).toBe(false);
    expect(getPayload.error.code).toBe("AUTH_REQUIRED");

    const postResponse = await ownerMobileSelfServiceRoute(
      new NextRequest("http://localhost/api/platform/mobile-self-service", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
          [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
          [IDEMPOTENCY_HEADER]: crypto.randomUUID(),
        },
        body: JSON.stringify({
          operation: "request_pause",
          memberId: "member_missing",
          memberName: "Nina de Boer",
          startsAt: "2026-06-01",
          endsAt: "2026-06-15",
          reason: "Test zonder sessie",
        }),
      }),
    );
    const postPayload = (await postResponse.json()) as {
      ok: boolean;
      error: {
        code: string;
      };
    };

    expect(postResponse.status).toBe(401);
    expect(postPayload.ok).toBe(false);
    expect(postPayload.error.code).toBe("AUTH_REQUIRED");
  });
});
