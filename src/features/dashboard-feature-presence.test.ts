import { describe, expect, it } from "vitest";
import {
  DASHBOARD_FEATURE_CATALOG,
} from "@/features/dashboard-feature-catalog";
import {
  buildFeaturePresenceSummary,
  getFeaturePresenceCoverageKeys,
} from "@/features/dashboard-feature-presence";
import type { GymDashboardSnapshot } from "@/server/types";

function createSnapshotFixture() {
  return {
    tenantName: "Northside Athletics",
    actorName: "Amina Hassan",
    actorEmail: "owner@northside.test",
    runtime: {
      storeMode: "mongo",
      cacheMode: "redis",
      messagingMode: "preview",
      storageMode: "spaces",
    },
    uiCapabilities: {
      canCreateBooking: true,
      canRecordAttendance: true,
      canManagePlatform: true,
      canManageStaff: true,
      canManageRemoteAccess: true,
      canManagePayments: true,
      canManageFeatureFlags: true,
    },
    remoteAccess: {
      enabled: true,
      provider: "nuki",
      providerLabel: "Nuki",
      bridgeType: "cloud_api",
      locationId: "loc_1",
      locationName: "Northside East",
      deviceLabel: "Front door",
      externalDeviceId: "nuki_123",
      connectionStatus: "configured",
      statusLabel: "Live",
      helpText: "Remote access is klaar.",
      previewMode: true,
    },
    payments: {
      enabled: true,
      provider: "mollie",
      providerLabel: "Mollie",
      profileLabel: "Northside Payments",
      profileId: "pfl_test_123",
      settlementLabel: "Northside settlement",
      supportEmail: "billing@northside.test",
      paymentMethods: ["direct_debit", "one_time", "payment_request"],
      connectionStatus: "configured",
      statusLabel: "Live",
      helpText: "Betalingen zijn gekoppeld.",
      previewMode: true,
    },
    legal: {
      termsUrl: "https://northside.test/terms",
      privacyUrl: "https://northside.test/privacy",
      sepaCreditorId: "NL00ZZZ123456780000",
      sepaMandateText: "SEPA akkoord",
      contractPdfTemplateKey: "contract-v1",
      waiverStorageKey: "waivers/northside",
      waiverRetentionMonths: 84,
      statusLabel: "Juridisch klaar",
      helpText: "Alles staat goed.",
    },
    bookingWorkspace: {
      oneToOneSessionName: "Performance PT",
      oneToOneDurationMinutes: 75,
      trialBookingUrl: "https://book.northside.test/trial",
      defaultCreditPackSize: 12,
      schedulingWindowDays: 21,
    },
    revenueWorkspace: {
      webshopCollectionName: "Northside Pro Shop",
      pointOfSaleMode: "hybrid",
      cardTerminalLabel: "Frontdesk terminal",
      autocollectPolicy: "Incasso elke eerste werkdag van de maand",
      directDebitLeadDays: 5,
    },
    coachingWorkspace: {
      workoutPlanFocus: "Engine and strength blocks",
      nutritionCadence: "biweekly",
      videoLibraryUrl: "https://video.northside.test/library",
      progressMetric: "Attendance and PRs",
      heartRateProvider: "Myzone",
      aiCoachMode: "High-touch AI copilot",
    },
    retentionWorkspace: {
      retentionCadence: "monthly",
      communityChannel: "Discord",
      challengeTheme: "Summer streak",
      questionnaireTrigger: "After week 2",
      proContentPath: "https://content.northside.test/pro",
      fitZoneOffer: "Recovery lounge",
    },
    mobileExperience: {
      appDisplayName: "Northside Club App",
      onboardingHeadline: "Welkom terug bij Northside",
      supportChannel: "support@northside.test",
      primaryAccent: "#111827",
      checkInMode: "qr",
      whiteLabelDomain: "app.northside.test",
    },
    marketingWorkspace: {
      emailSenderName: "Northside Athletics",
      emailReplyTo: "hello@northside.test",
      promotionHeadline: "Spring intake week",
      leadPipelineLabel: "Trials -> members",
      automationCadence: "biweekly",
    },
    integrationWorkspace: {
      hardwareVendors: ["Nuki", "Brivo"],
      softwareIntegrations: ["Mollie", "Mailcoach"],
      equipmentIntegrations: ["Concept2"],
      migrationProvider: "Virtuagym",
      bodyCompositionProvider: "InBody",
    },
    bookingPolicy: {
      cancellationWindowHours: 12,
      lateCancelFeeCents: 1500,
      noShowFeeCents: 2500,
      maxDailyBookingsPerMember: 2,
      maxDailyWaitlistPerMember: 1,
      autoPromoteWaitlist: true,
    },
    metrics: [
      { label: "Actieve leden", value: "8", helper: "Live", tone: "success" },
      { label: "Omzet", value: "€720", helper: "Live", tone: "info" },
    ],
    featureFlags: [],
    locations: [
      {
        id: "loc_1",
        tenantId: "northside-athletics",
        version: 1,
        createdAt: "2026-04-24T09:00:00.000Z",
        updatedAt: "2026-04-24T09:00:00.000Z",
        name: "Northside East",
        city: "Amsterdam",
        neighborhood: "Oost",
        capacity: 120,
        amenities: ["Open gym"],
        managerName: "Saar",
        status: "active",
      },
    ],
    membershipPlans: [
      {
        id: "plan_1",
        tenantId: "northside-athletics",
        version: 1,
        createdAt: "2026-04-24T09:00:00.000Z",
        updatedAt: "2026-04-24T09:00:00.000Z",
        name: "Unlimited",
        priceMonthly: 89,
        currency: "EUR",
        billingCycle: "monthly",
        perks: ["Open gym"],
        activeMembers: 8,
        status: "active",
      },
    ],
    members: [
      {
        id: "member_1",
        tenantId: "northside-athletics",
        version: 1,
        createdAt: "2026-04-24T09:00:00.000Z",
        updatedAt: "2026-04-24T09:00:00.000Z",
        fullName: "Noa van Dijk",
        email: "noa@northside.test",
        phone: "0612345678",
        phoneCountry: "NL",
        membershipPlanId: "plan_1",
        homeLocationId: "loc_1",
        joinedAt: "2026-04-01T09:00:00.000Z",
        nextRenewalAt: "2026-05-01T09:00:00.000Z",
        status: "active",
        tags: ["hyrox"],
        waiverStatus: "pending",
      },
    ],
    memberPortalAccessMemberIds: ["member_1"],
    trainers: [
      {
        id: "trainer_1",
        tenantId: "northside-athletics",
        version: 1,
        createdAt: "2026-04-24T09:00:00.000Z",
        updatedAt: "2026-04-24T09:00:00.000Z",
        fullName: "Romy de Wit",
        specialties: ["conditioning"],
        certifications: ["CrossFit L2"],
        homeLocationId: "loc_1",
        classIds: ["class_1"],
        status: "active",
      },
    ],
    classSessions: [
      {
        id: "class_1",
        tenantId: "northside-athletics",
        version: 1,
        createdAt: "2026-04-24T09:00:00.000Z",
        updatedAt: "2026-04-24T09:00:00.000Z",
        title: "Forge HIIT",
        locationId: "loc_1",
        trainerId: "trainer_1",
        startsAt: "2026-04-24T18:30:00.000Z",
        durationMinutes: 60,
        capacity: 16,
        bookedCount: 8,
        waitlistCount: 1,
        level: "mixed",
        focus: "engine",
        status: "active",
      },
    ],
    bookings: [
      {
        id: "booking_1",
        tenantId: "northside-athletics",
        version: 1,
        createdAt: "2026-04-24T09:00:00.000Z",
        updatedAt: "2026-04-24T09:00:00.000Z",
        classSessionId: "class_1",
        memberId: "member_1",
        memberName: "Noa van Dijk",
        phone: "0612345678",
        phoneCountry: "NL",
        status: "confirmed",
        source: "member_app",
        idempotencyKey: "booking-key",
      },
      {
        id: "booking_2",
        tenantId: "northside-athletics",
        version: 1,
        createdAt: "2026-04-24T09:10:00.000Z",
        updatedAt: "2026-04-24T09:10:00.000Z",
        classSessionId: "class_1",
        memberId: "member_1",
        memberName: "Noa van Dijk",
        phone: "0612345678",
        phoneCountry: "NL",
        status: "waitlisted",
        source: "frontdesk",
        idempotencyKey: "booking-key-2",
      },
    ],
    attendance: [
      {
        id: "attendance_1",
        tenantId: "northside-athletics",
        version: 1,
        createdAt: "2026-04-24T18:35:00.000Z",
        updatedAt: "2026-04-24T18:35:00.000Z",
        classSessionId: "class_1",
        bookingId: "booking_1",
        memberId: "member_1",
        checkedInAt: "2026-04-24T18:35:00.000Z",
        channel: "qr",
      },
    ],
    waivers: [
      {
        id: "waiver_1",
        tenantId: "northside-athletics",
        version: 1,
        createdAt: "2026-04-24T09:00:00.000Z",
        updatedAt: "2026-04-24T09:00:00.000Z",
        memberId: "member_1",
        memberName: "Noa van Dijk",
        status: "requested",
      },
    ],
    leads: [
      {
        id: "lead_1",
        tenantId: "northside-athletics",
        fullName: "Lara Smit",
        email: "lara@northside.test",
        phone: "0612345678",
        source: "website",
        stage: "contacted",
        interest: "Hyrox starter pack",
        createdAt: "2026-04-24T09:00:00.000Z",
        updatedAt: "2026-04-24T09:30:00.000Z",
      },
    ],
    collectionCases: [
      {
        id: "collection_1",
        tenantId: "northside-athletics",
        memberName: "Noa van Dijk",
        paymentMethod: "direct_debit",
        status: "open",
        amountCents: 1750,
        reason: "Late cancellation fee",
        dueAt: "2026-04-25T09:00:00.000Z",
        createdAt: "2026-04-24T09:00:00.000Z",
        updatedAt: "2026-04-24T09:30:00.000Z",
      },
    ],
    staff: [
      {
        id: "staff_1",
        displayName: "Amina Hassan",
        email: "owner@northside.test",
        status: "active",
        roles: ["Owner"],
        roleKey: "owner",
        updatedAt: "2026-04-24T09:00:00.000Z",
      },
    ],
    auditEntries: [
      {
        eventId: "audit_1",
        actorId: "owner_1",
        tenantId: "northside-athletics",
        occurredAt: "2026-04-24T10:00:00.000Z",
        action: "booking.created",
        category: "bookings",
        metadata: {},
      },
    ],
    healthReport: {
      status: "healthy",
      checks: [
        {
          name: "Billing",
          status: "healthy",
          summary: "Mollie gekoppeld",
        },
      ],
    },
    projectedRevenueLabel: "EUR 712",
    notificationPreview: "Hoi Noa, je plek staat klaar.",
    waiverUploadPath: "waivers/northside/signed.pdf",
    supportedLanguages: ["nl-NL", "en-GB"],
  } as unknown as GymDashboardSnapshot;
}

