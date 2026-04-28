import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import {
  GET as getAppointmentsRoute,
  POST as appointmentsRoute,
} from "@/app/api/platform/appointments/route";
import {
  GET as getBillingBackofficeRoute,
  POST as billingBackofficeRoute,
} from "@/app/api/platform/billing-backoffice/route";
import { POST as mollieWebhookRoute } from "@/app/api/platform/billing/mollie/webhook/route";
import { POST as billingPreviewRoute } from "@/app/api/platform/billing/preview/route";
import { POST as billingRoute } from "@/app/api/platform/billing/route";
import {
  GET as getBookingPolicyRoute,
  POST as bookingPolicyRoute,
} from "@/app/api/platform/booking-policy/route";
import { POST as bookingSettingsRoute } from "@/app/api/platform/booking-settings/route";
import { PATCH as attendanceRoute } from "@/app/api/platform/bookings/[bookingId]/attendance/route";
import { PATCH as cancelBookingRoute } from "@/app/api/platform/bookings/[bookingId]/cancel/route";
import {
  GET as getBookingsRoute,
  POST as bookingsRoute,
} from "@/app/api/platform/bookings/route";
import {
  DELETE as deleteClassRoute,
  GET as getClassesRoute,
  PATCH as patchClassRoute,
  POST as classesRoute,
} from "@/app/api/platform/classes/route";
import { POST as coachingSettingsRoute } from "@/app/api/platform/coaching-settings/route";
import {
  GET as getCollectionCasesRoute,
  PATCH as patchCollectionCaseRoute,
  POST as collectionCasesRoute,
} from "@/app/api/platform/collection-cases/route";
import {
  GET as getCommunityRoute,
  POST as communityRoute,
} from "@/app/api/platform/community/route";
import { POST as featureFlagsRoute } from "@/app/api/platform/feature-flags/route";
import { GET as healthRoute } from "@/app/api/platform/health/route";
import { POST as importContractsRoute } from "@/app/api/platform/import/contracts/route";
import { POST as integrationSettingsRoute } from "@/app/api/platform/integration-settings/route";
import {
  GET as getLeadAutomationRoute,
  POST as leadAutomationRoute,
} from "@/app/api/platform/lead-automation/route";
import {
  GET as getLeadsRoute,
  PATCH as patchLeadRoute,
  POST as leadsRoute,
} from "@/app/api/platform/leads/route";
import { GET as getLegalRoute, POST as legalRoute } from "@/app/api/platform/legal/route";
import {
  DELETE as deleteLocationRoute,
  GET as getLocationsRoute,
  PATCH as patchLocationRoute,
  POST as locationsRoute,
} from "@/app/api/platform/locations/route";
import { POST as marketingSettingsRoute } from "@/app/api/platform/marketing-settings/route";
import { POST as memberPortalAccessRoute } from "@/app/api/platform/member-portal-access/route";
import { GET as getMemberSignupsRoute } from "@/app/api/platform/member-signups/route";
import {
  DELETE as deleteMemberRoute,
  GET as getMembersRoute,
  PATCH as patchMemberRoute,
  POST as membersRoute,
} from "@/app/api/platform/members/route";
import {
  DELETE as deleteMembershipPlanRoute,
  GET as getMembershipPlansRoute,
  PATCH as patchMembershipPlanRoute,
  POST as membershipPlansRoute,
} from "@/app/api/platform/membership-plans/route";
import {
  GET as getOwnerMobileSelfServiceRoute,
  POST as ownerMobileSelfServiceRoute,
} from "@/app/api/platform/mobile-self-service/route";
import { POST as mobileSettingsRoute } from "@/app/api/platform/mobile-settings/route";
import { GET as overviewRoute } from "@/app/api/platform/overview/route";
import { POST as remoteAccessOpenRoute } from "@/app/api/platform/remote-access/open/route";
import { POST as remoteAccessRoute } from "@/app/api/platform/remote-access/route";
import { POST as retentionSettingsRoute } from "@/app/api/platform/retention-settings/route";
import { POST as revenueSettingsRoute } from "@/app/api/platform/revenue-settings/route";
import {
  DELETE as deleteStaffRoute,
  GET as getStaffRoute,
  PATCH as patchStaffRoute,
  POST as staffRoute,
} from "@/app/api/platform/staff/route";
import {
  DELETE as deleteTrainerRoute,
  GET as getTrainersRoute,
  PATCH as patchTrainerRoute,
  POST as trainersRoute,
} from "@/app/api/platform/trainers/route";
import { POST as memberMobileSelfServiceRoute } from "@/app/api/member/mobile-self-service/route";
import { POST as publicMemberSignupRoute } from "@/app/api/public/member-signups/route";
import { POST as publicReservationsRoute } from "@/app/api/public/reservations/route";
import {
  IDEMPOTENCY_HEADER,
  MUTATION_CSRF_HEADER,
  MUTATION_CSRF_TOKEN,
} from "@/server/http/platform-api";
import { bootstrapLocalPlatform } from "@/server/persistence/platform-state";
import { SESSION_COOKIE_NAME } from "@/server/runtime/demo-session";

type VersionedRecord = {
  readonly id: string;
  readonly version: number;
  readonly [key: string]: unknown;
};

type IdentifiedRecord = {
  readonly id: string;
  readonly [key: string]: unknown;
};

type StaffRecord = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly roleKey: string;
  readonly updatedAt: string;
  readonly [key: string]: unknown;
};

let tempDir = "";
const originalMollieApiKey = process.env.MOLLIE_API_KEY;
const originalMollieWebhookSecret = process.env.MOLLIE_WEBHOOK_SECRET;
const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalNukiApiToken = process.env.NUKI_API_TOKEN;
const originalFetch = globalThis.fetch;

