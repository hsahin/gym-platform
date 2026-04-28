import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyGymStoreState } from "@/server/persistence/memory-gym-store";
import {
  authenticateLocalAccount,
  bootstrapLocalPlatform,
  createLocalTenantCollectionCase,
  createLocalTenantLead,
  createLocalTenantMemberSignup,
  createLocalTenantBillingInvoice,
  createLocalTenantLeadTask,
  createLocalTenantLeadAttribution,
  createLocalTenantAppointmentPack,
  createLocalTenantCoachAppointments,
  createLocalTenantCommunityGroup,
  createLocalTenantChallenge,
  createLocalTenantQuestionnaire,
  createLocalTenantQuestionnaireResponse,
  createLocalTenantPaymentMethodRequest,
  createLocalTenantPauseRequest,
  createLocalTenantContractRecord,
  createLocalPlatformAccount,
  getLocalTenantProfile,
  getLocalTenantProfileBySlug,
  hasLocalPlatformSetup,
  listLocalMemberPortalAccountsByEmail,
  listLocalPlatformAccounts,
  listLocalTenants,
  markLocalTenantBillingAction,
  markLocalTenantRemoteAccessAction,
  readLocalPlatformState,
  slugifyTenantName,
  upsertLocalMemberPortalAccount,
  updateLocalTenantBillingSettings,
  updateLocalTenantBookingSettings,
  updateLocalTenantCoachingSettings,
  updateLocalTenantFeatureFlag,
  updateLocalTenantIntegrationSettings,
  updateLocalTenantMarketingSettings,
  updateLocalTenantCollectionCase,
  updateLocalTenantLead,
  updateLocalPlatformData,
  updateLocalTenantBookingPolicy,
  updateLocalTenantMobileSettings,
  updateLocalTenantRemoteAccess,
  updateLocalTenantRevenueSettings,
  updateLocalTenantRetentionSettings,
  reviewLocalTenantMemberSignup,
  updateLocalTenantBillingInvoice,
  createLocalTenantBillingRefund,
  createLocalTenantBillingWebhook,
  createLocalTenantBillingReconciliationRun,
  updateLocalTenantLeadTask,
  reviewLocalTenantPaymentMethodRequest,
  reviewLocalTenantPauseRequest,
  ensureConfiguredSuperadminAccount,
  upsertLocalSuperadminAccount,
} from "@/server/persistence/platform-state";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "gym-platform-state-"));
  process.env.LOCAL_PLATFORM_STATE_FILE = path.join(tempDir, "platform-state.json");
});

afterEach(async () => {
  delete process.env.LOCAL_PLATFORM_STATE_FILE;
  vi.unstubAllEnvs();
  await rm(tempDir, { recursive: true, force: true });
});