describe("dashboard feature presence", () => {
  it("covers every feature key from the product matrix", () => {
    expect(getFeaturePresenceCoverageKeys()).toEqual(
      [...DASHBOARD_FEATURE_CATALOG.map((feature) => feature.key)].sort(),
    );
  });

  it("builds a non-empty operational summary for every feature", () => {
    const snapshot = createSnapshotFixture();

    expect(
      DASHBOARD_FEATURE_CATALOG.map((feature) => buildFeaturePresenceSummary(feature, snapshot)),
    ).toSatisfy((summaries: string[]) => summaries.every((summary: string) => summary.length > 20));
  });

  it("uses live tenant data inside representative feature summaries", () => {
    const snapshot = createSnapshotFixture();

    expect(
      buildFeaturePresenceSummary({ key: "booking.one_to_one" }, snapshot),
    ).toContain("Performance PT");
    expect(
      buildFeaturePresenceSummary({ key: "billing.autocollect" }, snapshot),
    ).toContain("Incasso elke eerste werkdag van de maand");
    expect(
      buildFeaturePresenceSummary({ key: "mobile.checkin" }, snapshot),
    ).toContain("QR only");
    expect(
      buildFeaturePresenceSummary({ key: "integrations.virtuagym_connect" }, snapshot),
    ).toContain("Virtuagym");
  });
});
