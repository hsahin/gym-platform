import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PATCH as reviewMemberSignup } from "@/app/api/platform/member-signups/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as memberMobileSelfServiceRoute } from "@/app/api/member/mobile-self-service/route";
import { POST as publicMemberSignupRoute } from "@/app/api/public/member-signups/route";
import { POST as publicReservationsRoute } from "@/app/api/public/reservations/route";
import {
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
    [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
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
  globalThis.__gymPlatformServices = undefined;
  await rm(tempDir, { recursive: true, force: true });
});

describe("api route integrations", () => {
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

  it("supports the public signup flow through owner approval and invoice creation", async () => {
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
        notes: "Wil graag in mei starten.",
      }),
    );
    const signupPayload = (await signupResponse.json()) as {
      ok: boolean;
      data: {
        id: string;
        status: string;
      };
    };

    expect(signupResponse.status).toBe(201);
    expect(signupPayload.ok).toBe(true);
    expect(signupPayload.data.status).toBe("pending_review");

    const { token: ownerToken } = await loginAndExtractSession(
      "owner@northside.test",
      "strong-pass-123",
    );
    const approvalResponse = await reviewMemberSignup(
      createMutationRequest(
        "http://localhost/api/platform/member-signups",
        {
          signupRequestId: signupPayload.data.id,
          decision: "approved",
          ownerNotes: "Welkomstcall gepland.",
          memberStatus: "trial",
          portalPassword: "trial-pass-123",
        },
        { method: "PATCH", token: ownerToken },
      ),
    );
    const approvalPayload = (await approvalResponse.json()) as {
      ok: boolean;
      data: {
        signup: {
          status: string;
          approvedMemberId?: string;
        };
      };
    };

    expect(approvalResponse.status).toBe(200);
    expect(approvalPayload.data.signup.status).toBe("approved");
    expect(approvalPayload.data.signup.approvedMemberId).toBeTruthy();

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
    expect(dashboard.memberSignups[0]?.status).toBe("approved");
    expect(dashboard.members.some((member) => member.email === "lena@northside.test")).toBe(true);
    expect(dashboard.billingBackoffice.invoices).toHaveLength(1);
    expect(dashboard.billingBackoffice.invoices[0]?.amountCents).toBe(11_900);
    expect(dashboard.billingBackoffice.invoices[0]?.source).toBe("signup_checkout");
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

  it("rejects public reservations without a logged-in member session", async () => {
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
    expect(payload.error.message).toContain("Log eerst in");
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

    const { token: memberToken } = await loginAndExtractSession(
      "nina@northside.test",
      "member-pass-123",
    );
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