describe("platform state", () => {
  it("starts empty and derives stable tenant slugs", async () => {
    await expect(readLocalPlatformState()).resolves.toBeNull();
    await expect(hasLocalPlatformSetup()).resolves.toBe(false);
    await expect(listLocalTenants()).resolves.toEqual([]);
    await expect(listLocalPlatformAccounts()).resolves.toEqual([]);
    await expect(getLocalTenantProfile()).resolves.toBeNull();
    await expect(getLocalTenantProfileBySlug("missing")).resolves.toBeNull();
    await expect(authenticateLocalAccount("missing@example.test", "password")).resolves.toBeNull();
    expect(slugifyTenantName(" Atlas Forge Club! ")).toBe("atlas-forge-club");
    expect(slugifyTenantName("!!!")).toBe("gym-platform");
  });

  it("blocks file fallback during production starts without live datastores", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "");
    delete process.env.DIGITALOCEAN_APP_ID;

    await expect(readLocalPlatformState()).rejects.toThrow(
      "Productieconfiguratie mist verplichte onderdelen",
    );
  });

  it("can store multiple gyms next to each other", async () => {
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

    const tenants = await listLocalTenants();

    expect(tenants.map((tenant) => tenant.id)).toEqual([
      firstTenant.tenant.id,
      secondTenant.tenant.id,
    ]);
    await expect(hasLocalPlatformSetup()).resolves.toBe(true);
    await expect(getLocalTenantProfile()).resolves.toMatchObject({
      id: firstTenant.tenant.id,
    });
    await expect(getLocalTenantProfileBySlug("ATLAS-FORGE-CLUB")).resolves.toMatchObject({
      id: secondTenant.tenant.id,
    });
  });

  it("authenticates accounts without exposing gym selection", async () => {
    const firstTenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await bootstrapLocalPlatform({
      tenantName: "Atlas Forge Club",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "second-pass-123",
    });

    const authenticatedWithoutSlug = await authenticateLocalAccount(
      "owner@northside.test",
      "strong-pass-123",
    );
    const authenticated = await authenticateLocalAccount(
      "owner@northside.test",
      "strong-pass-123",
      firstTenant.tenant.id,
    );

    expect(authenticatedWithoutSlug?.tenant.id).toBe(firstTenant.tenant.id);
    expect(authenticated?.tenant.id).toBe(firstTenant.tenant.id);
    expect(authenticated?.account.displayName).toBe("Amina Hassan");
    await expect(
      authenticateLocalAccount("owner@northside.test", "wrong-pass", firstTenant.tenant.id),
    ).resolves.toBeNull();
    await expect(
      authenticateLocalAccount("unknown@northside.test", "strong-pass-123", firstTenant.tenant.id),
    ).resolves.toBeNull();
  });

  it("rejects ambiguous email and password combinations across gyms", async () => {
    await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await bootstrapLocalPlatform({
      tenantName: "Atlas Forge Club",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await expect(
      authenticateLocalAccount("owner@northside.test", "strong-pass-123"),
    ).resolves.toBeNull();
  });

  it("allows one member login to span multiple clubs when the same credentials are linked", async () => {
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

    await upsertLocalMemberPortalAccount(firstTenant.tenant.id, {
      memberId: "member_nina_northside",
      displayName: "Nina de Boer",
      email: "nina@northside.test",
      password: "member-pass-123",
    });
    await upsertLocalMemberPortalAccount(secondTenant.tenant.id, {
      memberId: "member_nina_atlas",
      displayName: "Nina de Boer",
      email: "nina@northside.test",
      password: "member-pass-123",
    });

    const authenticated = await authenticateLocalAccount(
      "nina@northside.test",
      "member-pass-123",
    );

    expect(authenticated?.account.roleKey).toBe("member");
    expect(authenticated?.accounts).toHaveLength(2);
    expect(authenticated?.tenants.map((tenant) => tenant.id)).toEqual([
      firstTenant.tenant.id,
      secondTenant.tenant.id,
    ]);
    expect(await listLocalMemberPortalAccountsByEmail("nina@northside.test")).toHaveLength(2);
  });

  it("keeps team accounts scoped to their own gym", async () => {
    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await createLocalPlatformAccount(tenant.tenant.id, {
      displayName: "Niels Ops",
      email: "ops@northside.test",
      password: "ops-pass-123",
      roleKey: "manager",
    });

    const northsideAccounts = await listLocalPlatformAccounts(tenant.tenant.id);

    expect(northsideAccounts).toHaveLength(2);
    expect(northsideAccounts.every((account) => account.tenantId === tenant.tenant.id)).toBe(
      true,
    );
  });

  it("creates a superadmin account anchored to the first gym and authenticates it", async () => {
    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await upsertLocalSuperadminAccount({
      displayName: "Platform Superadmin",
      email: "superadmin@gym-platform.test",
      password: "SuperAdminPass123!",
    });

    const authenticated = await authenticateLocalAccount(
      "superadmin@gym-platform.test",
      "SuperAdminPass123!",
    );

    expect(authenticated?.account).toMatchObject({
      tenantId: tenant.tenant.id,
      roleKey: "superadmin",
      email: "superadmin@gym-platform.test",
    });
  });

  it("can seed the configured superadmin account from environment variables", async () => {
    await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });
    vi.stubEnv("SUPERADMIN_NAME", "Configured Superadmin");
    vi.stubEnv("SUPERADMIN_EMAIL", "configured-superadmin@gym-platform.test");
    vi.stubEnv("SUPERADMIN_PASSWORD", "ConfiguredPass123!");

    await expect(ensureConfiguredSuperadminAccount()).resolves.toBeTruthy();
    await expect(
      authenticateLocalAccount(
        "configured-superadmin@gym-platform.test",
        "ConfiguredPass123!",
      ),
    ).resolves.toMatchObject({
      account: expect.objectContaining({
        roleKey: "superadmin",
        displayName: "Configured Superadmin",
      }),
    });
  });

  it("rejects duplicate setup and invalid team account mutations", async () => {
    await expect(
      createLocalPlatformAccount("missing", {
        displayName: "Niels Ops",
        email: "ops@northside.test",
        password: "ops-pass-123",
        roleKey: "manager",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await expect(
      bootstrapLocalPlatform({
        tenantName: "Northside Athletics",
        ownerName: "Other Owner",
        ownerEmail: "other@northside.test",
        password: "strong-pass-123",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      createLocalPlatformAccount("missing", {
        displayName: "Niels Ops",
        email: "ops@northside.test",
        password: "ops-pass-123",
        roleKey: "manager",
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    await createLocalPlatformAccount(tenant.tenant.id, {
      displayName: "Niels Ops",
      email: " Ops@Northside.Test ",
      password: "ops-pass-123",
      roleKey: "manager",
    });
    await expect(
      createLocalPlatformAccount(tenant.tenant.id, {
        displayName: "Niels Duplicate",
        email: "ops@northside.test",
        password: "ops-pass-123",
        roleKey: "manager",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("stores remote access settings per gym", async () => {
    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await updateLocalTenantRemoteAccess(tenant.tenant.id, {
      enabled: true,
      provider: "nuki",
      bridgeType: "cloud_api",
      locationId: "loc_frontdoor",
      deviceLabel: "Hoofdingang",
      externalDeviceId: "nuki-lock-01",
      notes: "Owner-only remote open",
    });

    const updatedTenant = await getLocalTenantProfile(tenant.tenant.id);

    expect(updatedTenant?.remoteAccess).toMatchObject({
      enabled: true,
      provider: "nuki",
      bridgeType: "cloud_api",
      locationId: "loc_frontdoor",
      deviceLabel: "Hoofdingang",
      externalDeviceId: "nuki-lock-01",
      notes: "Owner-only remote open",
    });
    expect(updatedTenant?.remoteAccess.lastValidatedAt).toEqual(expect.any(String));
  });

  it("rejects remote access updates before setup or for unknown gyms", async () => {
    await expect(
      updateLocalTenantRemoteAccess("missing", {
        enabled: true,
        provider: "nuki",
        bridgeType: "cloud_api",
        locationId: null,
        deviceLabel: "Hoofdingang",
        externalDeviceId: "nuki-lock-01",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await expect(
      updateLocalTenantRemoteAccess("missing", {
        enabled: true,
        provider: "nuki",
        bridgeType: "cloud_api",
        locationId: null,
        deviceLabel: "Hoofdingang",
        externalDeviceId: "nuki-lock-01",
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("stores billing settings per gym", async () => {
    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await updateLocalTenantBillingSettings(tenant.tenant.id, {
      enabled: true,
      provider: "mollie",
      profileLabel: "Northside Athletics Payments",
      profileId: "pfl_test_123456",
      settlementLabel: "Northside Club",
      supportEmail: "billing@northside.test",
      paymentMethods: ["direct_debit", "one_time", "payment_request"],
      notes: "Preview routing for launch week",
    });

    const updatedTenant = await getLocalTenantProfile(tenant.tenant.id);

    expect(updatedTenant?.billing).toMatchObject({
      enabled: true,
      provider: "mollie",
      profileLabel: "Northside Athletics Payments",
      profileId: "pfl_test_123456",
      settlementLabel: "Northside Club",
      supportEmail: "billing@northside.test",
      paymentMethods: ["direct_debit", "one_time", "payment_request"],
      notes: "Preview routing for launch week",
    });
    expect(updatedTenant?.billing.lastValidatedAt).toEqual(expect.any(String));
  });

  it("stores tenant feature flag overrides per gym", async () => {
    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await updateLocalTenantFeatureFlag(tenant.tenant.id, {
      key: "coaching.ai_max",
      value: true,
      updatedBy: "Amina Hassan",
    });
    await updateLocalTenantFeatureFlag(tenant.tenant.id, {
      key: "billing.autocollect",
      value: false,
      updatedBy: "Amina Hassan",
    });

    const updatedTenant = await getLocalTenantProfile(tenant.tenant.id);

    expect(updatedTenant?.featureFlags).toEqual([
      expect.objectContaining({
        key: "billing.autocollect",
        value: false,
        updatedBy: "Amina Hassan",
      }),
      expect.objectContaining({
        key: "coaching.ai_max",
        value: true,
        updatedBy: "Amina Hassan",
      }),
    ]);
  });

  it("stores booking, revenue, coaching, retention, mobile, marketing and integration settings per gym", async () => {
    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await updateLocalTenantBookingSettings(tenant.tenant.id, {
      oneToOneSessionName: "Performance PT",
      oneToOneDurationMinutes: 75,
      trialBookingUrl: "https://book.northside.test/trial",
      defaultCreditPackSize: 12,
      schedulingWindowDays: 21,
    });
    await updateLocalTenantRevenueSettings(tenant.tenant.id, {
      webshopCollectionName: "Northside Pro Shop",
      pointOfSaleMode: "hybrid",
      cardTerminalLabel: "Frontdesk terminal",
      autocollectPolicy: "Incasso elke eerste werkdag van de maand",
      directDebitLeadDays: 5,
    });
    await updateLocalTenantCoachingSettings(tenant.tenant.id, {
      workoutPlanFocus: "Hyrox build blocks",
      nutritionCadence: "biweekly",
      videoLibraryUrl: "https://video.northside.test/library",
      progressMetric: "PRs and consistency",
      heartRateProvider: "Myzone",
      aiCoachMode: "Premium AI copilot",
    });
    await updateLocalTenantRetentionSettings(tenant.tenant.id, {
      retentionCadence: "monthly",
      communityChannel: "Discord",
      challengeTheme: "Summer reset",
      questionnaireTrigger: "Week 2 and renewal week",
      proContentPath: "https://content.northside.test/pro",
      fitZoneOffer: "Recovery lounge",
    });
    await updateLocalTenantMobileSettings(tenant.tenant.id, {
      appDisplayName: "Northside Club App",
      onboardingHeadline: "Welkom terug bij Northside",
      supportChannel: "support@northside.test",
      primaryAccent: "#111827",
      checkInMode: "qr",
      whiteLabelDomain: "app.northside.test",
    });
    await updateLocalTenantMarketingSettings(tenant.tenant.id, {
      emailSenderName: "Northside Athletics",
      emailReplyTo: "hello@northside.test",
      promotionHeadline: "Spring intake week",
      leadPipelineLabel: "Trials -> members",
      automationCadence: "biweekly",
    });
    await updateLocalTenantIntegrationSettings(tenant.tenant.id, {
      hardwareVendors: ["Nuki", "Brivo"],
      softwareIntegrations: ["Mollie", "Mailcoach"],
      equipmentIntegrations: ["Concept2"],
      migrationProvider: "Virtuagym",
      bodyCompositionProvider: "InBody",
    });

    const updatedTenant = await getLocalTenantProfile(tenant.tenant.id);

    expect(updatedTenant?.moduleSettings.booking).toMatchObject({
      oneToOneSessionName: "Performance PT",
      defaultCreditPackSize: 12,
    });
    expect(updatedTenant?.moduleSettings.revenue).toMatchObject({
      webshopCollectionName: "Northside Pro Shop",
      pointOfSaleMode: "hybrid",
    });
    expect(updatedTenant?.moduleSettings.coaching).toMatchObject({
      workoutPlanFocus: "Hyrox build blocks",
      nutritionCadence: "biweekly",
    });
    expect(updatedTenant?.moduleSettings.retention).toMatchObject({
      communityChannel: "Discord",
      fitZoneOffer: "Recovery lounge",
    });
    expect(updatedTenant?.moduleSettings.mobile).toMatchObject({
      appDisplayName: "Northside Club App",
      checkInMode: "qr",
    });
    expect(updatedTenant?.moduleSettings.marketing).toMatchObject({
      emailSenderName: "Northside Athletics",
      automationCadence: "biweekly",
    });
    expect(updatedTenant?.moduleSettings.integrations).toMatchObject({
      hardwareVendors: ["Nuki", "Brivo"],
      bodyCompositionProvider: "InBody",
    });
  });

  it("stores lead funnels, collection cases and booking policy per gym", async () => {
    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    const lead = await createLocalTenantLead(tenant.tenant.id, {
      fullName: "Nina de Boer",
      email: "nina@northside.test",
      phone: "0611112222",
      source: "website",
      stage: "new",
      interest: "12-week transformatieprogramma",
      notes: "Komt via Instagram campagne.",
      expectedValueCents: 12900,
    });
    await updateLocalTenantLead(tenant.tenant.id, {
      id: lead.id,
      stage: "contacted",
      notes: "Intake ingepland voor vrijdag.",
      assignedStaffName: "Amina Hassan",
    });
    const collectionCase = await createLocalTenantCollectionCase(tenant.tenant.id, {
      memberName: "Lars Visser",
      paymentMethod: "direct_debit",
      status: "open",
      amountCents: 5900,
      reason: "Mislukte incasso april",
      dueAt: "2026-05-01T09:00:00.000Z",
      notes: "Volg op met nieuwe SEPA machtiging.",
    });
    await updateLocalTenantCollectionCase(tenant.tenant.id, {
      id: collectionCase.id,
      status: "retrying",
      notes: "Nieuwe poging staat ingepland.",
    });
    await updateLocalTenantBookingPolicy(tenant.tenant.id, {
      cancellationWindowHours: 12,
      lateCancelFeeCents: 1500,
      noShowFeeCents: 2500,
      maxDailyBookingsPerMember: 2,
      maxDailyWaitlistPerMember: 1,
      autoPromoteWaitlist: false,
    });

    const updatedTenant = await getLocalTenantProfile(tenant.tenant.id);

    expect(updatedTenant?.leads).toEqual([
      expect.objectContaining({
        fullName: "Nina de Boer",
        stage: "contacted",
        assignedStaffName: "Amina Hassan",
      }),
    ]);
    expect(updatedTenant?.collectionCases).toEqual([
      expect.objectContaining({
        memberName: "Lars Visser",
        status: "retrying",
      }),
    ]);
    expect(updatedTenant?.bookingPolicy).toMatchObject({
      cancellationWindowHours: 12,
      lateCancelFeeCents: 1500,
      maxDailyBookingsPerMember: 2,
      autoPromoteWaitlist: false,
    });
  });

  it("stores signup, billing, automation, appointments, community and mobile self-service records per gym", async () => {
    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    const signup = await createLocalTenantMemberSignup(tenant.tenant.id, {
      fullName: "Jade Vermeer",
      email: "jade@northside.test",
      phone: "0612345678",
      phoneCountry: "NL",
      membershipPlanId: "plan_unlimited",
      preferredLocationId: "location_east",
      paymentMethod: "direct_debit",
      contractAcceptedAt: "2026-04-25T09:00:00.000Z",
      waiverAcceptedAt: "2026-04-25T09:00:00.000Z",
    });
    await reviewLocalTenantMemberSignup(tenant.tenant.id, {
      id: signup.id,
      status: "approved",
      ownerNotes: "Goedgekeurd",
      approvedMemberId: "member_jade",
    });
    const invoice = await createLocalTenantBillingInvoice(tenant.tenant.id, {
      memberId: "member_jade",
      memberName: "Jade Vermeer",
      description: "Membership May",
      amountCents: 11900,
      dueAt: "2026-05-01T08:00:00.000Z",
      source: "membership",
    });
    await updateLocalTenantBillingInvoice(tenant.tenant.id, {
      id: invoice.id,
      status: "paid",
      retryCount: 1,
      paidAt: "2026-05-01T08:05:00.000Z",
      lastWebhookEventType: "payment.paid",
    });
    await createLocalTenantBillingRefund(tenant.tenant.id, {
      invoiceId: invoice.id,
      amountCents: 2900,
      reason: "Compensatie",
      status: "processed",
    });
    await createLocalTenantBillingWebhook(tenant.tenant.id, {
      invoiceId: invoice.id,
      eventType: "payment.paid",
      status: "processed",
      providerReference: "tr_123",
      payloadSummary: "Payment success",
    });
    await createLocalTenantBillingReconciliationRun(tenant.tenant.id, {
      note: "Daily sync",
      matchedInvoiceIds: [invoice.id],
      unmatchedInvoiceIds: [],
    });
    const task = await createLocalTenantLeadTask(tenant.tenant.id, {
      type: "nurture",
      title: "Bel Jade na proefweek",
      dueAt: "2026-04-27T09:00:00.000Z",
      leadId: "lead_1",
      source: "website",
    });
    await updateLocalTenantLeadTask(tenant.tenant.id, {
      id: task.id,
      status: "done",
      notes: "Lidmaatschap besproken",
    });
    await createLocalTenantLeadAttribution(tenant.tenant.id, {
      leadId: "lead_1",
      source: "meta_ads",
      campaignLabel: "Spring launch",
      medium: "paid_social",
    });
    const pack = await createLocalTenantAppointmentPack(tenant.tenant.id, {
      memberId: "member_jade",
      memberName: "Jade Vermeer",
      trainerId: "trainer_eva",
      title: "10x PT pack",
      totalCredits: 10,
      remainingCredits: 10,
      validUntil: "2026-12-31T00:00:00.000Z",
    });
    await createLocalTenantCoachAppointments(tenant.tenant.id, [
      {
        trainerId: "trainer_eva",
        trainerName: "Eva Trainer",
        memberId: "member_jade",
        memberName: "Jade Vermeer",
        locationId: "location_east",
        startsAt: "2026-05-05T08:00:00.000Z",
        durationMinutes: 60,
        status: "scheduled",
        recurrence: "weekly",
        seriesId: "series_1",
        creditPackId: pack.id,
      },
    ]);
    await createLocalTenantCommunityGroup(tenant.tenant.id, {
      name: "Women lifting club",
      channel: "WhatsApp",
      description: "Vrijdagavond community",
      memberIds: ["member_jade"],
    });
    await createLocalTenantChallenge(tenant.tenant.id, {
      title: "10-class streak",
      rewardLabel: "Recovery hoodie",
      startsAt: "2026-05-01T00:00:00.000Z",
      endsAt: "2026-06-01T00:00:00.000Z",
      participantMemberIds: ["member_jade"],
    });
    const questionnaire = await createLocalTenantQuestionnaire(tenant.tenant.id, {
      title: "Week 2 pulse check",
      trigger: "After week 2",
      questions: ["Hoe gaat het herstel?"],
    });
    await createLocalTenantQuestionnaireResponse(tenant.tenant.id, {
      questionnaireId: questionnaire.id,
      memberId: "member_jade",
      memberName: "Jade Vermeer",
      answers: ["Goed"],
    });
    const paymentRequest = await createLocalTenantPaymentMethodRequest(tenant.tenant.id, {
      memberId: "member_jade",
      memberName: "Jade Vermeer",
      requestedMethodLabel: "Nieuwe SEPA IBAN",
      note: "Nieuwe rekening",
    });
    await reviewLocalTenantPaymentMethodRequest(tenant.tenant.id, {
      id: paymentRequest.id,
      status: "approved",
      ownerNotes: "Verwerkt",
    });
    const pauseRequest = await createLocalTenantPauseRequest(tenant.tenant.id, {
      memberId: "member_jade",
      memberName: "Jade Vermeer",
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-30T00:00:00.000Z",
      reason: "Vakantie",
    });
    await reviewLocalTenantPauseRequest(tenant.tenant.id, {
      id: pauseRequest.id,
      status: "approved",
      ownerNotes: "Pauze bevestigd",
    });
    await createLocalTenantContractRecord(tenant.tenant.id, {
      memberId: "member_jade",
      memberName: "Jade Vermeer",
      membershipPlanId: "plan_unlimited",
      contractName: "Unlimited",
      documentLabel: "Unlimited contract",
      documentUrl: "https://contracts.northside.test/unlimited.pdf",
      status: "active",
      signedAt: "2026-04-25T09:00:00.000Z",
    });

    const updatedTenant = await getLocalTenantProfile(tenant.tenant.id);

    expect(updatedTenant?.moduleData.memberSignups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: signup.id,
          status: "approved",
          approvedMemberId: "member_jade",
        }),
      ]),
    );
    expect(updatedTenant?.moduleData.billingBackoffice.invoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: invoice.id,
          status: "paid",
          retryCount: 1,
        }),
      ]),
    );
    expect(updatedTenant?.moduleData.leadAutomation.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: task.id,
          status: "done",
        }),
      ]),
    );
    expect(updatedTenant?.moduleData.appointments.creditPacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pack.id,
        }),
      ]),
    );
    expect(updatedTenant?.moduleData.community.questionnaires).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: questionnaire.id,
          responseCount: 1,
        }),
      ]),
    );
    expect(updatedTenant?.moduleData.mobileSelfService.contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberId: "member_jade",
          contractName: "Unlimited",
        }),
      ]),
    );
  });

  it("rejects billing updates before setup or for unknown gyms", async () => {
    await expect(
      updateLocalTenantBillingSettings("missing", {
        enabled: true,
        provider: "mollie",
        profileLabel: "Northside Payments",
        profileId: "pfl_test_123",
        settlementLabel: "Northside",
        supportEmail: "billing@northside.test",
        paymentMethods: ["one_time"],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await expect(
      updateLocalTenantBillingSettings("missing", {
        enabled: true,
        provider: "mollie",
        profileLabel: "Northside Payments",
        profileId: "pfl_test_123",
        settlementLabel: "Northside",
        supportEmail: "billing@northside.test",
        paymentMethods: ["one_time"],
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("marks remote and billing actions and stores gym data changes", async () => {
    await expect(markLocalTenantRemoteAccessAction("missing", "Owner")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(markLocalTenantBillingAction("missing", "Owner")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(updateLocalPlatformData((data) => data)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await expect(
      markLocalTenantRemoteAccessAction("missing", "Owner"),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    await expect(markLocalTenantBillingAction("missing", "Owner")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });

    await markLocalTenantRemoteAccessAction(tenant.tenant.id, "Amina");
    await markLocalTenantBillingAction(tenant.tenant.id, "Amina");
    const updated = await updateLocalPlatformData((data) => ({
      ...data,
      locations: [
        {
          tenantId: tenant.tenant.id,
          id: "loc_manual",
          version: 1,
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
          name: "Manual Location",
          city: "Amsterdam",
          neighborhood: "Oost",
          capacity: 10,
          managerName: "Amina",
          amenities: [],
          status: "active",
        },
      ],
    }));

    expect(updated.tenants[0]?.remoteAccess.lastRemoteActionBy).toBe("Amina");
    expect(updated.tenants[0]?.billing.lastPaymentActionBy).toBe("Amina");
    expect(updated.data.locations).toHaveLength(1);
  });

  it("normalizes persisted state and migrates legacy single-gym state", async () => {
    const stateFile = process.env.LOCAL_PLATFORM_STATE_FILE!;
    const data = createEmptyGymStoreState();
    await writeFile(
      stateFile,
      JSON.stringify({
        version: 3,
        tenants: [
          {
            id: "legacy-gym",
            name: "Legacy Gym",
            createdAt: "2026-04-21T00:00:00.000Z",
            updatedAt: "2026-04-21T00:00:00.000Z",
          },
        ],
        accounts: [],
        data,
      }),
      "utf8",
    );

    const normalized = await readLocalPlatformState();
    const normalizedRaw = await readFile(stateFile, "utf8");

    expect(normalized?.tenants[0]?.billing.provider).toBe("mollie");
    expect(normalized?.tenants[0]?.remoteAccess.provider).toBe("nuki");
    expect(normalizedRaw).toContain("remoteAccess");

    await writeFile(
      stateFile,
      JSON.stringify({
        version: 1,
        tenant: {
          id: "single-gym",
          name: "Single Gym",
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
        accounts: [
          {
            userId: "staff_legacy",
            email: "owner@single.test",
            displayName: "Legacy Owner",
            roleKey: "owner",
            passwordHash: "invalid",
            status: "active",
            createdAt: "2026-04-21T00:00:00.000Z",
            updatedAt: "2026-04-21T00:00:00.000Z",
          },
        ],
        data,
      }),
      "utf8",
    );

    const migrated = await readLocalPlatformState();

    expect(migrated).toMatchObject({
      version: 8,
      tenants: [expect.objectContaining({ id: "single-gym" })],
      accounts: [expect.objectContaining({ tenantId: "single-gym" })],
    });
  });

  it("rejects persisted state with an unexpected version", async () => {
    await writeFile(
      process.env.LOCAL_PLATFORM_STATE_FILE!,
      JSON.stringify({
        version: 999,
        tenants: [],
        accounts: [],
        data: createEmptyGymStoreState(),
      }),
      "utf8",
    );

    await expect(readLocalPlatformState()).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});