function createJsonRequest(
  url: string,
  body: Record<string, unknown>,
  token: string,
  method: "DELETE" | "PATCH" | "POST" = "POST",
) {
  return new NextRequest(url, {
    method,
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      "x-forwarded-for": `127.0.1.${Math.floor(Math.random() * 200) + 1}`,
      [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
      [IDEMPOTENCY_HEADER]: crypto.randomUUID(),
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
    body: JSON.stringify(body),
  });
}

function createPublicJsonRequest(url: string, body: Record<string, unknown>, token?: string) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      "x-forwarded-for": `127.0.2.${Math.floor(Math.random() * 200) + 1}`,
      [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
      [IDEMPOTENCY_HEADER]: crypto.randomUUID(),
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function createGetRequest(url: string, token: string) {
  return new NextRequest(url, {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
  });
}

async function expectOk<TData>(
  responseOrPromise: Promise<Response> | Response,
  expectedStatus = 200,
) {
  const response = await responseOrPromise;
  const payload = (await response.json()) as {
    ok: boolean;
    data: TData;
    error?: { message: string };
  };

  expect(response.status, payload.error?.message).toBe(expectedStatus);
  expect(payload.ok, payload.error?.message).toBe(true);

  return payload.data;
}

async function enableFeature(token: string, key: string) {
  await expectOk(
    featureFlagsRoute(
      createJsonRequest("http://localhost/api/platform/feature-flags", {
        key,
        enabled: true,
      }, token),
    ),
    201,
  );
}

async function enableFeatures(token: string, keys: ReadonlyArray<string>) {
  for (const key of keys) {
    await enableFeature(token, key);
  }
}

async function loginAndExtractSession(email = "owner@northside.test", password = "strong-pass-123") {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);

  const response = await loginRoute(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: formData,
    }),
  );
  const token = response.headers
    .get("set-cookie")
    ?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];

  expect(response.status).toBe(200);
  expect(token).toBeTruthy();

  return token!;
}

function asVersioned(data: unknown) {
  expect(data).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      version: expect.any(Number),
    }),
  );

  return data as VersionedRecord;
}

function asIdentified(data: unknown) {
  expect(data).toEqual(
    expect.objectContaining({
      id: expect.any(String),
    }),
  );

  return data as IdentifiedRecord;
}

function asStaff(data: unknown) {
  expect(data).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      updatedAt: expect.any(String),
    }),
  );

  return data as StaffRecord;
}

async function bootstrapOwner() {
  await bootstrapLocalPlatform({
    tenantName: "Northside Athletics",
    ownerName: "Amina Hassan",
    ownerEmail: "owner@northside.test",
    password: "strong-pass-123",
  });

  return loginAndExtractSession();
}

async function createCoreDataset(token: string) {
  const location = asVersioned(
    await expectOk(
      locationsRoute(
        createJsonRequest("http://localhost/api/platform/locations", {
          name: "Northside East",
          city: "Amsterdam",
          neighborhood: "Oost",
          capacity: 80,
          managerName: "Saar de Jong",
          amenities: ["Recovery"],
        }, token),
      ),
      201,
    ),
  );
  const plan = asVersioned(
    await expectOk(
      membershipPlansRoute(
        createJsonRequest("http://localhost/api/platform/membership-plans", {
          name: "Unlimited",
          priceMonthly: 119,
          billingCycle: "monthly",
          perks: ["Alle lessen"],
        }, token),
      ),
      201,
    ),
  );
  const trainer = asVersioned(
    await expectOk(
      trainersRoute(
        createJsonRequest("http://localhost/api/platform/trainers", {
          fullName: "Romy de Wit",
          homeLocationId: location.id,
          specialties: ["Hyrox"],
          certifications: ["NASM"],
        }, token),
      ),
      201,
    ),
  );
  const member = asVersioned(
    await expectOk(
      membersRoute(
        createJsonRequest("http://localhost/api/platform/members", {
          fullName: "Nina de Boer",
          email: "nina@northside.test",
          phone: "0611112222",
          phoneCountry: "NL",
          membershipPlanId: plan.id,
          homeLocationId: location.id,
          status: "active",
          tags: ["mobile"],
          waiverStatus: "complete",
          portalPassword: "member-pass-123",
        }, token),
      ),
      201,
    ),
  );
  const classSession = asVersioned(
    await expectOk(
      classesRoute(
        createJsonRequest("http://localhost/api/platform/classes", {
          title: "Forge HIIT",
          locationId: location.id,
          trainerId: trainer.id,
          startsAt: "2026-05-04T18:30:00.000Z",
          durationMinutes: 60,
          capacity: 16,
          level: "mixed",
          focus: "engine",
        }, token),
      ),
      201,
    ),
  );

  return {
    classSession,
    location,
    member,
    plan,
    trainer,
  };
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "gym-platform-system-flows-"));
  process.env.LOCAL_PLATFORM_STATE_FILE = path.join(tempDir, "platform-state.json");
  globalThis.__gymPlatformServices = undefined;
});

afterEach(async () => {
  delete process.env.LOCAL_PLATFORM_STATE_FILE;
  if (originalMollieApiKey === undefined) {
    delete process.env.MOLLIE_API_KEY;
  } else {
    process.env.MOLLIE_API_KEY = originalMollieApiKey;
  }
  if (originalMollieWebhookSecret === undefined) {
    delete process.env.MOLLIE_WEBHOOK_SECRET;
  } else {
    process.env.MOLLIE_WEBHOOK_SECRET = originalMollieWebhookSecret;
  }
  if (originalAppBaseUrl === undefined) {
    delete process.env.APP_BASE_URL;
  } else {
    process.env.APP_BASE_URL = originalAppBaseUrl;
  }
  if (originalNukiApiToken === undefined) {
    delete process.env.NUKI_API_TOKEN;
  } else {
    process.env.NUKI_API_TOKEN = originalNukiApiToken;
  }
  globalThis.fetch = originalFetch;
  globalThis.__gymPlatformServices = undefined;
  await rm(tempDir, { recursive: true, force: true });
});

