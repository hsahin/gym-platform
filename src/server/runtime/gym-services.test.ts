import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAuthActor, type AuthActor } from "@claimtech/auth";
import type { TenantContext } from "@claimtech/tenant";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authenticateLocalAccount,
  bootstrapLocalPlatform,
  createLocalPlatformAccount,
} from "@/server/persistence/platform-state";
import { buildPlatformActor } from "@/server/runtime/demo-session";
import { createGymPlatformServices } from "@/server/runtime/gym-services";

let tempDir = "";
const originalMollieApiKey = process.env.MOLLIE_API_KEY;
const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalNukiApiToken = process.env.NUKI_API_TOKEN;
const originalEnableRealMessages = process.env.ENABLE_REAL_MESSAGES;
const originalWahaBaseUrl = process.env.WAHA_BASE_URL;
const originalWahaApiKey = process.env.WAHA_API_KEY;
const originalWahaSession = process.env.WAHA_SESSION;
const originalWhatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const originalWhatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const originalEnableRealUploads = process.env.ENABLE_REAL_UPLOADS;
const originalSpacesBucket = process.env.SPACES_BUCKET;
const originalSpacesEndpoint = process.env.SPACES_ENDPOINT;
const originalSpacesRegion = process.env.SPACES_REGION;
const originalSpacesAccessKeyId = process.env.SPACES_ACCESS_KEY_ID;
const originalSpacesSecretAccessKey = process.env.SPACES_SECRET_ACCESS_KEY;
const originalFetch = globalThis.fetch;

function clearMessagingEnv() {
  delete process.env.ENABLE_REAL_MESSAGES;
  delete process.env.WAHA_BASE_URL;
  delete process.env.WAHA_API_KEY;
  delete process.env.WAHA_SESSION;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
}

function clearUploadEnv() {
  delete process.env.ENABLE_REAL_UPLOADS;
  delete process.env.SPACES_BUCKET;
  delete process.env.SPACES_ENDPOINT;
  delete process.env.SPACES_REGION;
  delete process.env.SPACES_ACCESS_KEY_ID;
  delete process.env.SPACES_SECRET_ACCESS_KEY;
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

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

async function enableTenantFeatures(
  services: Awaited<ReturnType<typeof createGymPlatformServices>>,
  actor: AuthActor,
  tenantContext: TenantContext,
  keys: ReadonlyArray<string>,
) {
  for (const key of keys) {
    await services.updateFeatureFlag(actor, tenantContext, {
      key,
      enabled: true,
    });
  }
}

function createMemberViewer(email: string, tenantId: string, displayName = "Member Viewer") {
  return createAuthActor({
    subjectId: `member-viewer:${email}`,
    email,
    displayName,
    tenantMemberships: [
      {
        tenantId,
        roles: ["gym.member"],
      },
    ],
  });
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "gym-platform-"));
  process.env.LOCAL_PLATFORM_STATE_FILE = path.join(tempDir, "platform-state.json");
  clearMessagingEnv();
  clearUploadEnv();
});

afterEach(async () => {
  delete process.env.LOCAL_PLATFORM_STATE_FILE;
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
  if (originalNukiApiToken === undefined) {
    delete process.env.NUKI_API_TOKEN;
  } else {
    process.env.NUKI_API_TOKEN = originalNukiApiToken;
  }
  if (originalEnableRealMessages === undefined) {
    delete process.env.ENABLE_REAL_MESSAGES;
  } else {
    process.env.ENABLE_REAL_MESSAGES = originalEnableRealMessages;
  }
  if (originalWahaBaseUrl === undefined) {
    delete process.env.WAHA_BASE_URL;
  } else {
    process.env.WAHA_BASE_URL = originalWahaBaseUrl;
  }
  if (originalWahaApiKey === undefined) {
    delete process.env.WAHA_API_KEY;
  } else {
    process.env.WAHA_API_KEY = originalWahaApiKey;
  }
  if (originalWahaSession === undefined) {
    delete process.env.WAHA_SESSION;
  } else {
    process.env.WAHA_SESSION = originalWahaSession;
  }
  if (originalWhatsappPhoneNumberId === undefined) {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  } else {
    process.env.WHATSAPP_PHONE_NUMBER_ID = originalWhatsappPhoneNumberId;
  }
  if (originalWhatsappAccessToken === undefined) {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
  } else {
    process.env.WHATSAPP_ACCESS_TOKEN = originalWhatsappAccessToken;
  }
  if (originalEnableRealUploads === undefined) {
    delete process.env.ENABLE_REAL_UPLOADS;
  } else {
    process.env.ENABLE_REAL_UPLOADS = originalEnableRealUploads;
  }
  if (originalSpacesBucket === undefined) {
    delete process.env.SPACES_BUCKET;
  } else {
    process.env.SPACES_BUCKET = originalSpacesBucket;
  }
  if (originalSpacesEndpoint === undefined) {
    delete process.env.SPACES_ENDPOINT;
  } else {
    process.env.SPACES_ENDPOINT = originalSpacesEndpoint;
  }
  if (originalSpacesRegion === undefined) {
    delete process.env.SPACES_REGION;
  } else {
    process.env.SPACES_REGION = originalSpacesRegion;
  }
  if (originalSpacesAccessKeyId === undefined) {
    delete process.env.SPACES_ACCESS_KEY_ID;
  } else {
    process.env.SPACES_ACCESS_KEY_ID = originalSpacesAccessKeyId;
  }
  if (originalSpacesSecretAccessKey === undefined) {
    delete process.env.SPACES_SECRET_ACCESS_KEY;
  } else {
    process.env.SPACES_SECRET_ACCESS_KEY = originalSpacesSecretAccessKey;
  }
  globalThis.fetch = originalFetch;
  await rm(tempDir, { recursive: true, force: true });
});

