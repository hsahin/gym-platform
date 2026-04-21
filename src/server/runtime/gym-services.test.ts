import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bootstrapLocalPlatform,
  createLocalPlatformAccount,
} from "@/server/persistence/local-platform-state";
import { buildPlatformActor } from "@/server/runtime/demo-session";
import { createGymPlatformServices } from "@/server/runtime/gym-services";

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

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "gym-platform-"));
  process.env.LOCAL_PLATFORM_STATE_FILE = path.join(tempDir, "platform-state.json");
  process.env.PLATFORM_STATE_BACKEND = "file";
});

afterEach(async () => {
  delete process.env.LOCAL_PLATFORM_STATE_FILE;
  delete process.env.PLATFORM_STATE_BACKEND;
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
      startsAt: "2026-04-22T18:30:00.000Z",
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
    expect(secondSnapshot.tenantName).toBe("Atlas Forge Club");
    expect(secondSnapshot.classSessions[0]?.title).toBe("Forge HIIT");
    expect(secondSnapshot.availableGyms).toHaveLength(2);
    expect(firstTenantContext.tenantId).toBe(firstTenant.tenant.id);
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

  it("allows a member to reserve through the public reservation flow", async () => {
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

    const result = await services.createPublicReservation({
      classSessionId: classSession.id,
      email: member.email,
      phone: member.phone,
      phoneCountry: member.phoneCountry,
      notes: "Ik ben er 10 minuten eerder.",
    });

    expect(result.booking.memberId).toBe(member.id);
    expect(result.booking.source).toBe("member_app");
    expect(result.booking.status).toBe("confirmed");
  });

  it("turns a new public reserver into a trial member before booking", async () => {
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
        name: "Trial",
        priceMonthly: 0,
        billingCycle: "monthly",
        perks: ["Eerste proefles"],
      },
    );
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

    const result = await services.createPublicReservation({
      classSessionId: classSession.id,
      fullName: "Noor Bakker",
      email: "noor@example.nl",
      phone: "0612345678",
      phoneCountry: "NL",
    });
    const members = await services.listMembers(ownerActor, tenantContext);
    const createdMember = members.find((member) => member.email === "noor@example.nl");

    expect(createdMember).toMatchObject({
      fullName: "Noor Bakker",
      membershipPlanId: membershipPlan.id,
      homeLocationId: location.id,
      status: "trial",
      waiverStatus: "pending",
    });
    expect(result.booking.memberId).toBe(createdMember?.id);
    expect(result.booking.memberName).toBe("Noor Bakker");
    expect(result.booking.status).toBe("confirmed");
  });

  it("describes an existing checked-in reservation correctly in the public flow", async () => {
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

    const result = await services.createPublicReservation({
      classSessionId: classSession.id,
      email: member.email,
      phone: member.phone,
      phoneCountry: member.phoneCountry,
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

  it("returns a remote unlock preview after configuration", async () => {
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
    expect(action.summary).toContain("Nuki Smart Lock");
    expect(action.summary).toContain("Hoofdingang");
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

  it("returns a billing preview for a payment request flow", async () => {
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
    expect(action.summary).toContain("Mollie");
    expect(action.summary).toContain("Noa van Dijk");
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