describe("system flow integrations", () => {
  it("covers owner CRUD, booking, attendance, cancellation, and logout flows", async () => {
    const token = await bootstrapOwner();
    const { classSession, location, member, plan, trainer } = await createCoreDataset(token);

    await expectOk(
      overviewRoute(createGetRequest("http://localhost/api/platform/overview", token)),
    );
    await expectOk<unknown[]>(
      getLocationsRoute(createGetRequest("http://localhost/api/platform/locations", token)),
    );
    const updatedLocation = asVersioned(
      await expectOk(
        patchLocationRoute(
          createJsonRequest(
            "http://localhost/api/platform/locations",
            {
              id: location.id,
              expectedVersion: location.version,
              name: "Northside East XL",
              city: "Amsterdam",
              neighborhood: "Oost",
              capacity: 90,
              managerName: "Saar de Jong",
              amenities: ["Recovery", "Sauna"],
              status: "active",
            },
            token,
            "PATCH",
          ),
        ),
      ),
    );
    const scratchLocation = asVersioned(
      await expectOk(
        locationsRoute(
          createJsonRequest("http://localhost/api/platform/locations", {
            name: "Scratch Club",
            city: "Utrecht",
            neighborhood: "Centrum",
            capacity: 20,
            managerName: "Test Manager",
            amenities: [],
          }, token),
        ),
        201,
      ),
    );
    await expectOk(
      deleteLocationRoute(
        createJsonRequest(
          "http://localhost/api/platform/locations",
          { id: scratchLocation.id, expectedVersion: scratchLocation.version },
          token,
          "DELETE",
        ),
      ),
    );

    const membershipPlans = await expectOk<VersionedRecord[]>(
      getMembershipPlansRoute(
        createGetRequest("http://localhost/api/platform/membership-plans", token),
      ),
    );
    const currentPlan = asVersioned(
      membershipPlans.find((entry) => entry.id === plan.id),
    );
    const updatedPlan = asVersioned(
      await expectOk(
        patchMembershipPlanRoute(
          createJsonRequest(
            "http://localhost/api/platform/membership-plans",
            {
              id: plan.id,
              expectedVersion: currentPlan.version,
              name: "Unlimited Plus",
              priceMonthly: 129,
              billingCycle: "annual",
              perks: ["Alle lessen", "Open gym"],
              status: "active",
            },
            token,
            "PATCH",
          ),
        ),
      ),
    );
    const scratchPlan = asVersioned(
      await expectOk(
        membershipPlansRoute(
          createJsonRequest("http://localhost/api/platform/membership-plans", {
            name: "Scratch Plan",
            priceMonthly: 49,
            billingCycle: "monthly",
            perks: ["Test"],
          }, token),
        ),
        201,
      ),
    );
    await expectOk(
      deleteMembershipPlanRoute(
        createJsonRequest(
          "http://localhost/api/platform/membership-plans",
          { id: scratchPlan.id, expectedVersion: scratchPlan.version },
          token,
          "DELETE",
        ),
      ),
    );

    const trainers = await expectOk<VersionedRecord[]>(
      getTrainersRoute(createGetRequest("http://localhost/api/platform/trainers", token)),
    );
    const currentTrainer = asVersioned(
      trainers.find((entry) => entry.id === trainer.id),
    );
    const updatedTrainer = asVersioned(
      await expectOk(
        patchTrainerRoute(
          createJsonRequest(
            "http://localhost/api/platform/trainers",
            {
              id: trainer.id,
              expectedVersion: currentTrainer.version,
              fullName: "Romy de Wit",
              homeLocationId: location.id,
              specialties: ["Hyrox", "Strength"],
              certifications: ["NASM"],
              status: "active",
            },
            token,
            "PATCH",
          ),
        ),
      ),
    );
    const scratchTrainer = asVersioned(
      await expectOk(
        trainersRoute(
          createJsonRequest("http://localhost/api/platform/trainers", {
            fullName: "Scratch Trainer",
            homeLocationId: location.id,
            specialties: ["Test"],
            certifications: [],
          }, token),
        ),
        201,
      ),
    );
    await expectOk(
      deleteTrainerRoute(
        createJsonRequest(
          "http://localhost/api/platform/trainers",
          { id: scratchTrainer.id, expectedVersion: scratchTrainer.version },
          token,
          "DELETE",
        ),
      ),
    );

    const members = await expectOk<VersionedRecord[]>(
      getMembersRoute(createGetRequest("http://localhost/api/platform/members", token)),
    );
    const currentMember = asVersioned(members.find((entry) => entry.id === member.id));
    const updatedMember = asVersioned(
      await expectOk(
        patchMemberRoute(
          createJsonRequest(
            "http://localhost/api/platform/members",
            {
              id: member.id,
              expectedVersion: currentMember.version,
              fullName: "Nina de Boer",
              email: "nina@northside.test",
              phone: "0611112222",
              phoneCountry: "NL",
              membershipPlanId: plan.id,
              homeLocationId: location.id,
              status: "active",
              tags: ["mobile", "hyrox"],
              waiverStatus: "complete",
            },
            token,
            "PATCH",
          ),
        ),
      ),
    );
    const scratchMember = asVersioned(
      await expectOk(
        membersRoute(
          createJsonRequest("http://localhost/api/platform/members", {
            fullName: "Scratch Member",
            email: "scratch.member@northside.test",
            phone: "0699999999",
            phoneCountry: "NL",
            membershipPlanId: plan.id,
            homeLocationId: location.id,
            status: "trial",
            tags: ["test"],
            waiverStatus: "pending",
          }, token),
        ),
        201,
      ),
    );
    await expectOk(
      deleteMemberRoute(
        createJsonRequest(
          "http://localhost/api/platform/members",
          { id: scratchMember.id, expectedVersion: scratchMember.version },
          token,
          "DELETE",
        ),
      ),
    );

    const classes = await expectOk<VersionedRecord[]>(
      getClassesRoute(createGetRequest("http://localhost/api/platform/classes", token)),
    );
    const currentClassSession = asVersioned(
      classes.find((entry) => entry.id === classSession.id),
    );
    const updatedClassSession = asVersioned(
      await expectOk(
        patchClassRoute(
          createJsonRequest(
            "http://localhost/api/platform/classes",
            {
              id: classSession.id,
              expectedVersion: currentClassSession.version,
              title: "Forge HIIT Pro",
              locationId: location.id,
              trainerId: trainer.id,
              startsAt: "2026-05-04T18:30:00.000Z",
              durationMinutes: 60,
              capacity: 18,
              level: "advanced",
              focus: "engine",
              status: "active",
            },
            token,
            "PATCH",
          ),
        ),
      ),
    );
    const scratchClass = asVersioned(
      await expectOk(
        classesRoute(
          createJsonRequest("http://localhost/api/platform/classes", {
            title: "Scratch Class",
            locationId: location.id,
            trainerId: trainer.id,
            startsAt: "2026-05-05T18:30:00.000Z",
            durationMinutes: 45,
            capacity: 6,
            level: "beginner",
            focus: "test",
          }, token),
        ),
        201,
      ),
    );
    await expectOk(
      deleteClassRoute(
        createJsonRequest(
          "http://localhost/api/platform/classes",
          { id: scratchClass.id, expectedVersion: scratchClass.version },
          token,
          "DELETE",
        ),
      ),
    );

    const bookingResult = await expectOk<{ booking: VersionedRecord }>(
      bookingsRoute(
        createJsonRequest("http://localhost/api/platform/bookings", {
          classSessionId: classSession.id,
          memberId: member.id,
          phone: "0611112222",
          phoneCountry: "NL",
          notes: "Frontdesk test",
          source: "frontdesk",
        }, token),
      ),
      201,
    );
    await expectOk<unknown[]>(
      getBookingsRoute(createGetRequest("http://localhost/api/platform/bookings", token)),
    );
    const attendedBooking = asVersioned(
      await expectOk(
        attendanceRoute(
          createJsonRequest(
            `http://localhost/api/platform/bookings/${bookingResult.booking.id}/attendance`,
            {
              expectedVersion: bookingResult.booking.version,
              channel: "frontdesk",
            },
            token,
            "PATCH",
          ),
          { params: Promise.resolve({ bookingId: bookingResult.booking.id }) },
        ),
      ),
    );
    expect(attendedBooking.status).toBe("checked_in");
    const cancelMember = asVersioned(
      await expectOk(
        membersRoute(
          createJsonRequest("http://localhost/api/platform/members", {
            fullName: "Cancel Member",
            email: "cancel.member@northside.test",
            phone: "0655555555",
            phoneCountry: "NL",
            membershipPlanId: plan.id,
            homeLocationId: location.id,
            status: "active",
            tags: ["cancel-test"],
            waiverStatus: "complete",
          }, token),
        ),
        201,
      ),
    );
    const cancelBookingResult = await expectOk<{ booking: VersionedRecord }>(
      bookingsRoute(
        createJsonRequest("http://localhost/api/platform/bookings", {
          classSessionId: classSession.id,
          memberId: cancelMember.id,
          phone: "0655555555",
          phoneCountry: "NL",
          notes: "Cancel test",
          source: "frontdesk",
        }, token),
      ),
      201,
    );
    const cancelledBooking = await expectOk<{ booking: VersionedRecord }>(
      cancelBookingRoute(
        createJsonRequest(
          `http://localhost/api/platform/bookings/${cancelBookingResult.booking.id}/cancel`,
          { expectedVersion: cancelBookingResult.booking.version },
          token,
          "PATCH",
        ),
        { params: Promise.resolve({ bookingId: cancelBookingResult.booking.id }) },
      ),
    );
    expect(cancelledBooking.booking.status).toBe("cancelled");

    const classToArchive = asVersioned(
      (
        await expectOk<VersionedRecord[]>(
          getClassesRoute(createGetRequest("http://localhost/api/platform/classes", token)),
        )
      ).find((entry) => entry.id === updatedClassSession.id),
    );
    const memberToArchive = asVersioned(
      (
        await expectOk<VersionedRecord[]>(
          getMembersRoute(createGetRequest("http://localhost/api/platform/members", token)),
        )
      ).find((entry) => entry.id === updatedMember.id),
    );
    const trainerToArchive = asVersioned(
      (
        await expectOk<VersionedRecord[]>(
          getTrainersRoute(createGetRequest("http://localhost/api/platform/trainers", token)),
        )
      ).find((entry) => entry.id === updatedTrainer.id),
    );
    await expectOk(
      patchClassRoute(
        createJsonRequest(
          "http://localhost/api/platform/classes",
          { operation: "archive", id: classToArchive.id, expectedVersion: classToArchive.version },
          token,
          "PATCH",
        ),
      ),
    );
    await expectOk(
      patchMemberRoute(
        createJsonRequest(
          "http://localhost/api/platform/members",
          { operation: "archive", id: memberToArchive.id, expectedVersion: memberToArchive.version },
          token,
          "PATCH",
        ),
      ),
    );
    await expectOk(
      patchTrainerRoute(
        createJsonRequest(
          "http://localhost/api/platform/trainers",
          { operation: "archive", id: trainerToArchive.id, expectedVersion: trainerToArchive.version },
          token,
          "PATCH",
        ),
      ),
    );
    const latestPlanToArchive = asVersioned(
      (
        await expectOk<VersionedRecord[]>(
          getMembershipPlansRoute(
            createGetRequest("http://localhost/api/platform/membership-plans", token),
          ),
        )
      ).find((entry) => entry.id === updatedPlan.id),
    );
    await expectOk(
      patchMembershipPlanRoute(
        createJsonRequest(
          "http://localhost/api/platform/membership-plans",
          { operation: "archive", id: latestPlanToArchive.id, expectedVersion: latestPlanToArchive.version },
          token,
          "PATCH",
        ),
      ),
    );
    const latestLocationToArchive = asVersioned(
      (
        await expectOk<VersionedRecord[]>(
          getLocationsRoute(createGetRequest("http://localhost/api/platform/locations", token)),
        )
      ).find((entry) => entry.id === updatedLocation.id),
    );
    await expectOk(
      patchLocationRoute(
        createJsonRequest(
          "http://localhost/api/platform/locations",
          { operation: "archive", id: latestLocationToArchive.id, expectedVersion: latestLocationToArchive.version },
          token,
          "PATCH",
        ),
      ),
    );

    const staff = asStaff(
      await expectOk(
        staffRoute(
          createJsonRequest("http://localhost/api/platform/staff", {
            displayName: "Ops Manager",
            email: "ops.manager@northside.test",
            password: "ops-pass-123",
            roleKey: "manager",
          }, token),
        ),
        201,
      ),
    );
    await expectOk<unknown[]>(
      getStaffRoute(createGetRequest("http://localhost/api/platform/staff", token)),
    );
    const updatedStaff = asStaff(
      await expectOk(
        patchStaffRoute(
          createJsonRequest(
            "http://localhost/api/platform/staff",
            {
              userId: staff.id,
              expectedUpdatedAt: staff.updatedAt,
              displayName: "Operations Manager",
              email: "ops.manager@northside.test",
              roleKey: "manager",
              status: "active",
            },
            token,
            "PATCH",
          ),
        ),
      ),
    );
    await expectOk(
      patchStaffRoute(
        createJsonRequest(
          "http://localhost/api/platform/staff",
          {
            operation: "archive",
            userId: updatedStaff.id,
            expectedUpdatedAt: updatedStaff.updatedAt,
          },
          token,
          "PATCH",
        ),
      ),
    );
    const scratchStaff = asStaff(
      await expectOk(
        staffRoute(
          createJsonRequest("http://localhost/api/platform/staff", {
            displayName: "Delete Me",
            email: "delete.me@northside.test",
            password: "delete-pass-123",
            roleKey: "frontdesk",
          }, token),
        ),
        201,
      ),
    );
    await expectOk(
      deleteStaffRoute(
        createJsonRequest(
          "http://localhost/api/platform/staff",
          { userId: scratchStaff.id, expectedUpdatedAt: scratchStaff.updatedAt },
          token,
          "DELETE",
        ),
      ),
    );

    const logoutResponse = await logoutRoute();
    expect(logoutResponse.status).toBe(200);
    expect(await logoutResponse.text()).toContain("/login");
  });

  it("covers owner settings, access, billing, compliance, and health flows", async () => {
    const token = await bootstrapOwner();
    await enableFeatures(token, [
      "booking.one_to_one",
      "booking.credit_system",
      "billing.autocollect",
      "commerce.webshop_pos",
      "coaching.ai_max",
      "coaching.workout_plans",
      "coaching.nutrition",
      "coaching.on_demand_videos",
      "coaching.progress_tracking",
      "coaching.heart_rate",
      "retention.planner",
      "retention.community_groups",
      "retention.challenges_rewards",
      "retention.questionnaire",
      "retention.pro_content",
      "retention.fitzone",
      "mobile.white_label",
      "marketing.email",
      "marketing.promotions",
      "marketing.leads",
      "integrations.software",
      "integrations.equipment",
      "integrations.virtuagym_connect",
      "integrations.body_composition",
    ]);
    const { location, member } = await createCoreDataset(token);

    await expectOk(
      bookingSettingsRoute(
        createJsonRequest("http://localhost/api/platform/booking-settings", {
          oneToOneSessionName: "PT intake",
          oneToOneDurationMinutes: 45,
          trialBookingUrl: "https://northside.test/trial",
          defaultCreditPackSize: 8,
          schedulingWindowDays: 21,
        }, token),
      ),
      201,
    );
    await expectOk(
      bookingPolicyRoute(
        createJsonRequest("http://localhost/api/platform/booking-policy", {
          cancellationWindowHours: 3,
          lateCancelFeeCents: 750,
          noShowFeeCents: 1_000,
          maxDailyBookingsPerMember: 3,
          maxDailyWaitlistPerMember: 2,
          autoPromoteWaitlist: true,
        }, token),
      ),
    );
    const bookingPolicy = await expectOk<{ lateCancelFeeCents: number }>(
      getBookingPolicyRoute(
        createGetRequest("http://localhost/api/platform/booking-policy", token),
      ),
    );
    expect(bookingPolicy.lateCancelFeeCents).toBe(750);

    process.env.NUKI_API_TOKEN = "nuki-live-token";
    process.env.MOLLIE_API_KEY = "test_mollie_live_key";
    process.env.MOLLIE_WEBHOOK_SECRET = "mollie-secret";
    process.env.APP_BASE_URL = "http://localhost";
    let paymentCreateCount = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      if (target.endsWith("/smartlock/nuki-lock-1/action/unlock") && init?.method === "POST") {
        expect(init.headers).toMatchObject({
          authorization: "Bearer nuki-live-token",
        });

        return new Response(JSON.stringify({ id: "nuki_system_1", status: "accepted" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (target.endsWith("/payments") && init?.method === "POST") {
        paymentCreateCount += 1;
        const id = `tr_system_${paymentCreateCount}`;
        return new Response(
          JSON.stringify({
            id,
            status: "open",
            _links: {
              checkout: {
                href: `https://pay.mollie.com/p/${id}`,
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (target.includes("/payments/tr_system_3") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            id: "tr_system_3",
            status: "paid",
            metadata: {},
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (target.endsWith("/payments/tr_system_3/refunds") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "re_system_1", status: "queued" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unhandled outbound request: ${target}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await expectOk(
      remoteAccessRoute(
        createJsonRequest("http://localhost/api/platform/remote-access", {
          enabled: true,
          provider: "nuki",
          bridgeType: "cloud_api",
          locationId: location.id,
          deviceLabel: "Voordeur Oost",
          externalDeviceId: "nuki-lock-1",
          notes: "Alleen owner live open",
        }, token),
      ),
      201,
    );
    const unlock = await expectOk<{
      mode: string;
      providerActionId: string;
      summary: string;
    }>(
      remoteAccessOpenRoute(
        createJsonRequest("http://localhost/api/platform/remote-access/open", {}, token),
      ),
    );
    expect(unlock.mode).toBe("live");
    expect(unlock.providerActionId).toBe("nuki_system_1");

    await expectOk(
      billingRoute(
        createJsonRequest("http://localhost/api/platform/billing", {
          enabled: true,
          provider: "mollie",
          profileLabel: "Northside Payments",
          profileId: "pfl_northside",
          settlementLabel: "Northside IBAN",
          supportEmail: "billing@northside.test",
          paymentMethods: ["direct_debit", "one_time", "payment_request"],
          notes: "Live Mollie credentials via omgeving",
        }, token),
      ),
      201,
    );
    const preview = await expectOk<{ mode: string; summary: string; checkoutUrl: string }>(
      billingPreviewRoute(
        createJsonRequest("http://localhost/api/platform/billing/preview", {
          paymentMethod: "one_time",
          amountCents: 2_500,
          currency: "EUR",
          description: "Drop-in",
          memberName: "Nina de Boer",
        }, token),
      ),
    );
    expect(preview.mode).toBe("live");
    expect(preview.checkoutUrl).toContain("https://pay.mollie.com/p/");

    await expectOk(getBillingBackofficeRoute(createGetRequest("http://localhost/api/platform/billing-backoffice", token)));
    const invoice = asIdentified(
      await expectOk(
        billingBackofficeRoute(
          createJsonRequest("http://localhost/api/platform/billing-backoffice", {
            operation: "create_invoice",
            memberId: member.id,
            memberName: "Nina de Boer",
            description: "Maandlidmaatschap",
            amountCents: 11_900,
            dueAt: "2026-05-01",
            source: "membership",
            currency: "EUR",
          }, token),
        ),
      ),
    );
    const retriedInvoice = await expectOk<{ externalReference?: string }>(
      billingBackofficeRoute(
        createJsonRequest("http://localhost/api/platform/billing-backoffice", {
          operation: "retry_invoice",
          invoiceId: invoice.id,
          reason: "SEPA retry",
        }, token),
      ),
    );
    expect(retriedInvoice.externalReference).toBe("tr_system_3");
    await expectOk(
      mollieWebhookRoute(
        new Request(
          "http://localhost/api/platform/billing/mollie/webhook?secret=mollie-secret",
          {
            method: "POST",
            headers: {
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              id: retriedInvoice.externalReference!,
            }),
          },
        ),
      ),
    );
    await expectOk(
      billingBackofficeRoute(
        createJsonRequest("http://localhost/api/platform/billing-backoffice", {
          operation: "refund_invoice",
          invoiceId: invoice.id,
          amountCents: 2_500,
          reason: "Goodwill",
        }, token),
      ),
    );
    const reconciliation = await expectOk<{ totalInvoices: number }>(
      billingBackofficeRoute(
        createJsonRequest("http://localhost/api/platform/billing-backoffice", {
          operation: "reconcile",
          note: "Dagafsluiting",
        }, token),
      ),
    );
    expect(reconciliation.totalInvoices).toBeGreaterThanOrEqual(1);

    const collectionCase = asIdentified(
      await expectOk(
        collectionCasesRoute(
          createJsonRequest("http://localhost/api/platform/collection-cases", {
            memberId: member.id,
            memberName: "Nina de Boer",
            paymentMethod: "payment_request",
            status: "open",
            amountCents: 750,
            reason: "Late cancel",
            dueAt: "2026-05-02",
            notes: "Automatisch aangemaakt",
          }, token),
        ),
        201,
      ),
    );
    await expectOk(
      patchCollectionCaseRoute(
        createJsonRequest("http://localhost/api/platform/collection-cases", {
          id: collectionCase.id,
          status: "resolved",
          notes: "Betaald via betaalverzoek",
        }, token, "PATCH"),
      ),
    );
    await expectOk(getCollectionCasesRoute(createGetRequest("http://localhost/api/platform/collection-cases", token)));

    await expectOk(
      revenueSettingsRoute(
        createJsonRequest("http://localhost/api/platform/revenue-settings", {
          webshopCollectionName: "Northside shop",
          pointOfSaleMode: "hybrid",
          cardTerminalLabel: "Frontdesk terminal",
          autocollectPolicy: "Retry na 3 dagen",
          directDebitLeadDays: 5,
        }, token),
      ),
      201,
    );
    await expectOk(
      coachingSettingsRoute(
        createJsonRequest("http://localhost/api/platform/coaching-settings", {
          workoutPlanFocus: "Strength cycle",
          nutritionCadence: "weekly",
          videoLibraryUrl: "https://northside.test/videos",
          progressMetric: "PR tracking",
          heartRateProvider: "Polar",
          aiCoachMode: "Coach summary",
        }, token),
      ),
      201,
    );
    await expectOk(
      retentionSettingsRoute(
        createJsonRequest("http://localhost/api/platform/retention-settings", {
          retentionCadence: "weekly",
          communityChannel: "WhatsApp community",
          challengeTheme: "Summer strength",
          questionnaireTrigger: "Na 30 dagen",
          proContentPath: "/pro",
          fitZoneOffer: "Recovery pack",
        }, token),
      ),
      201,
    );
    await expectOk(
      mobileSettingsRoute(
        createJsonRequest("http://localhost/api/platform/mobile-settings", {
          appDisplayName: "Northside App",
          onboardingHeadline: "Welkom bij je club",
          supportChannel: "support@northside.test",
          primaryAccent: "#F97316",
          checkInMode: "hybrid",
          whiteLabelDomain: "app.northside.test",
        }, token),
      ),
      201,
    );
    await expectOk(
      marketingSettingsRoute(
        createJsonRequest("http://localhost/api/platform/marketing-settings", {
          emailSenderName: "Northside Athletics",
          emailReplyTo: "hello@northside.test",
          promotionHeadline: "Start sterk",
          leadPipelineLabel: "Trial pipeline",
          automationCadence: "weekly",
        }, token),
      ),
      201,
    );
    await expectOk(
      integrationSettingsRoute(
        createJsonRequest("http://localhost/api/platform/integration-settings", {
          hardwareVendors: ["Nuki", "QR scanner"],
          softwareIntegrations: ["Mollie", "WAHA"],
          equipmentIntegrations: ["Concept2"],
          migrationProvider: "CSV import",
          bodyCompositionProvider: "InBody",
        }, token),
      ),
      201,
    );
    await expectOk(
      legalRoute(
        createJsonRequest("http://localhost/api/platform/legal", {
          termsUrl: "https://northside.test/voorwaarden",
          privacyUrl: "https://northside.test/privacy",
          sepaCreditorId: "NL00ZZZ123456780000",
          sepaMandateText: "Ik machtig Northside Athletics voor SEPA incasso.",
          contractPdfTemplateKey: "contracts/northside.pdf",
          waiverStorageKey: "waivers/northside",
          waiverRetentionMonths: 24,
        }, token),
      ),
    );
    const legal = await expectOk<{ termsUrl: string }>(
      getLegalRoute(createGetRequest("http://localhost/api/platform/legal", token)),
    );
    expect(legal.termsUrl).toContain("voorwaarden");

    const overview = await expectOk<{ featureFlags: Array<{ key: string; enabled: boolean }> }>(
      overviewRoute(createGetRequest("http://localhost/api/platform/overview", token)),
    );
    await expectOk(
      featureFlagsRoute(
        createJsonRequest("http://localhost/api/platform/feature-flags", {
          key: overview.featureFlags[0]!.key,
          enabled: !overview.featureFlags[0]!.enabled,
        }, token),
      ),
      201,
    );
    const health = await expectOk<{ checks: unknown[] }>(
      healthRoute(createGetRequest("http://localhost/api/platform/health", token)),
    );
    expect(Array.isArray(health.checks)).toBe(true);
  });

  it("covers growth, member-facing, import, automation, PT, and community flows", async () => {
    const token = await bootstrapOwner();
    await enableFeatures(token, [
      "mobile.white_label",
      "booking.credit_system",
      "booking.one_to_one",
      "retention.community_groups",
      "retention.challenges_rewards",
      "retention.questionnaire",
      "marketing.leads",
    ]);
    const { classSession, location, member, plan, trainer } = await createCoreDataset(token);

    await expectOk(
      memberPortalAccessRoute(
        createJsonRequest("http://localhost/api/platform/member-portal-access", {
          memberId: member.id,
          password: "member-pass-456",
        }, token),
      ),
      201,
    );
    const memberToken = await loginAndExtractSession("nina@northside.test", "member-pass-456");
    const memberSelfServiceRequest = asIdentified(
      await expectOk(
        memberMobileSelfServiceRoute(
          createPublicJsonRequest(
            "http://localhost/api/member/mobile-self-service",
            {
              operation: "request_payment_method_update",
              memberId: member.id,
              memberName: "Nina de Boer",
              requestedMethodLabel: "Nieuwe SEPA IBAN",
              note: "Via ledenportaal",
            },
            memberToken,
          ),
        ),
      ),
    );
    await expectOk(
      ownerMobileSelfServiceRoute(
        createJsonRequest("http://localhost/api/platform/mobile-self-service", {
          operation: "review_payment_method_update",
          requestId: memberSelfServiceRequest.id,
          decision: "approved",
          ownerNotes: "IBAN gecontroleerd",
        }, token),
      ),
    );
    const pauseRequest = asIdentified(
      await expectOk(
        ownerMobileSelfServiceRoute(
          createJsonRequest("http://localhost/api/platform/mobile-self-service", {
            operation: "request_pause",
            memberId: member.id,
            memberName: "Nina de Boer",
            startsAt: "2026-07-01",
            endsAt: "2026-07-15",
            reason: "Vakantie",
          }, token),
        ),
      ),
    );
    await expectOk(
      ownerMobileSelfServiceRoute(
        createJsonRequest("http://localhost/api/platform/mobile-self-service", {
          operation: "review_pause",
          requestId: pauseRequest.id,
          decision: "rejected",
          ownerNotes: "Nieuwe datum nodig",
        }, token),
      ),
    );
    await expectOk(
      getOwnerMobileSelfServiceRoute(
        createGetRequest("http://localhost/api/platform/mobile-self-service", token),
      ),
    );

    await expectOk(getAppointmentsRoute(createGetRequest("http://localhost/api/platform/appointments", token)));
    const pack = asIdentified(
      await expectOk(
        appointmentsRoute(
          createJsonRequest("http://localhost/api/platform/appointments", {
            operation: "create_pack",
            memberId: member.id,
            memberName: "Nina de Boer",
            trainerId: trainer.id,
            title: "PT 10-pack",
            totalCredits: 10,
            validUntil: "2026-12-31",
          }, token),
        ),
      ),
    );
    const coachSessions = await expectOk<{
      appointments: VersionedRecord[];
    }>(
      appointmentsRoute(
        createJsonRequest("http://localhost/api/platform/appointments", {
          operation: "create_sessions",
          trainerId: trainer.id,
          memberId: member.id,
          memberName: "Nina de Boer",
          locationId: location.id,
          startsAt: "2026-05-06T09:00:00.000Z",
          durationMinutes: 60,
          recurrence: "weekly",
          occurrences: 2,
          creditPackId: pack.id,
          notes: "Techniekblok",
        }, token),
      ),
    );
    expect(coachSessions.appointments).toHaveLength(2);

    await expectOk(getCommunityRoute(createGetRequest("http://localhost/api/platform/community", token)));
    await expectOk(
      communityRoute(
        createJsonRequest("http://localhost/api/platform/community", {
          operation: "create_group",
          name: "Hyrox crew",
          channel: "WhatsApp",
          description: "Samen trainen richting race day.",
          memberIds: [member.id],
        }, token),
      ),
    );
    await expectOk(
      communityRoute(
        createJsonRequest("http://localhost/api/platform/community", {
          operation: "create_challenge",
          title: "30 dagen consistent",
          rewardLabel: "Gratis recovery sessie",
          startsAt: "2026-05-01",
          endsAt: "2026-05-31",
          participantMemberIds: [member.id],
        }, token),
      ),
    );
    const questionnaire = asIdentified(
      await expectOk(
        communityRoute(
          createJsonRequest("http://localhost/api/platform/community", {
            operation: "create_questionnaire",
            title: "Readiness check",
            trigger: "Elke maandag",
            questions: ["Hoe voel je je?", "Wat is je focus?"],
          }, token),
        ),
      ),
    );
    await expectOk(
      communityRoute(
        createJsonRequest("http://localhost/api/platform/community", {
          operation: "submit_response",
          questionnaireId: questionnaire.id,
          memberId: member.id,
          memberName: "Nina de Boer",
          answers: ["Sterk", "Conditioning"],
        }, token),
      ),
    );

    const lead = asIdentified(
      await expectOk(
        leadsRoute(
          createJsonRequest("http://localhost/api/platform/leads", {
            fullName: "Lara Prospect",
            email: "lara.prospect@northside.test",
            phone: "0688888888",
            source: "website",
            stage: "new",
            interest: "Hyrox trial",
            notes: "Wil deze week starten",
            assignedStaffName: "Amina Hassan",
            expectedValueCents: 11900,
          }, token),
        ),
        201,
      ),
    );
    await expectOk(getLeadsRoute(createGetRequest("http://localhost/api/platform/leads", token)));
    await expectOk(
      patchLeadRoute(
        createJsonRequest("http://localhost/api/platform/leads", {
          id: lead.id,
          stage: "trial_scheduled",
          notes: "Trial ingepland",
          assignedStaffName: "Amina Hassan",
        }, token, "PATCH"),
      ),
    );
    await expectOk(
      patchLeadRoute(
        createJsonRequest("http://localhost/api/platform/leads", {
          operation: "convert",
          leadId: lead.id,
          membershipPlanId: plan.id,
          homeLocationId: location.id,
          status: "trial",
          tags: ["lead-converted"],
          waiverStatus: "pending",
          portalPassword: "lara-pass-123",
        }, token, "PATCH"),
      ),
    );
    await expectOk(getLeadAutomationRoute(createGetRequest("http://localhost/api/platform/lead-automation", token)));
    await expectOk(
      leadAutomationRoute(
        createJsonRequest("http://localhost/api/platform/lead-automation", {
          trigger: "manual",
        }, token),
      ),
    );

    const importResult = await expectOk<{
      importedMembers: number;
      createdMembershipPlans: number;
      skippedMembers: number;
    }>(
      importContractsRoute(
        createJsonRequest("http://localhost/api/platform/import/contracts", {
          defaultLocationId: location.id,
          phoneCountry: "NL",
          csv: [
            "naam;email;telefoon;contract;contractduur;prijs;vestiging;status;waiver;tags",
            "Mila Jansen;mila@northside.test;0687654321;Unlimited Halfjaar;6 maanden;69;Northside East;active;complete;hyrox",
          ].join("\n"),
        }, token),
      ),
      201,
    );
    expect(importResult.importedMembers).toBe(1);
    expect(importResult.skippedMembers).toBe(0);

    process.env.MOLLIE_API_KEY = "test_mollie_live_key";
    process.env.APP_BASE_URL = "http://localhost";
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      if (target.endsWith("/payments") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            id: "tr_growth_signup_1",
            status: "open",
            _links: {
              checkout: {
                href: "https://pay.mollie.com/p/growth-signup",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`Unhandled outbound request: ${target}`);
    }) as typeof fetch;
    await expectOk(
      legalRoute(
        createJsonRequest("http://localhost/api/platform/legal", {
          termsUrl: "https://northside.test/voorwaarden",
          privacyUrl: "https://northside.test/privacy",
          sepaCreditorId: "NL00ZZZ123456780000",
          sepaMandateText: "Ik machtig Northside Athletics voor SEPA incasso.",
          contractPdfTemplateKey: "contracts/northside.pdf",
          waiverStorageKey: "waivers/northside",
          waiverRetentionMonths: 24,
        }, token),
      ),
    );
    await expectOk(
      billingRoute(
        createJsonRequest("http://localhost/api/platform/billing", {
          enabled: true,
          provider: "mollie",
          profileLabel: "Northside Payments",
          profileId: "pfl_northside",
          settlementLabel: "Northside IBAN",
          supportEmail: "billing@northside.test",
          paymentMethods: ["direct_debit", "one_time", "payment_request"],
        }, token),
      ),
      201,
    );

    const signupResult = await expectOk<{ signup: IdentifiedRecord }>(
      publicMemberSignupRoute(
        createPublicJsonRequest("http://localhost/api/public/member-signups", {
          tenantSlug: "northside-athletics",
          fullName: "Jade Nieuw",
          email: "jade.nieuw@northside.test",
          phone: "0677777777",
          phoneCountry: "NL",
          membershipPlanId: plan.id,
          preferredLocationId: location.id,
          paymentMethod: "payment_request",
          contractAccepted: true,
          waiverAccepted: true,
          portalPassword: "jade-member-123",
          notes: "Komt via website",
        }),
      ),
      201,
    );
    const signup = asIdentified(signupResult.signup);
    const signups = await expectOk<IdentifiedRecord[]>(
      getMemberSignupsRoute(createGetRequest("http://localhost/api/platform/member-signups", token)),
    );
    expect(signups.some((entry) => entry.id === signup.id)).toBe(true);

    const reservation = await expectOk<{ booking: VersionedRecord }>(
      publicReservationsRoute(
        createPublicJsonRequest(
          "http://localhost/api/public/reservations",
          {
            tenantSlug: "northside-athletics",
            classSessionId: classSession.id,
            notes: "Via ledenportaal",
          },
          memberToken,
        ),
      ),
      201,
    );
    expect(reservation.booking.classSessionId).toBe(classSession.id);
  });
});
