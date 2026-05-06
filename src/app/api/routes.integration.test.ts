import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { PATCH as memberReservationCancelRoute } from "@/app/api/member/reservations/[bookingId]/cancel/route";
import {
  GET as memberMobileSelfServiceGetRoute,
  POST as memberMobileSelfServiceRoute,
} from "@/app/api/member/mobile-self-service/route";
import { POST as publicMemberSignupRoute } from "@/app/api/public/member-signups/route";
import { POST as publicReservationsRoute } from "@/app/api/public/reservations/route";
import { GET as csrfRoute } from "@/app/api/security/csrf/route";
import {
  authenticateLocalAccount,
  bootstrapLocalPlatform,
} from "@/server/persistence/platform-state";
import {
  IDEMPOTENCY_HEADER,
  MUTATION_CSRF_HEADER,
  createMutationCsrfToken,
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
const originalMollieApiKey = process.env.MOLLIE_API_KEY;
const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalFetch = globalThis.fetch;

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

function createMutationRequest(
  url: string,
  body: Record<string, unknown>,
  options?: {
    readonly method?: "PATCH" | "POST";
    readonly token?: string;
    readonly forwardedFor?: string;
  },
) {
  const headers = new Headers({
    origin: "http://localhost",
    "content-type": "application/json",
    "x-forwarded-for": options?.forwardedFor ?? `127.0.0.${Math.floor(Math.random() * 200) + 1}`,
    [MUTATION_CSRF_HEADER]: createMutationCsrfToken(),
    [IDEMPOTENCY_HEADER]: crypto.randomUUID(),
  });

  if (options?.token) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${options.token}`);
  }

  return new NextRequest(url, {
    method: options?.method ?? "POST",
    headers,
    body: JSON.stringify(body),
  });
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

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "gym-platform-routes-"));
  process.env.LOCAL_PLATFORM_STATE_FILE = path.join(tempDir, "platform-state.json");
  globalThis.__gymPlatformServices = undefined;
});

afterEach(async () => {
  delete process.env.LOCAL_PLATFORM_STATE_FILE;
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DB_NAME;
  delete process.env.CLAIMTECH_MONGO_SERVER_SELECTION_TIMEOUT_MS;
  if (originalMollieApiKey === undefined) {
    delete process.env.MOLLIE_API_KEY;
  } else {
    process.env.MOLLIE_API_KEY = originalMollieApiKey;
  }
  if (originalAppBaseUrl === undefined) {
    delete process.env.APP_BASE_URL;
  } else {
    process.env.APP_BASE_URL = originalAppBaseUrl;
  }
  globalThis.fetch = originalFetch;
  globalThis.__gymPlatformServices = undefined;
  await rm(tempDir, { recursive: true, force: true });
});

describe("api route integrations", () => {
  it("issues signed mutation security tokens for browser mutations", async () => {
    const response = await csrfRoute(
      new Request("http://localhost/api/security/csrf", {
        method: "GET",
      }),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        csrfToken: string;
        csrfHeader: string;
        idempotencyHeader: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.csrfToken).toMatch(/^v1\./);
    expect(payload.data.csrfHeader).toBe(MUTATION_CSRF_HEADER);
    expect(payload.data.idempotencyHeader).toBe(IDEMPOTENCY_HEADER);
  });

  it("retries the global services cache after an initial mongo boot failure", async () => {
    await bootstrapLocalPlatform({
      tenantName: "Retry Ready Gym",
      ownerName: "Retry Owner",
      ownerEmail: "owner@retry-ready.test",
      password: "strong-pass-123",
    });

    process.env.MONGODB_URI = "mongodb://127.0.0.1:1/gym-platform";
    process.env.MONGODB_DB_NAME = "gym-platform";
    process.env.CLAIMTECH_MONGO_SERVER_SELECTION_TIMEOUT_MS = "25";
    globalThis.__gymPlatformServices = undefined;

    await expect(getGymPlatformServices()).rejects.toThrow(
      "MongoDB-verbinding mislukt",
    );

    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DB_NAME;
    delete process.env.CLAIMTECH_MONGO_SERVER_SELECTION_TIMEOUT_MS;

    const services = await getGymPlatformServices();

    expect(services).toBeDefined();
  });

  it("logs owners into the dashboard and members into the reservation portal", async () => {
    const { state, ownerActor, services, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 60,
      managerName: "Saar de Jong",
      amenities: ["Sauna"],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["Club access"],
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

    const { response: ownerResponse } = await loginAndExtractSession(
      "owner@northside.test",
      "strong-pass-123",
    );
    const ownerBody = await ownerResponse.text();

    expect(ownerResponse.status).toBe(200);
    expect(ownerBody).toContain("/dashboard");
    expect(ownerResponse.headers.get("set-cookie")).toContain(SESSION_COOKIE_NAME);

    const { response: memberResponse } = await loginAndExtractSession(
      "nina@northside.test",
      "member-pass-123",
    );
    const memberBody = await memberResponse.text();

    expect(memberResponse.status).toBe(200);
    expect(memberBody).toContain("/reserve");
    expect(memberResponse.headers.get("set-cookie")).toContain(SESSION_COOKIE_NAME);

    const invalidFormData = new FormData();
    invalidFormData.set("email", "owner@northside.test");
    invalidFormData.set("password", "wrong-pass-123");
    const invalidResponse = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: invalidFormData,
      }),
    );

    expect(invalidResponse.status).toBe(303);
    expect(invalidResponse.headers.get("location")).toContain("/login");
    expect(invalidResponse.headers.get("location")).toContain("error=");
    expect(state.tenant.name).toBe("Northside Athletics");
  });

  it("supports the public signup flow through direct checkout and onboarding", async () => {
    const { state, ownerActor, services, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 80,
      managerName: "Saar de Jong",
      amenities: ["Cold plunge"],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["24/7 access"],
    });
    await services.updateLegalSettings(ownerActor, tenantContext, {
      termsUrl: "https://northside.test/voorwaarden",
      privacyUrl: "https://northside.test/privacy",
      sepaCreditorId: "NL00ZZZ123456780000",
      sepaMandateText:
        "Ik machtig Northside Athletics om mijn lidmaatschap via SEPA incasso te innen.",
      contractPdfTemplateKey: "contracts/templates/northside-v1.pdf",
      waiverStorageKey: "waivers/northside/signed/",
      waiverRetentionMonths: 84,
    });
    await services.updateBillingSettings(ownerActor, tenantContext, {
      enabled: true,
      provider: "mollie",
      profileLabel: "Northside Athletics Payments",
      profileId: "pfl_test_123456",
      settlementLabel: "Northside Club",
      supportEmail: "billing@northside.test",
      paymentMethods: ["direct_debit", "one_time", "payment_request"],
    });
    process.env.MOLLIE_API_KEY = "test_mollie_live_key";
    process.env.APP_BASE_URL = "https://gym.example";
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      if (target.endsWith("/customers") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            id: "cst_route_signup_1",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        target.endsWith("/customers/cst_route_signup_1/payments") &&
        init?.method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            id: "tr_route_signup_1",
            status: "open",
            _links: {
              checkout: {
                href: "https://pay.mollie.com/p/route-signup",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`Unhandled Mollie request: ${target}`);
    }) as typeof fetch;

    const signupResponse = await publicMemberSignupRoute(
      createMutationRequest("http://localhost/api/public/member-signups", {
        tenantSlug: state.tenant.id,
        fullName: "Lena Bakker",
        email: "lena@northside.test",
        phone: "0612345678",
        phoneCountry: "NL",
        membershipPlanId: membershipPlan.id,
        preferredLocationId: location.id,
        paymentMethod: "direct_debit",
        contractAccepted: true,
        waiverAccepted: true,
        portalPassword: "trial-pass-123",
        notes: "Wil graag in mei starten.",
      }),
    );
    const signupPayload = (await signupResponse.json()) as {
      ok: boolean;
      data: {
        signup: {
          id: string;
          status: string;
          approvedMemberId?: string;
        };
        member: {
          id: string;
          email: string;
        } | null;
        invoice: {
          memberId?: string;
          externalReference?: string;
        };
        checkoutUrl: string;
        providerPaymentId: string;
      };
    };

    expect(signupResponse.status).toBe(201);
    expect(signupPayload.ok).toBe(true);
    expect(signupPayload.data.signup.status).toBe("pending_review");
    expect(signupPayload.data.signup.approvedMemberId).toBeUndefined();
    expect(signupPayload.data.member).toBeNull();
    expect(signupPayload.data.invoice.memberId).toBeUndefined();
    expect(signupPayload.data.invoice.externalReference).toBe("tr_route_signup_1");
    expect(signupPayload.data.checkoutUrl).toBe("https://pay.mollie.com/p/route-signup");
    expect(signupPayload.data.providerPaymentId).toBe("tr_route_signup_1");

    const refreshedServices = await getGymPlatformServices();
    const refreshedTenantContext = refreshedServices.createRequestTenantContext(
      ownerActor,
      tenantContext.tenantId,
    );
    const dashboard = await refreshedServices.getDashboardSnapshot(
      ownerActor,
      refreshedTenantContext,
    );
    expect(dashboard.memberSignups).toHaveLength(1);
    expect(dashboard.memberSignups[0]?.status).toBe("pending_review");
    expect(dashboard.members.some((member) => member.email === "lena@northside.test")).toBe(false);
    expect(dashboard.billingBackoffice.invoices).toHaveLength(1);
    expect(dashboard.billingBackoffice.invoices[0]?.amountCents).toBe(11_900);
    expect(dashboard.billingBackoffice.invoices[0]?.source).toBe("signup_checkout");
    expect(dashboard.billingBackoffice.invoices[0]?.externalReference).toBe("tr_route_signup_1");
    expect(dashboard.waivers).toHaveLength(0);
  });

  it("creates reservations for authenticated members through the public route", async () => {
    const { state, ownerActor, services, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 50,
      managerName: "Saar de Jong",
      amenities: ["Recovery zone"],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["All classes"],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Romy de Wit",
      homeLocationId: location.id,
      specialties: ["Hyrox"],
      certifications: ["NASM-CPT"],
    });
    const session = await services.createClassSession(ownerActor, tenantContext, {
      title: "Forge HIIT",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-05-04T18:30:00.000Z",
      durationMinutes: 60,
      capacity: 16,
      level: "mixed",
      focus: "engine",
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

    const { token: memberToken } = await loginAndExtractSession(
      "nina@northside.test",
      "member-pass-123",
    );
    const reservationResponse = await publicReservationsRoute(
      createMutationRequest(
        "http://localhost/api/public/reservations",
        {
          tenantSlug: state.tenant.id,
          classSessionId: session.id,
          notes: "Ik neem een vriend mee naar de intake.",
        },
        { token: memberToken },
      ),
    );
    const reservationPayload = (await reservationResponse.json()) as {
      ok: boolean;
      data: {
        booking: {
          source: string;
          classSessionId: string;
        };
      };
    };

    expect(reservationResponse.status).toBe(201);
    expect(reservationPayload.ok).toBe(true);
    expect(reservationPayload.data.booking.source).toBe("member_app");
    expect(reservationPayload.data.booking.classSessionId).toBe(session.id);

    const refreshedServices = await getGymPlatformServices();
    const refreshedTenantContext = refreshedServices.createRequestTenantContext(
      ownerActor,
      tenantContext.tenantId,
    );
    const dashboard = await refreshedServices.getDashboardSnapshot(ownerActor, refreshedTenantContext, {
      page: "classes",
    });
    expect(dashboard.bookings).toHaveLength(1);
    expect(dashboard.bookings[0]?.source).toBe("member_app");
  });

  it("lets members cancel their own reservation from the member app", async () => {
    const { state, ownerActor, services, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 50,
      managerName: "Saar de Jong",
      amenities: ["Recovery zone"],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["All classes"],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Romy de Wit",
      homeLocationId: location.id,
      specialties: ["Hyrox"],
      certifications: ["NASM-CPT"],
    });
    const session = await services.createClassSession(ownerActor, tenantContext, {
      title: "Forge HIIT",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-05-04T18:30:00.000Z",
      durationMinutes: 60,
      capacity: 16,
      level: "mixed",
      focus: "engine",
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

    const { token: memberToken } = await loginAndExtractSession(
      "nina@northside.test",
      "member-pass-123",
    );
    const reservationResponse = await publicReservationsRoute(
      createMutationRequest(
        "http://localhost/api/public/reservations",
        {
          tenantSlug: state.tenant.id,
          classSessionId: session.id,
        },
        { token: memberToken },
      ),
    );
    const reservationPayload = (await reservationResponse.json()) as {
      data: {
        booking: {
          id: string;
          version: number;
        };
      };
    };

    const cancelResponse = await memberReservationCancelRoute(
      createMutationRequest(
        `http://localhost/api/member/reservations/${reservationPayload.data.booking.id}/cancel`,
        {
          tenantSlug: state.tenant.id,
          expectedVersion: reservationPayload.data.booking.version,
        },
        { method: "PATCH", token: memberToken },
      ),
      {
        params: Promise.resolve({ bookingId: reservationPayload.data.booking.id }),
      },
    );
    const cancelPayload = (await cancelResponse.json()) as {
      ok: boolean;
      data: {
        booking: {
          status: string;
        };
      };
    };

    expect(cancelResponse.status).toBe(200);
    expect(cancelPayload.ok).toBe(true);
    expect(cancelPayload.data.booking.status).toBe("cancelled");

    const refreshedServices = await getGymPlatformServices();
    const refreshedTenantContext = refreshedServices.createRequestTenantContext(
      ownerActor,
      tenantContext.tenantId,
    );
    const dashboard = await refreshedServices.getDashboardSnapshot(ownerActor, refreshedTenantContext, {
      page: "classes",
    });
    expect(dashboard.bookings[0]?.status).toBe("cancelled");
  });

  it("rejects anonymous public reservations and keeps booking member-only", async () => {
    const { state, ownerActor, services, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 50,
      managerName: "Saar de Jong",
      amenities: ["Recovery zone"],
    });
    await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Trial intake",
      priceMonthly: 0,
      billingCycle: "monthly",
      perks: ["Kennismakingsles"],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Romy de Wit",
      homeLocationId: location.id,
      specialties: ["Hyrox"],
      certifications: ["NASM-CPT"],
    });
    const session = await services.createClassSession(ownerActor, tenantContext, {
      title: "Forge Intro",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-05-04T18:30:00.000Z",
      durationMinutes: 60,
      capacity: 16,
      level: "beginner",
      focus: "intro",
    });

    const reservationResponse = await publicReservationsRoute(
      createMutationRequest("http://localhost/api/public/reservations", {
        tenantSlug: state.tenant.id,
        classSessionId: session.id,
        fullName: "Lena Jansen",
        email: "lena@northside.test",
        phone: "0612345678",
        phoneCountry: "NL",
        notes: "Eerste proefles.",
      }),
    );
    const reservationPayload = (await reservationResponse.json()) as {
      ok: boolean;
      error: {
        code: string;
        message: string;
      };
    };

    expect(reservationResponse.status).toBe(403);
    expect(reservationPayload.ok).toBe(false);
    expect(reservationPayload.error.code).toBe("FORBIDDEN");
    expect(reservationPayload.error.message).toContain("Boeken kan alleen als lid");

    const refreshedServices = await getGymPlatformServices();
    const refreshedTenantContext = refreshedServices.createRequestTenantContext(
      ownerActor,
      tenantContext.tenantId,
    );
    const dashboard = await refreshedServices.getDashboardSnapshot(
      ownerActor,
      refreshedTenantContext,
      { page: "members" },
    );
    expect(dashboard.members).toHaveLength(0);
    expect(dashboard.memberPortalAccessMemberIds).toHaveLength(0);
  });

  it("rejects anonymous public reservations before validating contact details", async () => {
    const response = await publicReservationsRoute(
      createMutationRequest("http://localhost/api/public/reservations", {
        tenantSlug: "northside-athletics",
        classSessionId: "class_missing",
      }),
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
    expect(payload.error.message).toContain("Boeken kan alleen als lid");
  });

  it("rejects invalid public member signups before they enter review", async () => {
    const { state, ownerActor, services, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 80,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["24/7 access"],
    });

    const response = await publicMemberSignupRoute(
      createMutationRequest("http://localhost/api/public/member-signups", {
        tenantSlug: state.tenant.id,
        fullName: "Lena Bakker",
        email: "lena@northside.test",
        phone: "0612345678",
        phoneCountry: "NL",
        membershipPlanId: membershipPlan.id,
        preferredLocationId: location.id,
        paymentMethod: "direct_debit",
        contractAccepted: false,
        waiverAccepted: true,
        portalPassword: "lena-member-123",
      }),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: {
        code: string;
        message: string;
      };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_INPUT");
    expect(payload.error.message).toContain("Contract en waiver");

    const refreshedServices = await getGymPlatformServices();
    const dashboard = await refreshedServices.getDashboardSnapshot(
      ownerActor,
      refreshedServices.createRequestTenantContext(ownerActor, tenantContext.tenantId),
    );
    expect(dashboard.memberSignups).toHaveLength(0);
  });

  it("lets members submit self-service requests and blocks owners on the member route", async () => {
    const { ownerActor, services, tenantContext } = await bootstrapOwnerPlatform();
    await services.updateFeatureFlag(ownerActor, tenantContext, {
      key: "mobile.white_label",
      enabled: true,
    });
    await services.updateFeatureFlag(ownerActor, tenantContext, {
      key: "billing.processing",
      enabled: true,
    });
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 90,
      managerName: "Saar de Jong",
      amenities: [],
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
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Romy de Wit",
      homeLocationId: location.id,
      specialties: ["Hyrox"],
      certifications: ["NASM-CPT"],
    });
    const session = await services.createClassSession(ownerActor, tenantContext, {
      title: "Forge HIIT",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-06-04T18:30:00.000Z",
      durationMinutes: 60,
      capacity: 16,
      level: "mixed",
      focus: "engine",
    });
    await services.createBooking(ownerActor, tenantContext, {
      classSessionId: session.id,
      memberId: member.id,
      idempotencyKey: "member-native-profile-booking",
      source: "member_app",
    });
    const invoice = await services.createBillingInvoice(ownerActor, tenantContext, {
      memberId: member.id,
      memberName: member.fullName,
      description: "Juni lidmaatschap",
      amountCents: 11900,
      dueAt: "2026-06-01T08:00:00.000Z",
      source: "membership",
    });
    await services.recordBillingWebhook(ownerActor, tenantContext, {
      invoiceId: invoice.id,
      eventType: "payment.paid",
      status: "processed",
      providerReference: "tr_member_paid",
      payloadSummary: "Payment successful",
    });

    const { token: memberToken } = await loginAndExtractSession(
      "nina@northside.test",
      "member-pass-123",
    );
    const profileResponse = await memberMobileSelfServiceGetRoute(
      new NextRequest("http://localhost/api/member/mobile-self-service", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${memberToken}`,
        },
      }),
    );
    const profilePayload = (await profileResponse.json()) as {
      ok: boolean;
      data: {
        member: {
          displayName: string;
        };
        checkInPass: {
          code: string;
          payload: string;
          qrDataUrl: string;
        };
        nextTraining: {
          title: string;
          locationName: string;
          startsAt: string;
        } | null;
        paymentReturn?: {
          verified: boolean;
          tenantSlug: string | null;
          tenantName: string;
          invoiceId: string | null;
          status: string;
          amountLabel?: string;
          message: string;
        };
      };
    };

    expect(profileResponse.status).toBe(200);
    expect(profilePayload.ok).toBe(true);
    expect(profilePayload.data.member.displayName).toBe("Nina de Boer");
    expect(profilePayload.data.checkInPass.code).not.toBe("GYMOS-HOMEGYM");
    expect(profilePayload.data.checkInPass.payload).toContain("gymos://member/check-in");
    expect(profilePayload.data.checkInPass.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(profilePayload.data.nextTraining).toMatchObject({
      title: "Forge HIIT",
      locationName: "Northside East",
      startsAt: "2026-06-04T18:30:00.000Z",
    });

    const paymentReturnResponse = await memberMobileSelfServiceGetRoute(
      new NextRequest(
        `http://localhost/api/member/mobile-self-service?tenant=${tenantContext.tenantId}&invoice=${invoice.id}`,
        {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${memberToken}`,
          },
        },
      ),
    );
    const paymentReturnPayload = (await paymentReturnResponse.json()) as typeof profilePayload;

    expect(paymentReturnResponse.status).toBe(200);
    expect(paymentReturnPayload.ok).toBe(true);
    expect(paymentReturnPayload.data.paymentReturn).toMatchObject({
      verified: true,
      tenantSlug: tenantContext.tenantId,
      tenantName: "Northside Athletics",
      invoiceId: invoice.id,
      status: "paid",
      amountLabel: "EUR 119,00",
      message: expect.stringContaining("Betaling bevestigd"),
    });

    const pushResponse = await memberMobileSelfServiceRoute(
      createMutationRequest(
        "http://localhost/api/member/mobile-self-service",
        {
          operation: "register_push_token",
          token: "ExponentPushToken[nina-device-token]",
          platform: "ios",
          deviceId: "ios-device-1",
          permission: "granted",
        },
        { token: memberToken },
      ),
    );
    const pushPayload = (await pushResponse.json()) as {
      ok: boolean;
      data: {
        memberId: string;
        platform: string;
        tokenPreview: string;
        tokenHash: string;
      };
    };

    expect(pushResponse.status).toBe(200);
    expect(pushPayload.ok).toBe(true);
    expect(pushPayload.data.memberId).toBe(member.id);
    expect(pushPayload.data.platform).toBe("ios");
    expect(pushPayload.data.tokenPreview).toContain("nina");
    expect(pushPayload.data.tokenHash).not.toContain("nina-device-token");

    const memberResponse = await memberMobileSelfServiceRoute(
      createMutationRequest(
        "http://localhost/api/member/mobile-self-service",
        {
          operation: "request_pause",
          memberId: member.id,
          memberName: "Nina de Boer",
          startsAt: "2026-06-01",
          endsAt: "2026-06-15",
          reason: "Vakantie in Spanje",
        },
        { token: memberToken },
      ),
    );
    const memberPayload = (await memberResponse.json()) as {
      ok: boolean;
      data: {
        reason: string;
      };
    };

    expect(memberResponse.status).toBe(200);
    expect(memberPayload.ok).toBe(true);
    expect(memberPayload.data.reason).toBe("Vakantie in Spanje");

    const { token: ownerToken } = await loginAndExtractSession(
      "owner@northside.test",
      "strong-pass-123",
    );
    const ownerResponse = await memberMobileSelfServiceRoute(
      createMutationRequest(
        "http://localhost/api/member/mobile-self-service",
        {
          operation: "request_pause",
          memberId: member.id,
          memberName: "Nina de Boer",
          startsAt: "2026-06-01",
          endsAt: "2026-06-15",
          reason: "Dit mag niet via owner-auth",
        },
        { token: ownerToken },
      ),
    );
    const ownerPayload = (await ownerResponse.json()) as {
      ok: boolean;
      error: {
        message: string;
      };
    };

    expect(ownerResponse.status).toBe(403);
    expect(ownerPayload.ok).toBe(false);
    expect(ownerPayload.error.message).toContain("alleen voor member self-service");

    const deletionResponse = await memberMobileSelfServiceRoute(
      createMutationRequest(
        "http://localhost/api/member/mobile-self-service",
        {
          operation: "request_account_deletion",
          memberId: member.id,
          memberName: "Nina de Boer",
          email: "nina@northside.test",
          reason: "Ik wil mijn ledenapp-account verwijderen.",
        },
        { token: memberToken },
      ),
    );
    const deletionPayload = (await deletionResponse.json()) as {
      ok: boolean;
      data: {
        deletedPortalAccounts: number;
        request: {
          status: string;
          email: string;
        };
      };
    };

    expect(deletionResponse.status).toBe(200);
    expect(deletionPayload.ok).toBe(true);
    expect(deletionPayload.data.deletedPortalAccounts).toBe(1);
    expect(deletionPayload.data.request.status).toBe("approved");
    await expect(
      authenticateLocalAccount("nina@northside.test", "member-pass-123"),
    ).resolves.toBeNull();

    const refreshedServices = await getGymPlatformServices();
    const refreshedTenantContext = refreshedServices.createRequestTenantContext(
      ownerActor,
      tenantContext.tenantId,
    );
    const dashboard = await refreshedServices.getDashboardSnapshot(ownerActor, refreshedTenantContext, {
      page: "mobile",
    });
    expect(dashboard.mobileSelfService.pauseRequests).toHaveLength(1);
    expect(dashboard.mobileSelfService.pauseRequests[0]?.memberId).toBe(member.id);
    expect(dashboard.mobileSelfService.pushSubscriptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberId: member.id,
          platform: "ios",
          status: "active",
        }),
      ]),
    );
    expect(dashboard.mobileSelfService.accountDeletionRequests).toHaveLength(1);
    expect(dashboard.mobileSelfService.accountDeletionRequests[0]?.email).toBe(
      "nina@northside.test",
    );
  });

  it("returns auth errors when the member self-service route is called without a session", async () => {
    const response = await memberMobileSelfServiceRoute(
      createMutationRequest("http://localhost/api/member/mobile-self-service", {
        operation: "request_pause",
        memberId: "member_missing",
        memberName: "Nina de Boer",
        startsAt: "2026-06-01",
        endsAt: "2026-06-15",
        reason: "Vakantie in Spanje",
      }),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: {
        code: string;
      };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("AUTH_REQUIRED");
  });
});