describe("gym platform services", () => {
  it("returns public reservation data for the selected gym slug", async () => {
    const firstTenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });
    const secondTenant = await bootstrapLocalPlatform({
      tenantName: "Atlas Forge Club",
      ownerName: "Mustafa Ali",
      ownerEmail: "owner@atlasforge.test",
      password: "AtlasPass123!",
    });

    const firstOwner = buildPlatformActor(firstTenant.accounts[0]!, firstTenant.tenant.id);
    const secondOwner = buildPlatformActor(secondTenant.accounts[0]!, secondTenant.tenant.id);
    const services = await createGymPlatformServices();
    const firstTenantContext = services.createRequestTenantContext(
      firstOwner,
      firstTenant.tenant.id,
    );
    const secondTenantContext = services.createRequestTenantContext(
      secondOwner,
      secondTenant.tenant.id,
    );

    const location = await services.createLocation(secondOwner, secondTenantContext, {
      name: "Atlas Forge Oost",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 120,
      managerName: "Nadia Vermeer",
      amenities: ["Sauna"],
    });
    const trainer = await services.createTrainer(secondOwner, secondTenantContext, {
      fullName: "Romy de Wit",
      homeLocationId: location.id,
      specialties: ["Hyrox"],
      certifications: ["NASM-CPT"],
    });
    await services.createClassSession(secondOwner, secondTenantContext, {
      title: "Forge HIIT",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: daysFromNow(7),
      durationMinutes: 60,
      capacity: 16,
      level: "mixed",
      focus: "engine",
    });
    await services.createClassSession(secondOwner, secondTenantContext, {
      title: "Forge recurring later",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: daysFromNow(45),
      durationMinutes: 60,
      capacity: 16,
      level: "mixed",
      focus: "engine",
    });

    const firstSnapshot = await services.getPublicReservationSnapshot({
      tenantSlug: firstTenant.tenant.id,
    });
    const secondSnapshot = await services.getPublicReservationSnapshot({
      tenantSlug: secondTenant.tenant.id,
    });

    expect(firstSnapshot.tenantName).toBe("Northside Athletics");
    expect(firstSnapshot.classSessions).toHaveLength(0);
    expect(firstSnapshot.bookingAccess).toMatchObject({
      trialEnabled: true,
      trialBookingUrl: "",
      membershipSignupUrl: `/join?gym=${firstTenant.tenant.id}`,
    });
    expect(secondSnapshot.tenantName).toBe("Atlas Forge Club");
    expect(secondSnapshot.classSessions.map((classSession) => classSession.title)).toEqual([
      "Forge HIIT",
    ]);
    expect(secondSnapshot.availableGyms).toHaveLength(2);
    expect(firstTenantContext.tenantId).toBe(firstTenant.tenant.id);
  });

  it("keeps public class booking behind trial or membership onboarding", async () => {
    const { state, ownerActor, services, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 50,
      managerName: "Saar de Jong",
      amenities: ["Recovery zone"],
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

    await services.updateBookingWorkspace(ownerActor, tenantContext, {
      oneToOneSessionName: "PT intake",
      oneToOneDurationMinutes: 60,
      trialBookingUrl: "https://book.northside.test/trial",
      defaultCreditPackSize: 10,
      schedulingWindowDays: 14,
    });

    const snapshot = await services.getPublicReservationSnapshot({
      tenantSlug: state.tenant.id,
    });

    expect(snapshot.bookingAccess).toMatchObject({
      trialEnabled: true,
      trialBookingUrl: "https://book.northside.test/trial",
      membershipSignupUrl: `/join?gym=${state.tenant.id}`,
    });
    await expect(
      services.createPublicReservation({
        tenantSlug: state.tenant.id,
        classSessionId: session.id,
        fullName: "Lena Jansen",
        email: "lena@northside.test",
        phone: "0612345678",
        phoneCountry: "NL",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const dashboard = await services.getDashboardSnapshot(ownerActor, tenantContext, {
      page: "members",
    });
    expect(dashboard.members).toHaveLength(0);
  });

  it("shows only clubs where the signed-in member already exists", async () => {
    const firstTenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });
    const secondTenant = await bootstrapLocalPlatform({
      tenantName: "Atlas Forge Club",
      ownerName: "Mustafa Ali",
      ownerEmail: "owner@atlasforge.test",
      password: "AtlasPass123!",
    });

    const firstOwner = buildPlatformActor(firstTenant.accounts[0]!, firstTenant.tenant.id);
    const secondOwner = buildPlatformActor(secondTenant.accounts[0]!, secondTenant.tenant.id);
    const services = await createGymPlatformServices();
    const firstTenantContext = services.createRequestTenantContext(
      firstOwner,
      firstTenant.tenant.id,
    );
    const secondTenantContext = services.createRequestTenantContext(
      secondOwner,
      secondTenant.tenant.id,
    );

    const firstLocation = await services.createLocation(firstOwner, firstTenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 120,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const secondLocation = await services.createLocation(secondOwner, secondTenantContext, {
      name: "Atlas Forge Oost",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 120,
      managerName: "Nadia Vermeer",
      amenities: [],
    });
    const firstPlan = await services.createMembershipPlan(firstOwner, firstTenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    const secondPlan = await services.createMembershipPlan(secondOwner, secondTenantContext, {
      name: "Hyrox",
      priceMonthly: 129,
      billingCycle: "monthly",
      perks: [],
    });
    const firstTrainer = await services.createTrainer(firstOwner, firstTenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: firstLocation.id,
      specialties: [],
      certifications: [],
    });
    const secondTrainer = await services.createTrainer(secondOwner, secondTenantContext, {
      fullName: "Romy de Wit",
      homeLocationId: secondLocation.id,
      specialties: [],
      certifications: [],
    });

    await services.createMember(firstOwner, firstTenantContext, {
      fullName: "Nina de Boer",
      email: "nina@northside.test",
      phone: "0611112222",
      phoneCountry: "NL",
      membershipPlanId: firstPlan.id,
      homeLocationId: firstLocation.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
      portalPassword: "member-pass-123",
    });
    await services.createMember(secondOwner, secondTenantContext, {
      fullName: "Nina de Boer",
      email: "nina@northside.test",
      phone: "0611112222",
      phoneCountry: "NL",
      membershipPlanId: secondPlan.id,
      homeLocationId: secondLocation.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
      portalPassword: "member-pass-123",
    });
    await services.createClassSession(secondOwner, secondTenantContext, {
      title: "Forge HIIT",
      locationId: secondLocation.id,
      trainerId: secondTrainer.id,
      startsAt: daysFromNow(8),
      durationMinutes: 60,
      capacity: 16,
      level: "mixed",
      focus: "engine",
    });
    await services.createClassSession(secondOwner, secondTenantContext, {
      title: "Forge recurring later",
      locationId: secondLocation.id,
      trainerId: secondTrainer.id,
      startsAt: daysFromNow(45),
      durationMinutes: 60,
      capacity: 16,
      level: "mixed",
      focus: "engine",
    });
    await services.createClassSession(firstOwner, firstTenantContext, {
      title: "Northside Lift",
      locationId: firstLocation.id,
      trainerId: firstTrainer.id,
      startsAt: daysFromNow(6),
      durationMinutes: 60,
      capacity: 14,
      level: "mixed",
      focus: "strength",
    });

    const memberActor = createMemberViewer(
      "nina@northside.test",
      firstTenant.tenant.id,
      "Nina de Boer",
    );
    const baseSnapshot = await services.getMemberReservationSnapshot(memberActor);
    const secondSnapshot = await services.getMemberReservationSnapshot(memberActor, {
      tenantSlug: secondTenant.tenant.id,
    });

    expect(baseSnapshot.hasEligibleMembership).toBe(true);
    expect(baseSnapshot.tenantSlug).toBeNull();
    expect(baseSnapshot.availableClubs).toHaveLength(2);
    expect(baseSnapshot.availableClubs.map((club) => club.name)).toEqual([
      "Atlas Forge Club",
      "Northside Athletics",
    ]);
    expect(secondSnapshot.tenantName).toBe("Atlas Forge Club");
    expect(secondSnapshot.classSessions.map((classSession) => classSession.title)).toEqual([
      "Forge HIIT",
    ]);
  });

  it("starts leeg en kan daarna kerngegevens opbouwen", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: ["Open gym", "Sauna"],
    });
    const membershipPlan = await services.createMembershipPlan(
      ownerActor,
      tenantContext,
      {
        name: "Unlimited",
        priceMonthly: 119,
        billingCycle: "monthly",
        perks: ["Open gym", "Unlimited classes"],
      },
    );
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: ["Hyrox"],
      certifications: ["NASM-CPT"],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Noa van Dijk",
      email: "noa@northside.test",
      phone: "0612345678",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: ["morning"],
      waiverStatus: "pending",
    });
    await services.createClassSession(ownerActor, tenantContext, {
      title: "Morning Strength",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-20T08:00:00.000Z",
      durationMinutes: 60,
      capacity: 14,
      level: "mixed",
      focus: "Compound lifts",
    });

    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(snapshot.tenantName).toBe("Northside Athletics");
    expect(snapshot.locations).toHaveLength(1);
    expect(snapshot.membershipPlans).toHaveLength(1);
    expect(snapshot.trainers).toHaveLength(1);
    expect(snapshot.members).toHaveLength(1);
    expect(snapshot.classSessions).toHaveLength(1);
    expect(snapshot.waivers[0]?.memberId).toBe(member.id);
  });

  it("uses explicit not-configured receipts instead of preview messaging or upload paths", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Noa van Dijk",
      email: "noa@northside.test",
      phone: "0612345678",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "pending",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Morning Strength",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-20T08:00:00.000Z",
      durationMinutes: 60,
      capacity: 14,
      level: "mixed",
      focus: "Compound lifts",
    });

    const booking = await services.createBooking(ownerActor, tenantContext, {
      memberId: member.id,
      classSessionId: classSession.id,
      idempotencyKey: "not-configured-message",
      source: "frontdesk",
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(booking.messageReceipt).toMatchObject({
      accepted: false,
      status: "failed",
      raw: {
        mode: "not_configured",
      },
    });
    expect(booking.messageReceipt.providerMessageId).toBeUndefined();
    expect(snapshot.runtime.messagingMode).toBe("not_configured");
    expect(snapshot.runtime.storageMode).toBe("not_configured");
    expect(snapshot.waiverUploadPath).toBe("");
    expect(snapshot.healthReport.checks.find((check) => check.name === "Berichten")).toMatchObject({
      status: "healthy",
      summary: expect.not.stringContaining("preview"),
    });
    expect(snapshot.healthReport.checks.find((check) => check.name === "Documenten")).toMatchObject({
      status: "healthy",
      summary: expect.not.stringContaining("preview"),
    });
  });

  it("reports local fallback runtime honestly without production-only degradation", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);
    const getCheck = (name: string) =>
      snapshot.healthReport.checks.find((check) => check.name === name);

    expect(snapshot.runtime).toMatchObject({
      storeMode: "memory",
      cacheMode: "memory",
    });
    expect(getCheck("Data")).toMatchObject({
      status: "healthy",
      summary: expect.stringContaining("lokale memory store"),
    });
    expect(String(getCheck("Data")?.summary ?? "")).not.toContain("vaste databaseconfiguratie");
    expect(getCheck("Snelheid")).toMatchObject({
      status: "healthy",
      summary: expect.stringContaining("lokale memory cache"),
    });
    expect(String(getCheck("Snelheid")?.summary ?? "")).not.toContain("snelle live cachelaag");
    expect(getCheck("Productie-readiness")).toMatchObject({
      status: "healthy",
      summary: expect.stringContaining("Lokale ontwikkelmodus"),
    });
    expect(String(getCheck("Productie-readiness")?.summary ?? "")).not.toContain("MongoDB");
    expect(String(getCheck("Productie-readiness")?.summary ?? "")).not.toContain("Redis");
    expect(getCheck("Migraties")).toMatchObject({
      status: "healthy",
      summary: expect.stringContaining("niet als lokale blocker"),
    });
    expect(getCheck("Security")).toMatchObject({
      status: "healthy",
      summary: expect.stringContaining("Lokale sessieconfiguratie"),
    });
    expect(snapshot.healthReport.checks.map((check) => check.summary).join(" ")).not.toContain(
      "preview",
    );
  });

  it("sends booking notifications through direct WAHA when credentials are configured", async () => {
    process.env.WAHA_BASE_URL = "https://waha.example";
    process.env.WAHA_API_KEY = "secret-key";
    process.env.WAHA_SESSION = "northside";
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      if (target === "https://waha.example/api/sessions/northside") {
        expect(init?.method).toBe("GET");
        return new Response(JSON.stringify({ status: "WORKING" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (
        target ===
        "https://waha.example/api/contacts/check-exists?phone=31612345678&session=northside"
      ) {
        expect(init?.method).toBe("GET");
        return new Response(JSON.stringify({ numberExists: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (target === "https://waha.example/api/sendText") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          chatId: "31612345678@c.us",
          session: "northside",
        });
        return new Response(JSON.stringify({ id: "waha_msg_1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unhandled WAHA request: ${target}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Noa van Dijk",
      email: "noa@northside.test",
      phone: "0612345678",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Morning Strength",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-20T08:00:00.000Z",
      durationMinutes: 60,
      capacity: 14,
      level: "mixed",
      focus: "Compound lifts",
    });

    const booking = await services.createBooking(ownerActor, tenantContext, {
      memberId: member.id,
      classSessionId: classSession.id,
      idempotencyKey: "waha-message",
      source: "frontdesk",
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(booking.messageReceipt).toMatchObject({
      accepted: true,
      status: "sent",
      providerMessageId: "waha_msg_1",
    });
    expect(snapshot.runtime.messagingMode).toBe("waha");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("only exposes waiver upload paths when Spaces storage is fully configured", async () => {
    process.env.SPACES_BUCKET = "gym-files";
    process.env.SPACES_ENDPOINT = "https://ams3.digitaloceanspaces.com";
    process.env.SPACES_REGION = "ams3";
    process.env.SPACES_ACCESS_KEY_ID = "spaces-key";
    process.env.SPACES_SECRET_ACCESS_KEY = "spaces-secret";

    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(snapshot.runtime.storageMode).toBe("spaces");
    expect(snapshot.waiverUploadPath).toContain("waivers");
    expect(snapshot.waiverUploadPath).toContain("signed-liability-waiver.pdf");
  });

  it("can enable member portal access and authenticate the linked member account", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: ["Open gym"],
    });
    const membershipPlan = await services.createMembershipPlan(
      ownerActor,
      tenantContext,
      {
        name: "Unlimited",
        priceMonthly: 119,
        billingCycle: "monthly",
        perks: ["Open gym"],
      },
    );
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Noa van Dijk",
      email: "noa@northside.test",
      phone: "0612345678",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: ["morning"],
      waiverStatus: "pending",
    });

    await services.setMemberPortalPassword(ownerActor, tenantContext, {
      memberId: member.id,
      password: "member-pass-123",
    });

    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);
    const authenticated = await authenticateLocalAccount(
      "noa@northside.test",
      "member-pass-123",
    );

    expect(snapshot.memberPortalAccessMemberIds).toContain(member.id);
    expect(authenticated?.account.roleKey).toBe("member");
    expect(authenticated?.account.linkedMemberId).toBe(member.id);
  });

  it("lets owners edit, archive and safely delete managed gym records", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: ["Open gym"],
    });
    const removableLocation = await services.createLocation(ownerActor, tenantContext, {
      name: "Temporary Studio",
      city: "Amsterdam",
      neighborhood: "West",
      capacity: 40,
      managerName: "Temp Manager",
      amenities: [],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["Open gym"],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: ["Hyrox"],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Noa van Dijk",
      email: "noa@northside.test",
      phone: "0612345678",
      phoneCountry: "NL",
      membershipPlanId: plan.id,
      homeLocationId: location.id,
      status: "active",
      tags: ["morning"],
      waiverStatus: "pending",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Morning Strength",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-20T08:00:00.000Z",
      durationMinutes: 60,
      capacity: 14,
      level: "mixed",
      focus: "Compound lifts",
    });

    const updatedLocation = await services.updateLocation(ownerActor, tenantContext, {
      ...location,
      expectedVersion: location.version,
      name: "Northside Flagship",
      status: "active",
    });
    const currentPlan = (
      await services.getDashboardSnapshot(ownerActor, tenantContext)
    ).membershipPlans.find((entry) => entry.id === plan.id)!;
    const updatedPlan = await services.updateMembershipPlan(ownerActor, tenantContext, {
      ...currentPlan,
      expectedVersion: currentPlan.version,
      priceMonthly: 129,
      status: "active",
    });
    const currentTrainer = (
      await services.getDashboardSnapshot(ownerActor, tenantContext)
    ).trainers.find((entry) => entry.id === trainer.id)!;
    const updatedTrainer = await services.updateTrainer(ownerActor, tenantContext, {
      ...currentTrainer,
      expectedVersion: currentTrainer.version,
      fullName: "Jay Hassan-Lewis",
      status: "active",
    });
    const updatedMember = await services.updateMember(ownerActor, tenantContext, {
      ...member,
      expectedVersion: member.version,
      status: "paused",
    });
    const archivedClass = await services.archiveClassSession(ownerActor, tenantContext, {
      id: classSession.id,
      expectedVersion: classSession.version,
    });
    await services.deleteLocation(ownerActor, tenantContext, {
      id: removableLocation.id,
      expectedVersion: removableLocation.version,
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(updatedLocation.name).toBe("Northside Flagship");
    expect(updatedPlan.priceMonthly).toBe(129);
    expect(updatedTrainer.fullName).toBe("Jay Hassan-Lewis");
    expect(updatedMember.status).toBe("paused");
    expect(archivedClass.status).toBe("archived");
    expect(snapshot.locations.map((entry) => entry.id)).not.toContain(removableLocation.id);
    expect(snapshot.membershipPlans[0]?.activeMembers).toBe(0);
  });

  it("deletes all lessons in a recurring series with one owner action", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside Oost",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 32,
      managerName: "Amina Hassan",
      amenities: ["Rig"],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: ["Strength"],
      certifications: [],
    });
    const seriesId = "series_monday_strength";
    const firstSeriesClass = await services.createClassSession(ownerActor, tenantContext, {
      title: "Monday Strength",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-05-04T18:00:00.000Z",
      durationMinutes: 60,
      capacity: 12,
      level: "mixed",
      focus: "strength",
      seriesId,
    });
    await services.createClassSession(ownerActor, tenantContext, {
      title: "Monday Strength",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-05-11T18:00:00.000Z",
      durationMinutes: 60,
      capacity: 12,
      level: "mixed",
      focus: "strength",
      seriesId,
    });
    const standaloneClass = await services.createClassSession(ownerActor, tenantContext, {
      title: "Drop-in Mobility",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-05-12T09:00:00.000Z",
      durationMinutes: 45,
      capacity: 10,
      level: "beginner",
      focus: "mobility",
    });

    const result = await services.deleteClassSessionSeries(ownerActor, tenantContext, {
      id: firstSeriesClass.id,
      expectedVersion: firstSeriesClass.version,
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);
    const currentTrainer = snapshot.trainers.find((entry) => entry.id === trainer.id);

    expect(result).toEqual({ deleted: 2, seriesId });
    expect(snapshot.classSessions.map((entry) => entry.title)).toEqual([
      standaloneClass.title,
    ]);
    expect(currentTrainer?.classIds).toEqual([standaloneClass.id]);
  });

  it("creates recurring lessons through one batch operation", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside Oost",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 32,
      managerName: "Amina Hassan",
      amenities: ["Rig"],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: ["Strength"],
      certifications: [],
    });
    const seriesId = "series_batch_strength";

    const createdClasses = await services.createClassSessionBatch(ownerActor, tenantContext, [
      {
        title: "Batch Strength",
        locationId: location.id,
        trainerId: trainer.id,
        startsAt: "2026-05-04T18:00:00.000Z",
        durationMinutes: 60,
        capacity: 12,
        level: "mixed",
        focus: "strength",
        seriesId,
      },
      {
        title: "Batch Strength",
        locationId: location.id,
        trainerId: trainer.id,
        startsAt: "2026-05-11T18:00:00.000Z",
        durationMinutes: 60,
        capacity: 12,
        level: "mixed",
        focus: "strength",
        seriesId,
      },
      {
        title: "Batch Strength",
        locationId: location.id,
        trainerId: trainer.id,
        startsAt: "2026-05-18T18:00:00.000Z",
        durationMinutes: 60,
        capacity: 12,
        level: "mixed",
        focus: "strength",
        seriesId,
      },
    ]);
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(createdClasses).toHaveLength(3);
    expect(createdClasses.map((classSession) => classSession.seriesId)).toEqual([
      seriesId,
      seriesId,
      seriesId,
    ]);
    expect(snapshot.classSessions.filter((entry) => entry.seriesId === seriesId)).toHaveLength(3);
  });

  it("stores legal live-readiness settings per gym", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const legal = await services.updateLegalSettings(ownerActor, tenantContext, {
      termsUrl: "https://northside.test/voorwaarden",
      privacyUrl: "https://northside.test/privacy",
      sepaCreditorId: "NL00ZZZ123456780000",
      sepaMandateText:
        "Ik machtig Northside Athletics om mijn lidmaatschap via SEPA incasso te innen.",
      contractPdfTemplateKey: "contracts/templates/northside-v1.pdf",
      waiverStorageKey: "waivers/northside/signed/",
      waiverRetentionMonths: 84,
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(legal.statusLabel).toBe("Juridisch klaar");
    expect(snapshot.legal.sepaCreditorId).toBe("NL00ZZZ123456780000");
    expect(snapshot.healthReport.checks.some((check) => check.name === "Juridisch")).toBe(true);
  });

  it("stores owner workspace settings for booking, revenue, coaching, retention, mobile, marketing and integrations", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, [
      "booking.one_to_one",
      "booking.credit_system",
      "commerce.webshop_pos",
      "billing.autocollect",
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

    const booking = await services.updateBookingWorkspace(ownerActor, tenantContext, {
      oneToOneSessionName: "Performance PT",
      oneToOneDurationMinutes: 75,
      trialBookingUrl: "https://book.northside.test/trial",
      defaultCreditPackSize: 12,
      schedulingWindowDays: 21,
    });
    const revenue = await services.updateRevenueWorkspace(ownerActor, tenantContext, {
      webshopCollectionName: "Northside Pro Shop",
      pointOfSaleMode: "hybrid",
      cardTerminalLabel: "Frontdesk terminal",
      autocollectPolicy: "Incasso elke eerste werkdag van de maand",
      directDebitLeadDays: 5,
    });
    const coaching = await services.updateCoachingWorkspace(ownerActor, tenantContext, {
      workoutPlanFocus: "Engine and strength blocks",
      nutritionCadence: "biweekly",
      videoLibraryUrl: "https://video.northside.test/library",
      progressMetric: "Attendance and PRs",
      heartRateProvider: "Myzone",
      aiCoachMode: "High-touch AI copilot",
    });
    const retention = await services.updateRetentionWorkspace(ownerActor, tenantContext, {
      retentionCadence: "monthly",
      communityChannel: "Discord",
      challengeTheme: "Summer streak",
      questionnaireTrigger: "After week 2",
      proContentPath: "https://content.northside.test/pro",
      fitZoneOffer: "Recovery lounge",
    });
    const mobile = await services.updateMobileExperience(ownerActor, tenantContext, {
      appDisplayName: "Northside Club App",
      onboardingHeadline: "Welkom terug bij Northside",
      supportChannel: "support@northside.test",
      primaryAccent: "#111827",
      checkInMode: "qr",
      whiteLabelDomain: "app.northside.test",
    });
    const marketing = await services.updateMarketingWorkspace(ownerActor, tenantContext, {
      emailSenderName: "Northside Athletics",
      emailReplyTo: "hello@northside.test",
      promotionHeadline: "Spring intake week",
      leadPipelineLabel: "Trials -> members",
      automationCadence: "biweekly",
    });
    const integrations = await services.updateIntegrationWorkspace(ownerActor, tenantContext, {
      hardwareVendors: ["Nuki", "Brivo"],
      softwareIntegrations: ["Mollie", "Mailcoach"],
      equipmentIntegrations: ["Concept2"],
      migrationProvider: "Virtuagym",
      bodyCompositionProvider: "InBody",
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(booking.defaultCreditPackSize).toBe(12);
    expect(revenue.pointOfSaleMode).toBe("hybrid");
    expect(coaching.nutritionCadence).toBe("biweekly");
    expect(retention.communityChannel).toBe("Discord");
    expect(mobile.checkInMode).toBe("qr");
    expect(marketing.emailReplyTo).toBe("hello@northside.test");
    expect(integrations.bodyCompositionProvider).toBe("InBody");
    expect(snapshot.bookingWorkspace.oneToOneSessionName).toBe("Performance PT");
    expect(snapshot.revenueWorkspace.webshopCollectionName).toBe("Northside Pro Shop");
    expect(snapshot.coachingWorkspace.aiCoachMode).toBe("High-touch AI copilot");
    expect(snapshot.retentionWorkspace.challengeTheme).toBe("Summer streak");
    expect(snapshot.mobileExperience.whiteLabelDomain).toBe("app.northside.test");
    expect(snapshot.marketingWorkspace.promotionHeadline).toBe("Spring intake week");
    expect(snapshot.integrationWorkspace.hardwareVendors).toEqual(["Nuki", "Brivo"]);
  });

  it("lets an owner toggle tenant feature flags from the dashboard model", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const before = await services.getDashboardSnapshot(ownerActor, tenantContext);
    const updatedFeature = await services.updateFeatureFlag(ownerActor, tenantContext, {
      key: "coaching.ai_max",
      enabled: true,
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(before.uiCapabilities.canManageFeatureFlags).toBe(true);
    expect(before.featureFlags.find((feature) => feature.key === "coaching.ai_max")?.enabled).toBe(
      false,
    );
    expect(updatedFeature).toMatchObject({
      key: "coaching.ai_max",
      enabled: true,
      reason: "tenant_override",
    });
    expect(snapshot.featureFlags.find((feature) => feature.key === "coaching.ai_max")).toMatchObject(
      {
        enabled: true,
        reason: "tenant_override",
      },
    );
  });

  it("enforces tenant feature flags as hard server-side gates for dashboard actions", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: ["Open gym"],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["Open gym"],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: ["Hyrox"],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Noa van Dijk",
      email: "noa@northside.test",
      phone: "0612345678",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Evening Hyrox",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-20T18:30:00.000Z",
      durationMinutes: 60,
      capacity: 10,
      level: "advanced",
      focus: "Engine",
    });

    await services.updateFeatureFlag(ownerActor, tenantContext, {
      key: "booking.group_classes",
      enabled: false,
    });
    await expect(
      services.createBooking(ownerActor, tenantContext, {
        memberId: member.id,
        classSessionId: classSession.id,
        idempotencyKey: "blocked-feature-booking",
        source: "frontdesk",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "booking.group_classes" },
    });

    await services.updateFeatureFlag(ownerActor, tenantContext, {
      key: "booking.scheduling",
      enabled: false,
    });
    await expect(
      services.createClassSession(ownerActor, tenantContext, {
        title: "Blocked class",
        locationId: location.id,
        trainerId: trainer.id,
        startsAt: "2026-04-21T18:30:00.000Z",
        durationMinutes: 60,
        capacity: 10,
        level: "mixed",
        focus: "Blocked",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "booking.scheduling" },
    });

    await services.updateFeatureFlag(ownerActor, tenantContext, {
      key: "membership.management",
      enabled: false,
    });
    await expect(
      services.createMember(ownerActor, tenantContext, {
        fullName: "Blocked Member",
        email: "blocked-member@northside.test",
        phone: "0699999999",
        phoneCountry: "NL",
        membershipPlanId: membershipPlan.id,
        homeLocationId: location.id,
        status: "active",
        tags: [],
        waiverStatus: "pending",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "membership.management" },
    });

    await services.updateFeatureFlag(ownerActor, tenantContext, {
      key: "staff.management",
      enabled: false,
    });
    await expect(
      services.createTrainer(ownerActor, tenantContext, {
        fullName: "Blocked Trainer",
        homeLocationId: location.id,
        specialties: [],
        certifications: [],
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "staff.management" },
    });

    await services.updateFeatureFlag(ownerActor, tenantContext, {
      key: "clubs.multi_location",
      enabled: false,
    });
    await expect(
      services.createLocation(ownerActor, tenantContext, {
        name: "Blocked West",
        city: "Amsterdam",
        neighborhood: "West",
        capacity: 80,
        managerName: "Saar de Jong",
        amenities: [],
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "clubs.multi_location" },
    });

    await services.updateFeatureFlag(ownerActor, tenantContext, {
      key: "billing.processing",
      enabled: false,
    });
    await expect(
      services.updateBillingSettings(ownerActor, tenantContext, {
        enabled: true,
        provider: "mollie",
        profileLabel: "Northside Athletics Payments",
        profileId: "pfl_test_123456",
        settlementLabel: "Northside Club",
        supportEmail: "billing@northside.test",
        paymentMethods: ["one_time"],
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "billing.processing" },
    });

    await services.updateFeatureFlag(ownerActor, tenantContext, {
      key: "access.24_7",
      enabled: false,
    });
    await expect(
      services.updateRemoteAccessSettings(ownerActor, tenantContext, {
        enabled: true,
        provider: "nuki",
        bridgeType: "cloud_api",
        locationId: location.id,
        deviceLabel: "Front door",
        externalDeviceId: "nuki-123",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "access.24_7" },
    });

    await expect(
      services.createLead(ownerActor, tenantContext, {
        fullName: "Blocked Lead",
        email: "lead@northside.test",
        phone: "0611111111",
        source: "website",
        stage: "new",
        interest: "Trial",
        expectedValueCents: 8900,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "marketing.leads" },
    });

    await expect(
      services.createCommunityGroup(ownerActor, tenantContext, {
        name: "Blocked community",
        channel: "WhatsApp",
        description: "Should be gated.",
        memberIds: [member.id],
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "retention.community_groups" },
    });

    await expect(
      services.requestMobilePaymentMethodUpdate(ownerActor, tenantContext, {
        memberId: member.id,
        memberName: member.fullName,
        requestedMethodLabel: "Nieuwe SEPA IBAN",
        note: "Should be gated.",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "mobile.white_label" },
    });

    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);
    const coachingWorkspace = snapshot.coachingWorkspace;
    const retentionWorkspace = snapshot.retentionWorkspace;
    const marketingWorkspace = snapshot.marketingWorkspace;
    const integrationWorkspace = snapshot.integrationWorkspace;

    await expect(
      services.updateCoachingWorkspace(ownerActor, tenantContext, {
        workoutPlanFocus: coachingWorkspace.workoutPlanFocus,
        nutritionCadence: coachingWorkspace.nutritionCadence,
        videoLibraryUrl: coachingWorkspace.videoLibraryUrl,
        progressMetric: coachingWorkspace.progressMetric,
        heartRateProvider: coachingWorkspace.heartRateProvider,
        aiCoachMode: "Blocked AI copilot",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "coaching.ai_max" },
    });
    await expect(
      services.updateRetentionWorkspace(ownerActor, tenantContext, {
        retentionCadence: retentionWorkspace.retentionCadence,
        communityChannel: retentionWorkspace.communityChannel,
        challengeTheme: retentionWorkspace.challengeTheme,
        questionnaireTrigger: retentionWorkspace.questionnaireTrigger,
        proContentPath: "https://blocked-content.northside.test",
        fitZoneOffer: retentionWorkspace.fitZoneOffer,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "retention.pro_content" },
    });
    await expect(
      services.updateMarketingWorkspace(ownerActor, tenantContext, {
        emailSenderName: marketingWorkspace.emailSenderName,
        emailReplyTo: marketingWorkspace.emailReplyTo,
        promotionHeadline: "Blocked promo",
        leadPipelineLabel: marketingWorkspace.leadPipelineLabel,
        automationCadence: marketingWorkspace.automationCadence,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "marketing.promotions" },
    });
    await expect(
      services.updateIntegrationWorkspace(ownerActor, tenantContext, {
        hardwareVendors: integrationWorkspace.hardwareVendors,
        softwareIntegrations: integrationWorkspace.softwareIntegrations,
        equipmentIntegrations: integrationWorkspace.equipmentIntegrations,
        migrationProvider: integrationWorkspace.migrationProvider,
        bodyCompositionProvider: "Blocked InBody",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { feature: "integrations.body_composition" },
    });
  });

  it("supports a six-month contract and sets the next renewal accordingly", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: ["Open gym"],
    });
    const membershipPlan = await services.createMembershipPlan(
      ownerActor,
      tenantContext,
      {
        name: "Halfjaar Unlimited",
        priceMonthly: 89,
        billingCycle: "semiannual",
        perks: ["Open gym", "Priority booking"],
      },
    );
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Noa van Dijk",
      email: "noa@northside.test",
      phone: "0612345678",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "pending",
    });

    const renewalDays =
      (new Date(member.nextRenewalAt).getTime() - new Date(member.joinedAt).getTime()) /
      (1000 * 60 * 60 * 24);

    expect(membershipPlan.billingCycle).toBe("semiannual");
    expect(renewalDays).toBeGreaterThan(179);
    expect(renewalDays).toBeLessThan(185);
  });

  it("reuses bookings when the same idempotency key is sent twice", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(
      ownerActor,
      tenantContext,
      {
        name: "Unlimited",
        priceMonthly: 119,
        billingCycle: "monthly",
        perks: [],
      },
    );
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Sam Peters",
      email: "sam@northside.test",
      phone: "0656789012",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Evening Hyrox",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-20T18:30:00.000Z",
      durationMinutes: 60,
      capacity: 10,
      level: "advanced",
      focus: "Engine",
    });

    const first = await services.createBooking(ownerActor, tenantContext, {
      memberId: member.id,
      classSessionId: classSession.id,
      idempotencyKey: "same-booking-key",
      source: "frontdesk",
    });
    const second = await services.createBooking(ownerActor, tenantContext, {
      memberId: member.id,
      classSessionId: classSession.id,
      idempotencyKey: "same-booking-key",
      source: "frontdesk",
    });

    expect(first.alreadyExisted).toBe(false);
    expect(second.alreadyExisted).toBe(true);
    expect(second.booking.id).toBe(first.booking.id);
  });

  it("blocks a duplicate booking for the same member and class even with a new idempotency key", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(
      ownerActor,
      tenantContext,
      {
        name: "Unlimited",
        priceMonthly: 119,
        billingCycle: "monthly",
        perks: [],
      },
    );
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Robin de Wit",
      email: "robin@northside.test",
      phone: "0611223344",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Saturday Burn",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-26T09:00:00.000Z",
      durationMinutes: 60,
      capacity: 8,
      level: "mixed",
      focus: "Conditioning",
    });

    const first = await services.createBooking(ownerActor, tenantContext, {
      memberId: member.id,
      classSessionId: classSession.id,
      idempotencyKey: "booking-key-one",
      source: "frontdesk",
    });
    const second = await services.createBooking(ownerActor, tenantContext, {
      memberId: member.id,
      classSessionId: classSession.id,
      idempotencyKey: "booking-key-two",
      source: "frontdesk",
    });

    expect(second.alreadyExisted).toBe(true);
    expect(second.booking.id).toBe(first.booking.id);
  });

  it("allows a member to reserve through the member reservation flow", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(
      ownerActor,
      tenantContext,
      {
        name: "Unlimited",
        priceMonthly: 119,
        billingCycle: "monthly",
        perks: [],
      },
    );
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Nina de Boer",
      email: "nina@northside.test",
      phone: "0611112222",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
      portalPassword: "member-pass-123",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Sunday Mobility",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-27T10:00:00.000Z",
      durationMinutes: 45,
      capacity: 12,
      level: "beginner",
      focus: "Mobility",
    });
    const memberActor = createMemberViewer(member.email, tenantContext.tenantId, member.fullName);

    const result = await services.createMemberReservation(memberActor, {
      tenantSlug: tenantContext.tenantId,
      classSessionId: classSession.id,
      notes: "Ik ben er 10 minuten eerder.",
    });

    expect(result.booking.memberId).toBe(member.id);
    expect(result.booking.source).toBe("member_app");
    expect(result.booking.status).toBe("confirmed");
  });

  it("allows trial members to reserve trainerless one-hour open gym capacity slots", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside Open Floor",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 80,
      managerName: "Saar de Jong",
      amenities: ["Open gym", "Krachtzone"],
    });
    const membershipPlan = await services.createMembershipPlan(
      ownerActor,
      tenantContext,
      {
        name: "Trial toegang",
        priceMonthly: 0,
        billingCycle: "monthly",
        perks: ["Vrij trainen reserveren"],
      },
    );
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Lina Trial",
      email: "lina@northside.test",
      phone: "0611112222",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "trial",
      tags: ["open-gym"],
      waiverStatus: "complete",
      portalPassword: "member-pass-123",
    });
    const openGymSlot = await services.createClassSession(ownerActor, tenantContext, {
      title: "Vrij trainen",
      bookingKind: "open_gym",
      locationId: location.id,
      trainerId: "",
      startsAt: daysFromNow(3),
      durationMinutes: 60,
      capacity: 6,
      level: "mixed",
      focus: "Open gym",
    });
    const memberActor = createMemberViewer(member.email, tenantContext.tenantId, member.fullName);
    const snapshot = await services.getMemberReservationSnapshot(memberActor, {
      tenantSlug: tenantContext.tenantId,
    });

    expect(openGymSlot).toMatchObject({
      bookingKind: "open_gym",
      trainerId: "",
      durationMinutes: 60,
      capacity: 6,
    });
    expect(snapshot.classSessions[0]).toMatchObject({
      id: openGymSlot.id,
      bookingKind: "open_gym",
      title: "Vrij trainen",
      trainerName: "Geen trainer",
      durationMinutes: 60,
    });

    const result = await services.createMemberReservation(memberActor, {
      tenantSlug: tenantContext.tenantId,
      classSessionId: openGymSlot.id,
      notes: "Ik wil een uur zelfstandig trainen.",
    });

    expect(result.booking.memberId).toBe(member.id);
    expect(result.booking.classSessionId).toBe(openGymSlot.id);
    expect(result.booking.status).toBe("confirmed");
  });

  it("blocks reservations for accounts without a membership in that club", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Sunday Mobility",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-27T10:00:00.000Z",
      durationMinutes: 45,
      capacity: 12,
      level: "beginner",
      focus: "Mobility",
    });
    const outsiderActor = createMemberViewer(
      "outsider@example.nl",
      tenantContext.tenantId,
      "Outsider",
    );

    await expect(
      services.createMemberReservation(outsiderActor, {
        tenantSlug: tenantContext.tenantId,
        classSessionId: classSession.id,
      }),
    ).rejects.toThrow("Je kunt alleen reserveren bij clubs waar je al een actief lidmaatschap hebt.");
  });

  it("describes an existing checked-in reservation correctly in the member flow", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(
      ownerActor,
      tenantContext,
      {
        name: "Unlimited",
        priceMonthly: 119,
        billingCycle: "monthly",
        perks: [],
      },
    );
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Nina de Boer",
      email: "nina@northside.test",
      phone: "0611112222",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
      portalPassword: "member-pass-123",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Sunday Mobility",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-27T10:00:00.000Z",
      durationMinutes: 45,
      capacity: 12,
      level: "beginner",
      focus: "Mobility",
    });

    const booking = await services.createBooking(ownerActor, tenantContext, {
      memberId: member.id,
      classSessionId: classSession.id,
      idempotencyKey: "existing-checkin-booking",
      source: "frontdesk",
    });

    await services.recordAttendance(ownerActor, tenantContext, {
      bookingId: booking.booking.id,
      expectedVersion: booking.booking.version,
      channel: "frontdesk",
    });
    const memberActor = createMemberViewer(member.email, tenantContext.tenantId, member.fullName);

    const result = await services.createMemberReservation(memberActor, {
      tenantSlug: tenantContext.tenantId,
      classSessionId: classSession.id,
    });

    expect(result.alreadyExisted).toBe(true);
    expect(result.booking.status).toBe("checked_in");
    expect(result.messagePreview).toContain("ingecheckt");
  });

  it("cancelling a confirmed booking promotes the first waitlisted member", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(
      ownerActor,
      tenantContext,
      {
        name: "Unlimited",
        priceMonthly: 119,
        billingCycle: "monthly",
        perks: [],
      },
    );
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const firstMember = await services.createMember(ownerActor, tenantContext, {
      fullName: "Lena Post",
      email: "lena@northside.test",
      phone: "0610001111",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });
    const secondMember = await services.createMember(ownerActor, tenantContext, {
      fullName: "Tess Groot",
      email: "tess@northside.test",
      phone: "0620001111",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Lunch Strength",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-28T12:00:00.000Z",
      durationMinutes: 45,
      capacity: 1,
      level: "mixed",
      focus: "Strength",
    });

    const firstBooking = await services.createBooking(ownerActor, tenantContext, {
      memberId: firstMember.id,
      classSessionId: classSession.id,
      idempotencyKey: "confirmed-booking",
      source: "frontdesk",
    });
    const secondBooking = await services.createBooking(ownerActor, tenantContext, {
      memberId: secondMember.id,
      classSessionId: classSession.id,
      idempotencyKey: "waitlist-booking",
      source: "frontdesk",
    });
    const cancelled = await services.cancelBooking(ownerActor, tenantContext, {
      bookingId: firstBooking.booking.id,
      expectedVersion: firstBooking.booking.version,
    });

    expect(cancelled.booking.status).toBe("cancelled");
    expect(secondBooking.booking.status).toBe("waitlisted");
    expect(cancelled.promotedBooking?.memberId).toBe(secondMember.id);
    expect(cancelled.promotedBooking?.status).toBe("confirmed");
  });

  it("converts a lead into a member with a real contract and location", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, ["marketing.leads"]);

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    const lead = await services.createLead(ownerActor, tenantContext, {
      fullName: "Noa Jansen",
      email: "noa@northside.test",
      phone: "0612345678",
      source: "website",
      stage: "new",
      interest: "Hyrox trial",
      notes: "Wil volgende week starten.",
      expectedValueCents: 11900,
    });

    const conversion = await services.convertLeadToMember(ownerActor, tenantContext, {
      leadId: lead.id,
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "trial",
      tags: ["lead-converted"],
      waiverStatus: "pending",
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(conversion.member.email).toBe("noa@northside.test");
    expect(conversion.member.membershipPlanId).toBe(membershipPlan.id);
    expect(conversion.lead.stage).toBe("won");
    expect(snapshot.members.some((member) => member.email === "noa@northside.test")).toBe(true);
    expect(snapshot.leads.find((item) => item.id === lead.id)?.convertedMemberId).toBe(
      conversion.member.id,
    );
  });

  it("enforces the max daily booking cap from booking policy", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Robin de Wit",
      email: "robin@northside.test",
      phone: "0611223344",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });
    const firstSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Morning Strength",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-05-04T08:00:00.000Z",
      durationMinutes: 60,
      capacity: 8,
      level: "mixed",
      focus: "Strength",
    });
    const secondSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Evening Engine",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-05-04T18:00:00.000Z",
      durationMinutes: 60,
      capacity: 8,
      level: "mixed",
      focus: "Engine",
    });

    await services.updateBookingPolicy(ownerActor, tenantContext, {
      cancellationWindowHours: 12,
      lateCancelFeeCents: 1500,
      noShowFeeCents: 2500,
      maxDailyBookingsPerMember: 1,
      maxDailyWaitlistPerMember: 1,
      autoPromoteWaitlist: true,
    });

    await services.createBooking(ownerActor, tenantContext, {
      memberId: member.id,
      classSessionId: firstSession.id,
      idempotencyKey: "booking-cap-one",
      source: "frontdesk",
    });

    await expect(
      services.createBooking(ownerActor, tenantContext, {
        memberId: member.id,
        classSessionId: secondSession.id,
        idempotencyKey: "booking-cap-two",
        source: "frontdesk",
      }),
    ).rejects.toThrow("daglimiet");
  });

  it("creates a collection case when a booking is cancelled too late", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, ["billing.autocollect"]);
    const nearFutureStart = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Lena Post",
      email: "lena@northside.test",
      phone: "0610001111",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Lunch Strength",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: nearFutureStart,
      durationMinutes: 45,
      capacity: 4,
      level: "mixed",
      focus: "Strength",
    });

    await services.updateBookingPolicy(ownerActor, tenantContext, {
      cancellationWindowHours: 24,
      lateCancelFeeCents: 1750,
      noShowFeeCents: 2500,
      maxDailyBookingsPerMember: 3,
      maxDailyWaitlistPerMember: 2,
      autoPromoteWaitlist: true,
    });

    const booking = await services.createBooking(ownerActor, tenantContext, {
      memberId: member.id,
      classSessionId: classSession.id,
      idempotencyKey: "late-cancel-booking",
      source: "frontdesk",
    });

    await services.cancelBooking(ownerActor, tenantContext, {
      bookingId: booking.booking.id,
      expectedVersion: booking.booking.version,
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(snapshot.collectionCases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberName: "Lena Post",
          amountCents: 1750,
          reason: expect.stringContaining("Late cancellation"),
        }),
      ]),
    );
  });

  it("runs a public member signup flow with direct checkout, waiver signing and onboarding", async () => {
    process.env.MOLLIE_API_KEY = "test_mollie_live_key";
    process.env.APP_BASE_URL = "https://gym.example";
    const paymentRequests: Array<{
      readonly method?: string;
      readonly metadata?: Record<string, string>;
      readonly redirectUrl?: string;
      readonly webhookUrl?: string;
    }> = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      if (target.endsWith("/payments") && init?.method === "POST") {
        paymentRequests.push(JSON.parse(String(init.body)));

        return new Response(
          JSON.stringify({
            id: "tr_signup_checkout_1",
            status: "open",
            _links: {
              checkout: {
                href: "https://pay.mollie.com/p/signup-checkout",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`Unhandled Mollie request: ${target}`);
    }) as typeof fetch;

    const { services, ownerActor, tenantContext, state } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: ["Open gym"],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["Open gym"],
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
    const publicSnapshot = await services.getPublicMembershipSignupSnapshot({
      tenantSlug: state.tenant.id,
    });

    const checkout = await services.submitPublicMemberSignup({
      tenantSlug: state.tenant.id,
      fullName: "Jade Vermeer",
      email: "jade@northside.test",
      phone: "0612345678",
      phoneCountry: "NL",
      membershipPlanId: plan.id,
      preferredLocationId: location.id,
      paymentMethod: "direct_debit",
      contractAccepted: true,
      waiverAccepted: true,
      portalPassword: "jade-member-123",
      notes: "Start het liefst volgende week.",
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);
    const authenticated = await authenticateLocalAccount(
      "jade@northside.test",
      "jade-member-123",
    );
    const approvedMember = checkout.member;

    expect(publicSnapshot.membershipPlans.map((item) => item.id)).toContain(plan.id);
    expect(publicSnapshot.billingReady).toBe(true);
    expect(publicSnapshot.legalReady).toBe(true);
    expect(checkout.signup.status).toBe("approved");
    expect(checkout.signup.waiverAcceptedAt).toBeTruthy();
    expect(checkout.checkoutUrl).toBe("https://pay.mollie.com/p/signup-checkout");
    expect(checkout.providerPaymentId).toBe("tr_signup_checkout_1");
    expect(checkout.invoice).toMatchObject({
      memberId: approvedMember.id,
      memberName: "Jade Vermeer",
      amountCents: 11900,
      status: "open",
      source: "signup_checkout",
      externalReference: "tr_signup_checkout_1",
    });
    expect(approvedMember.email).toBe("jade@northside.test");
    expect(paymentRequests[0]).toMatchObject({
      method: "directdebit",
      redirectUrl: expect.stringContaining("/dashboard/payments"),
      webhookUrl: expect.stringContaining("/api/platform/billing/mollie/webhook"),
      metadata: {
        tenantId: tenantContext.tenantId,
        invoiceId: checkout.invoice.id,
        memberId: approvedMember.id,
        source: "signup_checkout",
      },
    });
    expect(snapshot.memberSignups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: checkout.signup.id,
          status: "approved",
          approvedMemberId: approvedMember.id,
        }),
      ]),
    );
    expect(snapshot.billingBackoffice.invoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberName: "Jade Vermeer",
          amountCents: 11900,
          status: "open",
          source: "signup_checkout",
          externalReference: "tr_signup_checkout_1",
        }),
      ]),
    );
    expect(snapshot.mobileSelfService.contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberId: approvedMember.id,
          membershipPlanId: plan.id,
          documentUrl: expect.stringContaining("contracts/signed/"),
        }),
      ]),
    );
    expect(snapshot.waivers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberId: approvedMember.id,
          status: "signed",
          fileName: "jade-vermeer-waiver.pdf",
          storageKey: "waivers/northside/signed/jade-vermeer-waiver.pdf",
        }),
      ]),
    );
    expect(authenticated?.account.linkedMemberId).toBe(approvedMember.id);
  });

  it("rejects public signup requests for archived plans or locations", async () => {
    const { services, ownerActor, tenantContext, state } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: ["Open gym"],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["Open gym"],
    });

    await services.archiveLocation(ownerActor, tenantContext, {
      id: location.id,
      expectedVersion: location.version,
    });
    await services.archiveMembershipPlan(ownerActor, tenantContext, {
      id: plan.id,
      expectedVersion: plan.version,
    });

    await expect(
      services.submitPublicMemberSignup({
        tenantSlug: state.tenant.id,
        fullName: "Jade Vermeer",
        email: "jade@northside.test",
        phone: "0612345678",
        phoneCountry: "NL",
        membershipPlanId: plan.id,
        preferredLocationId: location.id,
        paymentMethod: "direct_debit",
        contractAccepted: true,
        waiverAccepted: true,
        portalPassword: "jade-member-123",
      }),
    ).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });

  it("manages billing invoices, retries, refunds, webhooks and reconciliation", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, ["billing.autocollect"]);

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: ["Open gym"],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: ["Open gym"],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Robin de Wit",
      email: "robin@northside.test",
      phone: "0611223344",
      phoneCountry: "NL",
      membershipPlanId: plan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });

    const invoice = await services.createBillingInvoice(ownerActor, tenantContext, {
      memberId: member.id,
      memberName: member.fullName,
      description: "Membership May 2026",
      amountCents: 11900,
      dueAt: "2026-05-01T08:00:00.000Z",
      source: "membership",
    });
    const failedWebhook = await services.recordBillingWebhook(ownerActor, tenantContext, {
      invoiceId: invoice.id,
      eventType: "payment.failed",
      status: "failed",
      providerReference: "tr_123",
      payloadSummary: "SEPA mandate rejected",
    });
    const retried = await services.retryBillingInvoice(ownerActor, tenantContext, {
      invoiceId: invoice.id,
      reason: "Nieuwe incassopoging ingepland",
    });
    const successWebhook = await services.recordBillingWebhook(ownerActor, tenantContext, {
      invoiceId: invoice.id,
      eventType: "payment.paid",
      status: "processed",
      providerReference: "tr_123",
      payloadSummary: "Collection succeeded",
    });
    const refund = await services.refundBillingInvoice(ownerActor, tenantContext, {
      invoiceId: invoice.id,
      amountCents: 4900,
      reason: "Partial goodwill refund",
    });
    const reconciliation = await services.reconcileBillingLedger(ownerActor, tenantContext, {
      note: "Daily settlement sync",
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(failedWebhook.eventType).toBe("payment.failed");
    expect(retried.retryCount).toBe(1);
    expect(successWebhook.eventType).toBe("payment.paid");
    expect(refund.invoiceId).toBe(invoice.id);
    expect(reconciliation.totalInvoices).toBeGreaterThanOrEqual(1);
    expect(snapshot.billingBackoffice.invoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: invoice.id,
          status: "refunded",
        }),
      ]),
    );
    expect(snapshot.billingBackoffice.refunds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          invoiceId: invoice.id,
          amountCents: 4900,
        }),
      ]),
    );
    expect(snapshot.billingBackoffice.webhooks).toHaveLength(2);
    expect(snapshot.billingBackoffice.reconciliationRuns[0]?.id).toBe(reconciliation.id);
  });

  it("sends configured billing invoices, retries, refunds and webhook sync to Mollie", async () => {
    process.env.MOLLIE_API_KEY = "test_mollie_live_key";
    process.env.APP_BASE_URL = "https://gym.example";

    let paymentCreateCount = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      if (target.endsWith("/payments") && init?.method === "POST") {
        paymentCreateCount += 1;
        const body = JSON.parse(String(init.body)) as {
          amount: { currency: string; value: string };
          metadata?: { invoiceId?: string; tenantId?: string };
          webhookUrl?: string;
          redirectUrl?: string;
        };

        expect(body.amount).toEqual({ currency: "EUR", value: "119.00" });
        expect(body.metadata?.tenantId).toBeTruthy();
        expect(body.metadata?.invoiceId).toBeTruthy();
        expect(body.webhookUrl).toContain("/api/platform/billing/mollie/webhook");
        expect(body.redirectUrl).toContain("/dashboard/payments");

        const id = paymentCreateCount === 1 ? "tr_invoice_1" : "tr_retry_2";
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

      if (target.endsWith("/payments/tr_retry_2") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            id: "tr_retry_2",
            status: "paid",
            metadata: {
              invoiceId: "placeholder",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (target.endsWith("/payments/tr_retry_2/refunds") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          amount: { currency: string; value: string };
          description: string;
        };

        expect(body).toMatchObject({
          amount: { currency: "EUR", value: "49.00" },
          description: "Partial goodwill refund",
        });

        return new Response(JSON.stringify({ id: "re_1", status: "queued" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unhandled Mollie request: ${target}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, ["billing.autocollect"]);

    await services.updateBillingSettings(ownerActor, tenantContext, {
      enabled: true,
      provider: "mollie",
      profileLabel: "Northside Athletics Payments",
      profileId: "pfl_test_123456",
      settlementLabel: "Northside Club",
      supportEmail: "billing@northside.test",
      paymentMethods: ["direct_debit", "one_time", "payment_request"],
    });

    const invoice = await services.createBillingInvoice(ownerActor, tenantContext, {
      memberName: "Robin de Wit",
      description: "Membership May 2026",
      amountCents: 11900,
      dueAt: "2026-05-01T08:00:00.000Z",
      source: "membership",
    });
    const retried = await services.retryBillingInvoice(ownerActor, tenantContext, {
      invoiceId: invoice.id,
      reason: "Nieuwe incassopoging ingepland",
    });
    const webhook = await services.syncMollieBillingWebhook({
      tenantId: tenantContext.tenantId,
      paymentId: retried.externalReference!,
    });
    const refund = await services.refundBillingInvoice(ownerActor, tenantContext, {
      invoiceId: invoice.id,
      amountCents: 4900,
      reason: "Partial goodwill refund",
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(invoice.externalReference).toBe("tr_invoice_1");
    expect(retried.externalReference).toBe("tr_retry_2");
    expect(webhook).toMatchObject({
      invoiceId: invoice.id,
      eventType: "payment.paid",
      providerReference: "tr_retry_2",
      status: "processed",
    });
    expect(refund.status).toBe("processed");
    expect(snapshot.billingBackoffice.invoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: invoice.id,
          status: "refunded",
          externalReference: "tr_retry_2",
        }),
      ]),
    );
  });

  it("creates lead attribution and follow-up tasks, including abandoned booking automation", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, ["marketing.leads"]);

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Noah Post",
      email: "noah@northside.test",
      phone: "0611002200",
      phoneCountry: "NL",
      membershipPlanId: plan.id,
      homeLocationId: location.id,
      status: "trial",
      tags: [],
      waiverStatus: "complete",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Trial Burn",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      capacity: 8,
      level: "mixed",
      focus: "Trial",
    });
    const lead = await services.createLead(ownerActor, tenantContext, {
      fullName: "Zoë Janssen",
      email: "zoe@northside.test",
      phone: "0612334455",
      source: "meta_ads",
      stage: "new",
      interest: "Intro offer",
      expectedValueCents: 8900,
    });
    const booking = await services.createBooking(ownerActor, tenantContext, {
      memberId: member.id,
      classSessionId: classSession.id,
      idempotencyKey: "lead-automation-booking",
      source: "frontdesk",
    });

    await services.cancelBooking(ownerActor, tenantContext, {
      bookingId: booking.booking.id,
      expectedVersion: booking.booking.version,
    });

    const automationRun = await services.runLeadAutomations(ownerActor, tenantContext, {
      trigger: "manual",
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(lead.source).toBe("meta_ads");
    expect(automationRun.createdTasks).toBeGreaterThanOrEqual(1);
    expect(snapshot.leadAutomation.attributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          leadId: lead.id,
          source: "meta_ads",
        }),
      ]),
    );
    expect(snapshot.leadAutomation.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "nurture",
          leadId: lead.id,
        }),
        expect.objectContaining({
          type: "abandoned_booking",
          memberId: member.id,
        }),
      ]),
    );
  });

  it("supports recurring PT appointments with packs, credits and coach agenda", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, [
      "booking.credit_system",
      "booking.one_to_one",
    ]);

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside PT Studio",
      city: "Amsterdam",
      neighborhood: "Centrum",
      capacity: 24,
      managerName: "Saar de Jong",
      amenities: ["Private studio"],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "PT Hybrid",
      priceMonthly: 149,
      billingCycle: "monthly",
      perks: ["Open gym"],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Eva Trainer",
      homeLocationId: location.id,
      specialties: ["PT"],
      certifications: ["NASM-CPT"],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Mila de Boer",
      email: "mila@northside.test",
      phone: "0612121212",
      phoneCountry: "NL",
      membershipPlanId: plan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });

    const pack = await services.createAppointmentPack(ownerActor, tenantContext, {
      memberId: member.id,
      memberName: member.fullName,
      trainerId: trainer.id,
      title: "10x PT pack",
      totalCredits: 10,
      validUntil: "2026-12-31T00:00:00.000Z",
    });
    const appointmentResult = await services.createCoachAppointments(ownerActor, tenantContext, {
      trainerId: trainer.id,
      memberId: member.id,
      memberName: member.fullName,
      locationId: location.id,
      startsAt: "2026-05-05T08:00:00.000Z",
      durationMinutes: 60,
      recurrence: "weekly",
      occurrences: 3,
      creditPackId: pack.id,
      notes: "Engine + strength block",
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(appointmentResult.appointments).toHaveLength(3);
    expect(appointmentResult.pack?.remainingCredits).toBe(7);
    expect(snapshot.appointments.creditPacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pack.id,
          remainingCredits: 7,
        }),
      ]),
    );
    expect(snapshot.appointments.sessions.filter((item) => item.trainerId === trainer.id)).toHaveLength(
      3,
    );
  });

  it("blocks coach appointments when the selected PT pack does not have enough credits", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, [
      "booking.credit_system",
      "booking.one_to_one",
    ]);

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside PT Studio",
      city: "Amsterdam",
      neighborhood: "Centrum",
      capacity: 24,
      managerName: "Saar de Jong",
      amenities: ["Private studio"],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "PT Hybrid",
      priceMonthly: 149,
      billingCycle: "monthly",
      perks: ["Open gym"],
    });
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Eva Trainer",
      homeLocationId: location.id,
      specialties: ["PT"],
      certifications: ["NASM-CPT"],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Mila de Boer",
      email: "mila@northside.test",
      phone: "0612121212",
      phoneCountry: "NL",
      membershipPlanId: plan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });

    const pack = await services.createAppointmentPack(ownerActor, tenantContext, {
      memberId: member.id,
      memberName: member.fullName,
      trainerId: trainer.id,
      title: "2x PT pack",
      totalCredits: 2,
      validUntil: "2026-12-31T00:00:00.000Z",
    });

    await expect(
      services.createCoachAppointments(ownerActor, tenantContext, {
        trainerId: trainer.id,
        memberId: member.id,
        memberName: member.fullName,
        locationId: location.id,
        startsAt: "2026-05-05T08:00:00.000Z",
        durationMinutes: 60,
        recurrence: "weekly",
        occurrences: 3,
        creditPackId: pack.id,
        notes: "Engine + strength block",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });

    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);
    expect(snapshot.appointments.creditPacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pack.id,
          remainingCredits: 2,
        }),
      ]),
    );
    expect(snapshot.appointments.sessions).toHaveLength(0);
  });

  it("stores community groups, challenges and questionnaires as first-class records", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, [
      "retention.community_groups",
      "retention.challenges_rewards",
      "retention.questionnaire",
    ]);

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Lotte Janssen",
      email: "lotte@northside.test",
      phone: "0619191919",
      phoneCountry: "NL",
      membershipPlanId: plan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });

    const group = await services.createCommunityGroup(ownerActor, tenantContext, {
      name: "Women lifting club",
      channel: "WhatsApp",
      description: "Community voor vrijdag avond lifters.",
      memberIds: [member.id],
    });
    const challenge = await services.createMemberChallenge(ownerActor, tenantContext, {
      title: "10-class streak",
      rewardLabel: "Recovery hoodie",
      startsAt: "2026-05-01T00:00:00.000Z",
      endsAt: "2026-06-01T00:00:00.000Z",
      participantMemberIds: [member.id],
    });
    const questionnaire = await services.createQuestionnaire(ownerActor, tenantContext, {
      title: "Week 2 pulse check",
      trigger: "After week 2",
      questions: ["Hoe voel je je herstel?", "Welke les wil je vaker doen?"],
    });
    const response = await services.submitQuestionnaireResponse(ownerActor, tenantContext, {
      questionnaireId: questionnaire.id,
      memberId: member.id,
      memberName: member.fullName,
      answers: ["Goed", "Hyrox"],
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(group.memberIds).toEqual([member.id]);
    expect(challenge.participantMemberIds).toEqual([member.id]);
    expect(response.questionnaireId).toBe(questionnaire.id);
    expect(snapshot.communityHub.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: group.id,
          name: "Women lifting club",
        }),
      ]),
    );
    expect(snapshot.communityHub.challenges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: challenge.id,
          rewardLabel: "Recovery hoodie",
        }),
      ]),
    );
    expect(snapshot.communityHub.questionnaires).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: questionnaire.id,
          responseCount: 1,
        }),
      ]),
    );
  });

  it("tracks mobile self-service receipts, payment method updates, pause requests and contracts", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, ["mobile.white_label"]);

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Kim Vos",
      email: "kim@northside.test",
      phone: "0615151515",
      phoneCountry: "NL",
      membershipPlanId: plan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
      portalPassword: "kim-member-123",
    });

    const invoice = await services.createBillingInvoice(ownerActor, tenantContext, {
      memberId: member.id,
      memberName: member.fullName,
      description: "Membership receipt",
      amountCents: 11900,
      dueAt: "2026-05-01T08:00:00.000Z",
      source: "membership",
    });
    await services.recordBillingWebhook(ownerActor, tenantContext, {
      invoiceId: invoice.id,
      eventType: "payment.paid",
      status: "processed",
      providerReference: "tr_paid",
      payloadSummary: "Payment successful",
    });
    const paymentRequest = await services.requestMobilePaymentMethodUpdate(ownerActor, tenantContext, {
      memberId: member.id,
      memberName: member.fullName,
      requestedMethodLabel: "Nieuwe SEPA IBAN",
      note: "Overstap naar gezamenlijke rekening",
    });
    const pauseRequest = await services.requestMembershipPause(ownerActor, tenantContext, {
      memberId: member.id,
      memberName: member.fullName,
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-30T00:00:00.000Z",
      reason: "Vakantie",
    });
    await services.reviewMobilePaymentMethodUpdate(ownerActor, tenantContext, {
      requestId: paymentRequest.id,
      decision: "approved",
      ownerNotes: "Nieuwe machtiging ontvangen",
    });
    const reviewedPause = await services.reviewMembershipPause(ownerActor, tenantContext, {
      requestId: pauseRequest.id,
      decision: "approved",
      ownerNotes: "Pauze ingepland",
    });
    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);
    const pausedMember = reviewedPause.member!;

    expect(pausedMember.status).toBe("paused");
    expect(snapshot.mobileSelfService.receipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberId: member.id,
          invoiceId: invoice.id,
        }),
      ]),
    );
    expect(snapshot.mobileSelfService.paymentMethodRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: paymentRequest.id,
          status: "approved",
        }),
      ]),
    );
    expect(snapshot.mobileSelfService.pauseRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pauseRequest.id,
          status: "approved",
        }),
      ]),
    );
    expect(snapshot.mobileSelfService.contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberId: member.id,
          contractName: "Unlimited",
        }),
      ]),
    );
  });

  it("lets members submit their own mobile self-service requests but not review them", async () => {
    const { services, ownerActor, tenantContext, state } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, ["mobile.white_label"]);

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Kim Vos",
      email: "kim@northside.test",
      phone: "0615151515",
      phoneCountry: "NL",
      membershipPlanId: plan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
      portalPassword: "kim-member-123",
    });
    const memberActor = createMemberViewer("kim@northside.test", state.tenant.id, "Kim Vos");

    const paymentRequest = await services.requestMobilePaymentMethodUpdate(
      memberActor,
      tenantContext,
      {
        memberId: member.id,
        memberName: member.fullName,
        requestedMethodLabel: "Nieuwe SEPA IBAN",
        note: "Overstap naar gezamenlijke rekening",
      },
    );
    const pauseRequest = await services.requestMembershipPause(memberActor, tenantContext, {
      memberId: member.id,
      memberName: member.fullName,
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-30T00:00:00.000Z",
      reason: "Vakantie",
    });

    expect(paymentRequest.status).toBe("pending");
    expect(pauseRequest.status).toBe("pending");

    await expect(
      services.reviewMobilePaymentMethodUpdate(memberActor, tenantContext, {
        requestId: paymentRequest.id,
        decision: "approved",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      services.reviewMembershipPause(memberActor, tenantContext, {
        requestId: pauseRequest.id,
        decision: "approved",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("includes filtered self-service data in the member reservation snapshot", async () => {
    const { services, ownerActor, tenantContext, state } = await bootstrapOwnerPlatform();
    await enableTenantFeatures(services, ownerActor, tenantContext, ["mobile.white_label"]);

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Kim Vos",
      email: "kim@northside.test",
      phone: "0615151515",
      phoneCountry: "NL",
      membershipPlanId: plan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
      portalPassword: "kim-member-123",
    });
    const invoice = await services.createBillingInvoice(ownerActor, tenantContext, {
      memberId: member.id,
      memberName: member.fullName,
      description: "Membership receipt",
      amountCents: 11900,
      dueAt: "2026-05-01T08:00:00.000Z",
      source: "membership",
    });
    await services.recordBillingWebhook(ownerActor, tenantContext, {
      invoiceId: invoice.id,
      eventType: "payment.paid",
      status: "processed",
      providerReference: "tr_paid",
      payloadSummary: "Payment successful",
    });
    const memberActor = createMemberViewer("kim@northside.test", state.tenant.id, "Kim Vos");

    await services.requestMobilePaymentMethodUpdate(memberActor, tenantContext, {
      memberId: member.id,
      memberName: member.fullName,
      requestedMethodLabel: "Nieuwe SEPA IBAN",
      note: "Overstap naar gezamenlijke rekening",
    });
    const reservationSnapshot = await services.getMemberReservationSnapshot(memberActor, {
      tenantSlug: state.tenant.id,
    });

    expect(reservationSnapshot.selfService.receipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          invoiceId: invoice.id,
          memberId: member.id,
        }),
      ]),
    );
    expect(reservationSnapshot.selfService.contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberId: member.id,
          contractName: "Unlimited",
        }),
      ]),
    );
    expect(reservationSnapshot.selfService.paymentMethodRequests).toHaveLength(1);
  });

  it("rejects attendance updates with an outdated version", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const membershipPlan = await services.createMembershipPlan(
      ownerActor,
      tenantContext,
      {
        name: "Unlimited",
        priceMonthly: 119,
        billingCycle: "monthly",
        perks: [],
      },
    );
    const trainer = await services.createTrainer(ownerActor, tenantContext, {
      fullName: "Jay Hassan",
      homeLocationId: location.id,
      specialties: [],
      certifications: [],
    });
    const member = await services.createMember(ownerActor, tenantContext, {
      fullName: "Lisa Bakker",
      email: "lisa@northside.test",
      phone: "0645678901",
      phoneCountry: "NL",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });
    const classSession = await services.createClassSession(ownerActor, tenantContext, {
      title: "Lunch Reset",
      locationId: location.id,
      trainerId: trainer.id,
      startsAt: "2026-04-20T12:00:00.000Z",
      durationMinutes: 45,
      capacity: 10,
      level: "beginner",
      focus: "Mobility",
    });
    const booking = await services.createBooking(ownerActor, tenantContext, {
      memberId: member.id,
      classSessionId: classSession.id,
      idempotencyKey: "attendance-version-key",
      source: "frontdesk",
    });

    await expect(
      services.recordAttendance(ownerActor, tenantContext, {
        bookingId: booking.booking.id,
        expectedVersion: booking.booking.version + 1,
        channel: "frontdesk",
      }),
    ).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
  });

  it("lets an owner configure remote access for a gym", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });

    const remoteAccess = await services.updateRemoteAccessSettings(
      ownerActor,
      tenantContext,
      {
        enabled: true,
        provider: "nuki",
        bridgeType: "cloud_api",
        locationId: location.id,
        deviceLabel: "Hoofdingang",
        externalDeviceId: "nuki-lock-01",
        notes: "Open op afstand voor owners",
      },
    );

    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(remoteAccess.provider).toBe("nuki");
    expect(remoteAccess.connectionStatus).toBe("configured");
    expect(remoteAccess.locationId).toBe(location.id);
    expect(snapshot.remoteAccess.providerLabel).toBe("Nuki Smart Lock");
    expect(snapshot.uiCapabilities.canManageRemoteAccess).toBe(true);
  });

  it("returns a lighter dashboard snapshot for section pages", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });
    const plan = await services.createMembershipPlan(ownerActor, tenantContext, {
      name: "Unlimited",
      priceMonthly: 119,
      billingCycle: "monthly",
      perks: [],
    });
    await services.createMember(ownerActor, tenantContext, {
      fullName: "Kim Vos",
      email: "kim@northside.test",
      phone: "0615151515",
      phoneCountry: "NL",
      membershipPlanId: plan.id,
      homeLocationId: location.id,
      status: "active",
      tags: [],
      waiverStatus: "complete",
    });

    const accessSnapshot = await services.getDashboardSnapshot(ownerActor, tenantContext, {
      page: "access",
    });

    expect(accessSnapshot.remoteAccess.statusLabel).toBeTruthy();
    expect(accessSnapshot.auditEntries.length).toBeGreaterThan(0);
    expect(accessSnapshot.members).toHaveLength(0);
    expect(accessSnapshot.classSessions).toHaveLength(0);
    expect(accessSnapshot.mobileSelfService.contracts).toHaveLength(0);
  });

  it("blocks managers from changing remote access settings", async () => {
    const { state, services, tenantContext } = await bootstrapOwnerPlatform();

    const managerState = await createLocalPlatformAccount(state.tenant.id, {
      displayName: "Niels Ops",
      email: "ops@northside.test",
      password: "ops-pass-123",
      roleKey: "manager",
    });
    const managerAccount = managerState.accounts.find(
      (account) => account.email === "ops@northside.test",
    );
    const managerActor = buildPlatformActor(managerAccount!, state.tenant.id);

    await expect(
      services.updateRemoteAccessSettings(managerActor, tenantContext, {
        enabled: true,
        provider: "nuki",
        bridgeType: "cloud_api",
        locationId: null,
        deviceLabel: "Hoofdingang",
        externalDeviceId: "nuki-lock-01",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("opens a configured Nuki smart lock through the live provider", async () => {
    process.env.NUKI_API_TOKEN = "nuki-live-token";
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.nuki.io/smartlock/nuki-lock-01/action/unlock");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        authorization: "Bearer nuki-live-token",
      });

      return new Response(
        JSON.stringify({
          id: "nuki_action_1",
          status: "accepted",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });

    await services.updateRemoteAccessSettings(ownerActor, tenantContext, {
      enabled: true,
      provider: "nuki",
      bridgeType: "cloud_api",
      locationId: location.id,
      deviceLabel: "Hoofdingang",
      externalDeviceId: "nuki-lock-01",
    });

    const action = await services.requestRemoteAccessUnlock(ownerActor, tenantContext);

    expect(action.provider).toBe("nuki");
    expect(action.mode).toBe("live");
    expect(action.providerActionId).toBe("nuki_action_1");
    expect(action.providerStatus).toBe("accepted");
    expect(action.summary).toContain("Nuki Smart Lock");
    expect(action.summary).toContain("Hoofdingang");
  });

  it("blocks Nuki remote opens when live credentials are missing", async () => {
    delete process.env.NUKI_API_TOKEN;
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: [],
    });

    await services.updateRemoteAccessSettings(ownerActor, tenantContext, {
      enabled: true,
      provider: "nuki",
      bridgeType: "cloud_api",
      locationId: location.id,
      deviceLabel: "Hoofdingang",
      externalDeviceId: "nuki-lock-01",
    });

    await expect(
      services.requestRemoteAccessUnlock(ownerActor, tenantContext),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: expect.stringContaining("Nuki live credentials ontbreken"),
    });
  });

  it("lets an owner configure Mollie billing for a gym", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    const billing = await services.updateBillingSettings(
      ownerActor,
      tenantContext,
      {
        enabled: true,
        provider: "mollie",
        profileLabel: "Northside Athletics Payments",
        profileId: "pfl_test_123456",
        settlementLabel: "Northside Club",
        supportEmail: "billing@northside.test",
        paymentMethods: ["direct_debit", "one_time", "payment_request"],
        notes: "Preview voor incasso en betaalverzoek",
      },
    );

    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(billing.provider).toBe("mollie");
    expect(billing.connectionStatus).toBe("configured");
    expect(billing.paymentMethods).toEqual([
      "direct_debit",
      "one_time",
      "payment_request",
    ]);
    expect(snapshot.payments.providerLabel).toBe("Mollie");
    expect(snapshot.uiCapabilities.canManagePayments).toBe(true);
  });

  it("blocks managers from changing Mollie billing settings", async () => {
    const { state, services, tenantContext } = await bootstrapOwnerPlatform();

    const managerState = await createLocalPlatformAccount(state.tenant.id, {
      displayName: "Niels Ops",
      email: "ops@northside.test",
      password: "ops-pass-123",
      roleKey: "manager",
    });
    const managerAccount = managerState.accounts.find(
      (account) => account.email === "ops@northside.test",
    );
    const managerActor = buildPlatformActor(managerAccount!, state.tenant.id);

    await expect(
      services.updateBillingSettings(managerActor, tenantContext, {
        enabled: true,
        provider: "mollie",
        profileLabel: "Northside Athletics Payments",
        profileId: "pfl_test_123456",
        settlementLabel: "Northside Club",
        supportEmail: "billing@northside.test",
        paymentMethods: ["one_time"],
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("blocks managers from changing tenant feature flags", async () => {
    const { state, services, tenantContext } = await bootstrapOwnerPlatform();

    const managerState = await createLocalPlatformAccount(state.tenant.id, {
      displayName: "Niels Ops",
      email: "ops@northside.test",
      password: "ops-pass-123",
      roleKey: "manager",
    });
    const managerAccount = managerState.accounts.find(
      (account) => account.email === "ops@northside.test",
    );
    const managerActor = buildPlatformActor(managerAccount!, state.tenant.id);

    await expect(
      services.updateFeatureFlag(managerActor, tenantContext, {
        key: "coaching.ai_max",
        enabled: true,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("blocks managers from changing coaching workspace settings", async () => {
    const { state, services, tenantContext } = await bootstrapOwnerPlatform();

    const managerState = await createLocalPlatformAccount(state.tenant.id, {
      displayName: "Niels Ops",
      email: "ops@northside.test",
      password: "ops-pass-123",
      roleKey: "manager",
    });
    const managerAccount = managerState.accounts.find(
      (account) => account.email === "ops@northside.test",
    );
    const managerActor = buildPlatformActor(managerAccount!, state.tenant.id);

    await expect(
      services.updateCoachingWorkspace(managerActor, tenantContext, {
        workoutPlanFocus: "Hyrox",
        nutritionCadence: "weekly",
        videoLibraryUrl: "",
        progressMetric: "Attendance",
        heartRateProvider: "Myzone",
        aiCoachMode: "Standard",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("blocks managers from changing booking workspace settings", async () => {
    const { state, services, tenantContext } = await bootstrapOwnerPlatform();

    const managerState = await createLocalPlatformAccount(state.tenant.id, {
      displayName: "Niels Ops",
      email: "ops@northside.test",
      password: "ops-pass-123",
      roleKey: "manager",
    });
    const managerAccount = managerState.accounts.find(
      (account) => account.email === "ops@northside.test",
    );
    const managerActor = buildPlatformActor(managerAccount!, state.tenant.id);

    await expect(
      services.updateBookingWorkspace(managerActor, tenantContext, {
        oneToOneSessionName: "Performance PT",
        oneToOneDurationMinutes: 60,
        trialBookingUrl: "https://book.northside.test/trial",
        defaultCreditPackSize: 10,
        schedulingWindowDays: 14,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("creates a live Mollie payment request flow", async () => {
    process.env.MOLLIE_API_KEY = "test_mollie_live_key";
    process.env.APP_BASE_URL = "https://gym.example";
    globalThis.fetch =
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "tr_request_1",
            status: "open",
            _links: {
              checkout: {
                href: "https://pay.mollie.com/p/request",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ) as typeof fetch;
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    await services.updateBillingSettings(ownerActor, tenantContext, {
      enabled: true,
      provider: "mollie",
      profileLabel: "Northside Athletics Payments",
      profileId: "pfl_test_123456",
      settlementLabel: "Northside Club",
      supportEmail: "billing@northside.test",
      paymentMethods: ["direct_debit", "one_time", "payment_request"],
    });

    const action = await services.requestBillingPreview(ownerActor, tenantContext, {
      paymentMethod: "payment_request",
      amountCents: 2495,
      currency: "EUR",
      description: "Intake bundle",
      memberName: "Noa van Dijk",
    });

    expect(action.provider).toBe("mollie");
    expect(action.paymentMethod).toBe("payment_request");
    expect(action.mode).toBe("live");
    expect(action.checkoutUrl).toBe("https://pay.mollie.com/p/request");
    expect(action.providerPaymentId).toBe("tr_request_1");
    expect(action.summary).toContain("Mollie");
    expect(action.summary).toContain("Noa van Dijk");
  });

  it("blocks Mollie payment actions when live credentials are missing", async () => {
    delete process.env.MOLLIE_API_KEY;
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();

    await services.updateBillingSettings(ownerActor, tenantContext, {
      enabled: true,
      provider: "mollie",
      profileLabel: "Northside Athletics Payments",
      profileId: "pfl_test_123456",
      settlementLabel: "Northside Club",
      supportEmail: "billing@northside.test",
      paymentMethods: ["payment_request"],
    });

    await expect(
      services.requestBillingPreview(ownerActor, tenantContext, {
        paymentMethod: "payment_request",
        amountCents: 2495,
        currency: "EUR",
        description: "Intake bundle",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: expect.stringContaining("Mollie live credentials ontbreken"),
    });
  });

  it("imports existing contracts and customer list in one flow", async () => {
    const { services, ownerActor, tenantContext } = await bootstrapOwnerPlatform();
    const location = await services.createLocation(ownerActor, tenantContext, {
      name: "Northside East",
      city: "Amsterdam",
      neighborhood: "Oost",
      capacity: 180,
      managerName: "Saar de Jong",
      amenities: ["Open gym"],
    });

    const result = await services.importContractsAndMembers(
      ownerActor,
      tenantContext,
      {
        defaultLocationId: location.id,
        rows: [
          {
            fullName: "Noa van Dijk",
            email: "noa@northside.test",
            phone: "0612345678",
            phoneCountry: "NL",
            membershipName: "Unlimited Maand",
            billingCycle: "monthly",
            priceMonthly: 79,
            status: "active",
            waiverStatus: "pending",
            tags: ["morning"],
          },
          {
            fullName: "Mila Jansen",
            email: "mila@northside.test",
            phone: "0687654321",
            phoneCountry: "NL",
            membershipName: "Unlimited Halfjaar",
            billingCycle: "semiannual",
            priceMonthly: 69,
            status: "active",
            waiverStatus: "complete",
            tags: ["hyrox"],
          },
          {
            fullName: "Noa van Dijk",
            email: "noa@northside.test",
            phone: "0612345678",
            phoneCountry: "NL",
            membershipName: "Unlimited Maand",
            billingCycle: "monthly",
            priceMonthly: 79,
            status: "active",
            waiverStatus: "pending",
            tags: ["morning"],
          },
        ],
      },
    );

    const snapshot = await services.getDashboardSnapshot(ownerActor, tenantContext);

    expect(result.createdMembershipPlans).toBe(2);
    expect(result.importedMembers).toBe(2);
    expect(result.skippedMembers).toBe(1);
    expect(result.skippedEmails).toEqual(["noa@northside.test"]);
    expect(snapshot.membershipPlans.map((plan) => plan.billingCycle)).toEqual([
      "monthly",
      "semiannual",
    ]);
    expect(snapshot.members).toHaveLength(2);
  });
});
