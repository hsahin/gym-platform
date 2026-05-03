import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError, createPrefixedIdGenerator } from "@claimtech/core";
import {
  MongoDatabaseClient,
  createMongoClient,
  type GlobalCollection,
} from "@claimtech/database";
import { toTenantId, type TenantId } from "@claimtech/tenant";
import {
  createDefaultBillingSettings,
  normalizeStoredBillingSettings,
  type StoredBillingSettings,
} from "@/lib/billing";
import {
  createDefaultRemoteAccessSettings,
  getRemoteAccessConnectionStatus,
  normalizeStoredRemoteAccessSettings,
  type StoredRemoteAccessSettings,
} from "@/lib/remote-access";
import type {
  AccountRoleKey,
  PlatformRoleKey,
} from "@/server/runtime/platform-roles";
import {
  allowsRuntimeFallbacks,
  assertProductionEnvironmentReady,
} from "@/server/runtime/production-readiness";
import type {
  AppointmentRecurrence,
  AppointmentSummary,
  AppointmentStatus,
  BillingPaymentMethod,
  BillingProvider,
  BillingBackofficeSummary,
  BillingInvoiceSource,
  BillingInvoiceStatus,
  BillingReconciliationStatus,
  BillingRefundStatus,
  BillingWebhookEventStatus,
  BookingPolicySummary,
  BookingWorkspaceSummary,
  CoachingWorkspaceSummary,
  CollectionCase,
  CollectionCasePaymentMethod,
  CollectionCaseStatus,
  CommunityGroupStatus,
  CommunitySummary,
  ChallengeStatus,
  LeadAutomationSummary,
  LeadAutomationTrigger,
  LeadFollowUpTask,
  LeadTaskStatus,
  LeadTaskType,
  MemberContractRecord,
  GymLead,
  IntegrationWorkspaceSummary,
  LegalComplianceSummary,
  LeadSource,
  LeadStage,
  MarketingWorkspaceSummary,
  MemberSignupRequest,
  MemberSignupStatus,
  MobileSelfServiceSummary,
  MobileExperienceSummary,
  QuestionnaireStatus,
  RemoteAccessBridgeType,
  RemoteAccessProvider,
  ReviewRequestStatus,
  RevenueWorkspaceSummary,
  RetentionWorkspaceSummary,
} from "@/server/types";
import {
  createEmptyGymStoreState,
  type MemoryGymStoreState,
} from "@/server/persistence/memory-gym-store";

const stateVersion = 8;
const accountIdGenerator = createPrefixedIdGenerator({ prefix: "staff" });
const memberAccountIdGenerator = createPrefixedIdGenerator({ prefix: "member" });
const leadIdGenerator = createPrefixedIdGenerator({ prefix: "lead" });
const collectionCaseIdGenerator = createPrefixedIdGenerator({ prefix: "collection" });
const signupIdGenerator = createPrefixedIdGenerator({ prefix: "signup" });
const invoiceIdGenerator = createPrefixedIdGenerator({ prefix: "invoice" });
const refundIdGenerator = createPrefixedIdGenerator({ prefix: "refund" });
const webhookIdGenerator = createPrefixedIdGenerator({ prefix: "webhook" });
const reconciliationIdGenerator = createPrefixedIdGenerator({ prefix: "reconcile" });
const leadTaskIdGenerator = createPrefixedIdGenerator({ prefix: "leadtask" });
const attributionIdGenerator = createPrefixedIdGenerator({ prefix: "attrib" });
const leadRunIdGenerator = createPrefixedIdGenerator({ prefix: "leadrun" });
const appointmentPackIdGenerator = createPrefixedIdGenerator({ prefix: "pack" });
const coachAppointmentIdGenerator = createPrefixedIdGenerator({ prefix: "appointment" });
const communityGroupIdGenerator = createPrefixedIdGenerator({ prefix: "community" });
const challengeIdGenerator = createPrefixedIdGenerator({ prefix: "challenge" });
const questionnaireIdGenerator = createPrefixedIdGenerator({ prefix: "questionnaire" });
const questionnaireResponseIdGenerator = createPrefixedIdGenerator({ prefix: "qresponse" });
const paymentMethodRequestIdGenerator = createPrefixedIdGenerator({ prefix: "pmrequest" });
const pauseRequestIdGenerator = createPrefixedIdGenerator({ prefix: "pause" });
const contractRecordIdGenerator = createPrefixedIdGenerator({ prefix: "contractrec" });
const mongoPlatformStateCollection = "platform_state";
const mongoPlatformStateDocumentId = "gym-platform-state";
const productName = "gym-platform";

let mutationQueue = Promise.resolve();
let mongoStateCollectionPromise:
  | Promise<GlobalCollection<MongoLocalPlatformStateDocument> | null>
  | null = null;

export interface LocalTenantProfile {
  readonly id: TenantId;
  readonly name: string;
  readonly billing: StoredBillingSettings;
  readonly bookingPolicy: StoredBookingPolicySettings;
  readonly collectionCases: ReadonlyArray<CollectionCase>;
  readonly featureFlags: ReadonlyArray<StoredTenantFeatureFlagOverride>;
  readonly legal: StoredLegalComplianceSettings;
  readonly leads: ReadonlyArray<GymLead>;
  readonly moduleData: StoredTenantModuleData;
  readonly moduleSettings: StoredTenantModuleSettings;
  readonly remoteAccess: StoredRemoteAccessSettings;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LocalPlatformAccount {
  readonly userId: string;
  readonly tenantId: TenantId;
  readonly email: string;
  readonly displayName: string;
  readonly roleKey: AccountRoleKey;
  readonly linkedMemberId?: string;
  readonly passwordHash: string;
  readonly status: "active" | "archived";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LocalPlatformState {
  readonly version: number;
  readonly tenants: ReadonlyArray<LocalTenantProfile>;
  readonly accounts: ReadonlyArray<LocalPlatformAccount>;
  readonly data: MemoryGymStoreState;
}

export interface LocalTenantBootstrapResult {
  readonly tenant: LocalTenantProfile;
  readonly accounts: ReadonlyArray<LocalPlatformAccount>;
  readonly data: MemoryGymStoreState;
}

export interface AuthenticatedLocalAccount {
  readonly account: LocalPlatformAccount;
  readonly tenant: LocalTenantProfile;
  readonly accounts: ReadonlyArray<LocalPlatformAccount>;
  readonly tenants: ReadonlyArray<LocalTenantProfile>;
}

export interface BootstrapPlatformInput {
  readonly tenantName: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly password: string;
}

export interface CreatePlatformAccountInput {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly roleKey: PlatformRoleKey;
}

export interface UpsertSuperadminAccountInput {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly tenantId?: string;
}

export interface UpdatePlatformAccountInput {
  readonly userId: string;
  readonly expectedUpdatedAt: string;
  readonly displayName: string;
  readonly email: string;
  readonly roleKey: PlatformRoleKey;
  readonly status: "active" | "archived";
}

export interface UpsertMemberPortalAccountInput {
  readonly memberId: string;
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
}

export interface UpdateLocalTenantRemoteAccessInput {
  readonly enabled: boolean;
  readonly provider: RemoteAccessProvider;
  readonly bridgeType: RemoteAccessBridgeType;
  readonly locationId: string | null;
  readonly deviceLabel: string;
  readonly externalDeviceId: string;
  readonly notes?: string;
  readonly allowedRoleKeys?: ReadonlyArray<PlatformRoleKey>;
}

export interface UpdateLocalTenantBillingSettingsInput {
  readonly enabled: boolean;
  readonly provider: BillingProvider;
  readonly profileLabel: string;
  readonly profileId: string;
  readonly settlementLabel: string;
  readonly supportEmail: string;
  readonly paymentMethods: ReadonlyArray<BillingPaymentMethod>;
  readonly notes?: string;
  readonly mollieConnect?: StoredBillingSettings["mollieConnect"];
}

export interface StoredTenantFeatureFlagOverride {
  readonly key: string;
  readonly value: boolean;
  readonly updatedAt: string;
  readonly updatedBy?: string;
}

export interface UpdateLocalTenantFeatureFlagInput {
  readonly key: string;
  readonly value: boolean;
  readonly updatedBy?: string;
}

export type StoredBookingPolicySettings = BookingPolicySummary;

export type UpdateLocalTenantBookingPolicyInput = Omit<
  StoredBookingPolicySettings,
  "lastUpdatedAt"
>;

export interface CreateLocalTenantLeadInput {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly source: LeadSource;
  readonly stage: LeadStage;
  readonly interest: string;
  readonly notes?: string;
  readonly assignedStaffName?: string;
  readonly expectedValueCents?: number;
}

export interface UpdateLocalTenantLeadInput {
  readonly id: string;
  readonly stage: LeadStage;
  readonly notes?: string;
  readonly assignedStaffName?: string;
  readonly convertedMemberId?: string;
}

export interface CreateLocalTenantCollectionCaseInput {
  readonly memberId?: string;
  readonly memberName: string;
  readonly paymentMethod: CollectionCasePaymentMethod;
  readonly status: CollectionCaseStatus;
  readonly amountCents: number;
  readonly reason: string;
  readonly dueAt: string;
  readonly notes?: string;
}

export interface UpdateLocalTenantCollectionCaseInput {
  readonly id: string;
  readonly status: CollectionCaseStatus;
  readonly notes?: string;
}

export interface CreateLocalTenantMemberSignupInput {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly phoneCountry: MemberSignupRequest["phoneCountry"];
  readonly membershipPlanId: string;
  readonly preferredLocationId: string;
  readonly paymentMethod: MemberSignupRequest["paymentMethod"];
  readonly contractAcceptedAt: string;
  readonly waiverAcceptedAt: string;
  readonly notes?: string;
}

export interface ReviewLocalTenantMemberSignupInput {
  readonly id: string;
  readonly status: Exclude<MemberSignupStatus, "pending_review">;
  readonly ownerNotes?: string;
  readonly approvedMemberId?: string;
}

export interface CreateLocalTenantBillingInvoiceInput {
  readonly memberId?: string;
  readonly memberName: string;
  readonly description: string;
  readonly amountCents: number;
  readonly currency?: string;
  readonly dueAt: string;
  readonly source: BillingInvoiceSource;
  readonly externalReference?: string;
}

export interface UpdateLocalTenantBillingInvoiceInput {
  readonly id: string;
  readonly status: BillingInvoiceStatus;
  readonly retryCount?: number;
  readonly paidAt?: string;
  readonly refundedAt?: string;
  readonly lastWebhookEventType?: string;
  readonly externalReference?: string;
}

export interface CreateLocalTenantBillingRefundInput {
  readonly invoiceId: string;
  readonly amountCents: number;
  readonly reason: string;
  readonly status: BillingRefundStatus;
}

export interface CreateLocalTenantBillingWebhookInput {
  readonly invoiceId: string;
  readonly eventType: string;
  readonly status: BillingWebhookEventStatus;
  readonly providerReference: string;
  readonly payloadSummary: string;
}

export interface CreateLocalTenantBillingReconciliationRunInput {
  readonly note?: string;
  readonly matchedInvoiceIds: ReadonlyArray<string>;
  readonly unmatchedInvoiceIds: ReadonlyArray<string>;
}

export interface CreateLocalTenantLeadTaskInput {
  readonly type: LeadTaskType;
  readonly title: string;
  readonly dueAt: string;
  readonly source: LeadFollowUpTask["source"];
  readonly leadId?: string;
  readonly memberId?: string;
  readonly bookingId?: string;
  readonly notes?: string;
  readonly assignedStaffName?: string;
}

export interface UpdateLocalTenantLeadTaskInput {
  readonly id: string;
  readonly status: LeadTaskStatus;
  readonly notes?: string;
}

export interface CreateLocalTenantLeadAttributionInput {
  readonly leadId?: string;
  readonly source: LeadSource;
  readonly campaignLabel: string;
  readonly medium: string;
}

export interface CreateLocalTenantLeadAutomationRunInput {
  readonly trigger: LeadAutomationTrigger;
  readonly createdTasks: number;
}

export interface CreateLocalTenantAppointmentPackInput {
  readonly memberId: string;
  readonly memberName: string;
  readonly trainerId: string;
  readonly title: string;
  readonly totalCredits: number;
  readonly remainingCredits: number;
  readonly validUntil: string;
}

export interface UpdateLocalTenantAppointmentPackInput {
  readonly id: string;
  readonly remainingCredits: number;
}

export interface CreateLocalTenantCoachAppointmentInput {
  readonly trainerId: string;
  readonly trainerName: string;
  readonly memberId?: string;
  readonly memberName?: string;
  readonly locationId: string;
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly status: AppointmentStatus;
  readonly recurrence: AppointmentRecurrence;
  readonly seriesId?: string;
  readonly creditPackId?: string;
  readonly notes?: string;
}

export interface CreateLocalTenantCommunityGroupInput {
  readonly name: string;
  readonly channel: string;
  readonly description: string;
  readonly memberIds: ReadonlyArray<string>;
}

export interface CreateLocalTenantChallengeInput {
  readonly title: string;
  readonly rewardLabel: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly participantMemberIds: ReadonlyArray<string>;
}

export interface CreateLocalTenantQuestionnaireInput {
  readonly title: string;
  readonly trigger: string;
  readonly questions: ReadonlyArray<string>;
}

export interface CreateLocalTenantQuestionnaireResponseInput {
  readonly questionnaireId: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly answers: ReadonlyArray<string>;
}

export interface CreateLocalTenantPaymentMethodRequestInput {
  readonly memberId: string;
  readonly memberName: string;
  readonly requestedMethodLabel: string;
  readonly note?: string;
}

export interface ReviewLocalTenantPaymentMethodRequestInput {
  readonly id: string;
  readonly status: Exclude<ReviewRequestStatus, "pending">;
  readonly ownerNotes?: string;
}

export interface CreateLocalTenantPauseRequestInput {
  readonly memberId: string;
  readonly memberName: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string;
}

export interface ReviewLocalTenantPauseRequestInput {
  readonly id: string;
  readonly status: Exclude<ReviewRequestStatus, "pending">;
  readonly ownerNotes?: string;
}

export interface CreateLocalTenantContractRecordInput {
  readonly memberId: string;
  readonly memberName: string;
  readonly membershipPlanId: string;
  readonly contractName: string;
  readonly documentLabel: string;
  readonly documentUrl: string;
  readonly status: MemberContractRecord["status"];
  readonly signedAt: string;
}

export type StoredLegalComplianceSettings = Pick<
  LegalComplianceSummary,
  | "termsUrl"
  | "privacyUrl"
  | "sepaCreditorId"
  | "sepaMandateText"
  | "contractPdfTemplateKey"
  | "waiverStorageKey"
  | "waiverRetentionMonths"
  | "lastValidatedAt"
>;

export type UpdateLocalTenantLegalSettingsInput = Omit<
  StoredLegalComplianceSettings,
  "lastValidatedAt"
>;

export type StoredCoachingWorkspaceSettings = CoachingWorkspaceSummary;

export type UpdateLocalTenantCoachingSettingsInput = Omit<
  StoredCoachingWorkspaceSettings,
  "lastUpdatedAt"
>;

export type StoredBookingWorkspaceSettings = BookingWorkspaceSummary;

export type UpdateLocalTenantBookingSettingsInput = Omit<
  StoredBookingWorkspaceSettings,
  "lastUpdatedAt"
>;

export type StoredRevenueWorkspaceSettings = RevenueWorkspaceSummary;

export type UpdateLocalTenantRevenueSettingsInput = Omit<
  StoredRevenueWorkspaceSettings,
  "lastUpdatedAt"
>;

export type StoredRetentionWorkspaceSettings = RetentionWorkspaceSummary;

export type UpdateLocalTenantRetentionSettingsInput = Omit<
  StoredRetentionWorkspaceSettings,
  "lastUpdatedAt"
>;

export type StoredMobileExperienceSettings = MobileExperienceSummary;

export type UpdateLocalTenantMobileSettingsInput = Omit<
  StoredMobileExperienceSettings,
  "lastUpdatedAt"
>;

export type StoredMarketingWorkspaceSettings = MarketingWorkspaceSummary;

export type UpdateLocalTenantMarketingSettingsInput = Omit<
  StoredMarketingWorkspaceSettings,
  "lastUpdatedAt"
>;

export type StoredIntegrationWorkspaceSettings = IntegrationWorkspaceSummary;

export type UpdateLocalTenantIntegrationSettingsInput = Omit<
  StoredIntegrationWorkspaceSettings,
  "lastUpdatedAt"
>;

export interface StoredTenantModuleSettings {
  readonly booking: StoredBookingWorkspaceSettings;
  readonly revenue: StoredRevenueWorkspaceSettings;
  readonly coaching: StoredCoachingWorkspaceSettings;
  readonly retention: StoredRetentionWorkspaceSettings;
  readonly mobile: StoredMobileExperienceSettings;
  readonly marketing: StoredMarketingWorkspaceSettings;
  readonly integrations: StoredIntegrationWorkspaceSettings;
}

export type StoredBillingBackofficeData = BillingBackofficeSummary;

export type StoredLeadAutomationData = LeadAutomationSummary;

export type StoredAppointmentData = AppointmentSummary;

export type StoredCommunityData = CommunitySummary;

export type StoredMobileSelfServiceData = MobileSelfServiceSummary;

export interface StoredTenantModuleData {
  readonly memberSignups: ReadonlyArray<MemberSignupRequest>;
  readonly billingBackoffice: StoredBillingBackofficeData;
  readonly leadAutomation: StoredLeadAutomationData;
  readonly appointments: StoredAppointmentData;
  readonly community: StoredCommunityData;
  readonly mobileSelfService: StoredMobileSelfServiceData;
}

type LegacyLocalPlatformState = {
  readonly version: 1;
  readonly tenant: Omit<
    LocalTenantProfile,
    | "remoteAccess"
    | "billing"
    | "bookingPolicy"
    | "collectionCases"
    | "featureFlags"
    | "legal"
    | "leads"
    | "moduleData"
    | "moduleSettings"
  >;
  readonly accounts: ReadonlyArray<
    Omit<LocalPlatformAccount, "tenantId" | "linkedMemberId">
  >;
  readonly data: MemoryGymStoreState;
};

type LegacyVersion2LocalPlatformState = Omit<PersistedLocalPlatformState, "version"> & {
  readonly version: number;
};

type PersistedLocalTenantProfile = Omit<
  LocalTenantProfile,
  | "remoteAccess"
  | "billing"
  | "bookingPolicy"
  | "legal"
  | "moduleSettings"
  | "moduleData"
> & {
  readonly billing?: Partial<StoredBillingSettings>;
  readonly bookingPolicy?: Partial<StoredBookingPolicySettings>;
  readonly collectionCases?: ReadonlyArray<CollectionCase>;
  readonly featureFlags?: ReadonlyArray<StoredTenantFeatureFlagOverride>;
  readonly legal?: Partial<StoredLegalComplianceSettings>;
  readonly leads?: ReadonlyArray<GymLead>;
  readonly moduleData?: Partial<StoredTenantModuleData>;
  readonly moduleSettings?: {
    readonly booking?: Partial<StoredBookingWorkspaceSettings>;
    readonly revenue?: Partial<StoredRevenueWorkspaceSettings>;
    readonly coaching?: Partial<StoredCoachingWorkspaceSettings>;
    readonly retention?: Partial<StoredRetentionWorkspaceSettings>;
    readonly mobile?: Partial<StoredMobileExperienceSettings>;
    readonly marketing?: Partial<StoredMarketingWorkspaceSettings>;
    readonly integrations?: Partial<StoredIntegrationWorkspaceSettings>;
  };
  readonly remoteAccess?: Partial<StoredRemoteAccessSettings>;
};

type PersistedLocalPlatformState = Omit<LocalPlatformState, "tenants"> & {
  readonly tenants: ReadonlyArray<PersistedLocalTenantProfile>;
};

type MongoLocalPlatformStateDocument = PersistedLocalPlatformState & {
  readonly id: string;
};

function getStateFilePath() {
  return (
    process.env.LOCAL_PLATFORM_STATE_FILE ||
    path.join(process.cwd(), ".data", "gym-platform-state.json")
  );
}

function shouldUseFileFallback() {
  return allowsRuntimeFallbacks() && !process.env.MONGODB_URI;
}

async function resolveMongoStateCollection() {
  if (shouldUseFileFallback()) {
    return null;
  }

  if (!mongoStateCollectionPromise) {
    mongoStateCollectionPromise = (async () => {
      assertProductionEnvironmentReady();

      if (!process.env.MONGODB_URI) {
        throw new AppError(
          "MONGODB_URI is verplicht. De app gebruikt geen lokale platformstate meer.",
          {
            code: "INVALID_INPUT",
          },
        );
      }

      const client = createMongoClient({
        uri: process.env.MONGODB_URI,
        appName: productName,
      });
      await client.connect();

      const dbName = process.env.MONGODB_DB_NAME ?? productName;
      const databaseClient = new MongoDatabaseClient(client.db(dbName));

      return databaseClient
        .global()
        .collection<MongoLocalPlatformStateDocument>(mongoPlatformStateCollection);
    })();
  }

  return mongoStateCollectionPromise;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isMemberAccount(account: Pick<LocalPlatformAccount, "roleKey">) {
  return account.roleKey === "member";
}

function isSuperadminAccount(account: Pick<LocalPlatformAccount, "roleKey">) {
  return account.roleKey === "superadmin";
}

function assertUniqueTenantEmail(
  accounts: ReadonlyArray<LocalPlatformAccount>,
  tenantId: TenantId,
  normalizedEmail: string,
  excludeUserId?: string,
) {
  const conflict = accounts.some(
    (account) =>
      account.tenantId === tenantId &&
      account.userId !== excludeUserId &&
      normalizeEmail(account.email) === normalizedEmail,
  );

  if (conflict) {
    throw new AppError("Er bestaat al een account met dit e-mailadres binnen deze gym.", {
      code: "INVALID_INPUT",
      details: { email: normalizedEmail, tenantId },
    });
  }
}

function assertUniquePlatformEmail(
  accounts: ReadonlyArray<LocalPlatformAccount>,
  normalizedEmail: string,
  excludeUserId?: string,
) {
  const conflict = accounts.some(
    (account) =>
      account.userId !== excludeUserId &&
      normalizeEmail(account.email) === normalizedEmail,
  );

  if (conflict) {
    throw new AppError("Er bestaat al een platformaccount met dit e-mailadres.", {
      code: "INVALID_INPUT",
      details: { email: normalizedEmail },
    });
  }
}

function requireTenantForMutation(
  current: LocalPlatformState | null,
  tenantId: string,
  setupMessage: string,
  notFoundMessage: string,
) {
  if (!current || current.tenants.length === 0) {
    throw new AppError(setupMessage, {
      code: "FORBIDDEN",
    });
  }

  const tenant = current.tenants.find((entry) => entry.id === tenantId);

  if (!tenant) {
    throw new AppError(notFoundMessage, {
      code: "RESOURCE_NOT_FOUND",
      details: { tenantId },
    });
  }

  return tenant;
}

export function slugifyTenantName(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "gym-platform";
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const storedBuffer = Buffer.from(storedHash, "hex");
  const derivedBuffer = scryptSync(password, salt, storedBuffer.length);

  return timingSafeEqual(storedBuffer, derivedBuffer);
}

function createEmptyState(): LocalPlatformState {
  return {
    version: stateVersion,
    tenants: [],
    accounts: [],
    data: createEmptyGymStoreState(),
  };
}

function createDefaultLegalComplianceSettings(): StoredLegalComplianceSettings {
  return {
    termsUrl: "",
    privacyUrl: "",
    sepaCreditorId: "",
    sepaMandateText:
      "Ik machtig de sportschool om terugkerende lidmaatschapsbetalingen via SEPA incasso te innen volgens mijn contract.",
    contractPdfTemplateKey: "",
    waiverStorageKey: "",
    waiverRetentionMonths: 84,
  };
}

function createDefaultBookingPolicySettings(): StoredBookingPolicySettings {
  return {
    cancellationWindowHours: 12,
    lateCancelFeeCents: 1500,
    noShowFeeCents: 2500,
    maxDailyBookingsPerMember: 3,
    maxDailyWaitlistPerMember: 2,
    autoPromoteWaitlist: true,
  };
}

function createDefaultBookingWorkspaceSettings(): StoredBookingWorkspaceSettings {
  return {
    oneToOneSessionName: "PT intake",
    oneToOneDurationMinutes: 60,
    trialBookingUrl: "",
    defaultCreditPackSize: 10,
    schedulingWindowDays: 14,
  };
}

function createDefaultRevenueWorkspaceSettings(): StoredRevenueWorkspaceSettings {
  return {
    webshopCollectionName: "Club essentials",
    pointOfSaleMode: "frontdesk",
    cardTerminalLabel: "Frontdesk terminal",
    autocollectPolicy: "Incasso op de eerste werkdag van de maand",
    directDebitLeadDays: 5,
  };
}

function createDefaultCoachingWorkspaceSettings(): StoredCoachingWorkspaceSettings {
  return {
    workoutPlanFocus: "Strength and conditioning blocks",
    nutritionCadence: "weekly",
    videoLibraryUrl: "",
    progressMetric: "Attendance and PR milestones",
    heartRateProvider: "Polar / Myzone",
    aiCoachMode: "Premium coach copilot",
  };
}

function createDefaultRetentionWorkspaceSettings(): StoredRetentionWorkspaceSettings {
  return {
    retentionCadence: "weekly",
    communityChannel: "WhatsApp community",
    challengeTheme: "8-week consistency streak",
    questionnaireTrigger: "After trial and after 30 days",
    proContentPath: "",
    fitZoneOffer: "Recovery and lifestyle corner",
  };
}

function createDefaultMobileExperienceSettings(): StoredMobileExperienceSettings {
  return {
    appDisplayName: "GymOS Member App",
    onboardingHeadline: "Welcome back to your club",
    supportChannel: "support@gym.test",
    primaryAccent: "#F97316",
    checkInMode: "hybrid",
    whiteLabelDomain: "",
  };
}

function createDefaultMarketingWorkspaceSettings(): StoredMarketingWorkspaceSettings {
  return {
    emailSenderName: "Gym team",
    emailReplyTo: "hello@gym.test",
    promotionHeadline: "Nieuwe proefweek live",
    leadPipelineLabel: "Trials naar members",
    automationCadence: "weekly",
  };
}

function normalizeStringArray(input?: ReadonlyArray<string>) {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const entry of input ?? []) {
    const value = entry.trim();

    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    values.push(value);
  }

  return values;
}

function createDefaultIntegrationWorkspaceSettings(): StoredIntegrationWorkspaceSettings {
  return {
    hardwareVendors: ["Nuki", "QR scanners"],
    softwareIntegrations: ["Mollie", "WhatsApp"],
    equipmentIntegrations: [],
    migrationProvider: "Virtuagym / CSV import",
    bodyCompositionProvider: "",
  };
}

function createDefaultBillingBackofficeData(): StoredBillingBackofficeData {
  return {
    invoices: [],
    refunds: [],
    webhooks: [],
    reconciliationRuns: [],
  };
}

function createDefaultLeadAutomationData(): StoredLeadAutomationData {
  return {
    tasks: [],
    attributions: [],
    runs: [],
  };
}

function createDefaultAppointmentData(): StoredAppointmentData {
  return {
    creditPacks: [],
    sessions: [],
  };
}

function createDefaultCommunityData(): StoredCommunityData {
  return {
    groups: [],
    challenges: [],
    questionnaires: [],
    responses: [],
  };
}

function createDefaultMobileSelfServiceData(): StoredMobileSelfServiceData {
  return {
    receipts: [],
    paymentMethodRequests: [],
    pauseRequests: [],
    contracts: [],
  };
}

function createDefaultTenantModuleData(): StoredTenantModuleData {
  return {
    memberSignups: [],
    billingBackoffice: createDefaultBillingBackofficeData(),
    leadAutomation: createDefaultLeadAutomationData(),
    appointments: createDefaultAppointmentData(),
    community: createDefaultCommunityData(),
    mobileSelfService: createDefaultMobileSelfServiceData(),
  };
}

function normalizeBookingPolicySettings(
  input?: Partial<StoredBookingPolicySettings>,
): StoredBookingPolicySettings {
  const base = createDefaultBookingPolicySettings();

  return {
    ...base,
    ...input,
    cancellationWindowHours: Math.max(
      0,
      Number(input?.cancellationWindowHours ?? base.cancellationWindowHours),
    ),
    lateCancelFeeCents: Math.max(0, Number(input?.lateCancelFeeCents ?? base.lateCancelFeeCents)),
    noShowFeeCents: Math.max(0, Number(input?.noShowFeeCents ?? base.noShowFeeCents)),
    maxDailyBookingsPerMember: Math.max(
      1,
      Number(input?.maxDailyBookingsPerMember ?? base.maxDailyBookingsPerMember),
    ),
    maxDailyWaitlistPerMember: Math.max(
      1,
      Number(input?.maxDailyWaitlistPerMember ?? base.maxDailyWaitlistPerMember),
    ),
    autoPromoteWaitlist: input?.autoPromoteWaitlist ?? base.autoPromoteWaitlist,
  };
}

function normalizeBookingWorkspaceSettings(
  input?: Partial<StoredBookingWorkspaceSettings>,
): StoredBookingWorkspaceSettings {
  const base = createDefaultBookingWorkspaceSettings();

  return {
    ...base,
    ...input,
    oneToOneSessionName: input?.oneToOneSessionName?.trim() || base.oneToOneSessionName,
    oneToOneDurationMinutes: Math.max(
      15,
      Number(input?.oneToOneDurationMinutes ?? base.oneToOneDurationMinutes),
    ),
    trialBookingUrl: input?.trialBookingUrl?.trim() || "",
    defaultCreditPackSize: Math.max(
      1,
      Number(input?.defaultCreditPackSize ?? base.defaultCreditPackSize),
    ),
    schedulingWindowDays: Math.max(
      1,
      Number(input?.schedulingWindowDays ?? base.schedulingWindowDays),
    ),
  };
}

function normalizeRevenueWorkspaceSettings(
  input?: Partial<StoredRevenueWorkspaceSettings>,
): StoredRevenueWorkspaceSettings {
  const base = createDefaultRevenueWorkspaceSettings();

  return {
    ...base,
    ...input,
    webshopCollectionName: input?.webshopCollectionName?.trim() || base.webshopCollectionName,
    cardTerminalLabel: input?.cardTerminalLabel?.trim() || base.cardTerminalLabel,
    autocollectPolicy: input?.autocollectPolicy?.trim() || base.autocollectPolicy,
    directDebitLeadDays: Math.max(
      1,
      Number(input?.directDebitLeadDays ?? base.directDebitLeadDays),
    ),
  };
}

function normalizeCoachingWorkspaceSettings(
  input?: Partial<StoredCoachingWorkspaceSettings>,
): StoredCoachingWorkspaceSettings {
  const base = createDefaultCoachingWorkspaceSettings();

  return {
    ...base,
    ...input,
    workoutPlanFocus: input?.workoutPlanFocus?.trim() || base.workoutPlanFocus,
    videoLibraryUrl: input?.videoLibraryUrl?.trim() || "",
    progressMetric: input?.progressMetric?.trim() || base.progressMetric,
    heartRateProvider: input?.heartRateProvider?.trim() || base.heartRateProvider,
    aiCoachMode: input?.aiCoachMode?.trim() || base.aiCoachMode,
  };
}

function normalizeRetentionWorkspaceSettings(
  input?: Partial<StoredRetentionWorkspaceSettings>,
): StoredRetentionWorkspaceSettings {
  const base = createDefaultRetentionWorkspaceSettings();

  return {
    ...base,
    ...input,
    communityChannel: input?.communityChannel?.trim() || base.communityChannel,
    challengeTheme: input?.challengeTheme?.trim() || base.challengeTheme,
    questionnaireTrigger: input?.questionnaireTrigger?.trim() || base.questionnaireTrigger,
    proContentPath: input?.proContentPath?.trim() || "",
    fitZoneOffer: input?.fitZoneOffer?.trim() || base.fitZoneOffer,
  };
}

function normalizeMobileExperienceSettings(
  input?: Partial<StoredMobileExperienceSettings>,
): StoredMobileExperienceSettings {
  const base = createDefaultMobileExperienceSettings();

  return {
    ...base,
    ...input,
    appDisplayName: input?.appDisplayName?.trim() || base.appDisplayName,
    onboardingHeadline: input?.onboardingHeadline?.trim() || base.onboardingHeadline,
    supportChannel: input?.supportChannel?.trim() || base.supportChannel,
    primaryAccent: input?.primaryAccent?.trim() || base.primaryAccent,
    whiteLabelDomain: input?.whiteLabelDomain?.trim() || "",
  };
}

function normalizeMarketingWorkspaceSettings(
  input?: Partial<StoredMarketingWorkspaceSettings>,
): StoredMarketingWorkspaceSettings {
  const base = createDefaultMarketingWorkspaceSettings();

  return {
    ...base,
    ...input,
    emailSenderName: input?.emailSenderName?.trim() || base.emailSenderName,
    emailReplyTo: input?.emailReplyTo?.trim() || base.emailReplyTo,
    promotionHeadline: input?.promotionHeadline?.trim() || base.promotionHeadline,
    leadPipelineLabel: input?.leadPipelineLabel?.trim() || base.leadPipelineLabel,
  };
}

function normalizeIntegrationWorkspaceSettings(
  input?: Partial<StoredIntegrationWorkspaceSettings>,
): StoredIntegrationWorkspaceSettings {
  const base = createDefaultIntegrationWorkspaceSettings();

  return {
    ...base,
    ...input,
    hardwareVendors: normalizeStringArray(input?.hardwareVendors ?? base.hardwareVendors),
    softwareIntegrations: normalizeStringArray(
      input?.softwareIntegrations ?? base.softwareIntegrations,
    ),
    equipmentIntegrations: normalizeStringArray(
      input?.equipmentIntegrations ?? base.equipmentIntegrations,
    ),
    migrationProvider: input?.migrationProvider?.trim() || base.migrationProvider,
    bodyCompositionProvider: input?.bodyCompositionProvider?.trim() || "",
  };
}

function normalizeReviewStatus(value?: string): ReviewRequestStatus {
  switch (value) {
    case "approved":
    case "rejected":
      return value;
    default:
      return "pending";
  }
}

function normalizeMemberSignupStatus(value?: string): MemberSignupStatus {
  switch (value) {
    case "approved":
    case "rejected":
      return value;
    default:
      return "pending_review";
  }
}

function normalizeBillingInvoiceStatus(value?: string): BillingInvoiceStatus {
  switch (value) {
    case "draft":
    case "paid":
    case "failed":
    case "refunded":
      return value;
    default:
      return "open";
  }
}

function normalizeBillingRefundStatus(value?: string): BillingRefundStatus {
  switch (value) {
    case "processed":
    case "failed":
      return value;
    default:
      return "pending";
  }
}

function normalizeBillingWebhookStatus(value?: string): BillingWebhookEventStatus {
  switch (value) {
    case "processed":
    case "failed":
      return value;
    default:
      return "received";
  }
}

function normalizeBillingInvoiceSource(value?: string): BillingInvoiceSource {
  switch (value) {
    case "signup_checkout":
    case "appointment_pack":
    case "late_fee":
    case "manual":
      return value;
    default:
      return "membership";
  }
}

function normalizeBillingReconciliationStatus(value?: string): BillingReconciliationStatus {
  return value === "balanced" ? "balanced" : "attention";
}

function normalizeLeadTaskType(value?: string): LeadTaskType {
  switch (value) {
    case "abandoned_booking":
    case "follow_up":
      return value;
    default:
      return "nurture";
  }
}

function normalizeLeadTaskStatus(value?: string): LeadTaskStatus {
  switch (value) {
    case "done":
    case "cancelled":
      return value;
    default:
      return "open";
  }
}

function normalizeLeadAutomationTrigger(value?: string): LeadAutomationTrigger {
  switch (value) {
    case "schedule":
    case "booking_cancellation":
      return value;
    default:
      return "manual";
  }
}

function normalizeAppointmentStatus(value?: string): AppointmentStatus {
  switch (value) {
    case "completed":
    case "cancelled":
      return value;
    default:
      return "scheduled";
  }
}

function normalizeAppointmentRecurrence(value?: string): AppointmentRecurrence {
  return value === "weekly" ? "weekly" : "none";
}

function normalizeCommunityGroupStatus(value?: string): CommunityGroupStatus {
  return value === "archived" ? "archived" : "active";
}

function normalizeChallengeStatus(value?: string): ChallengeStatus {
  switch (value) {
    case "draft":
    case "completed":
    case "archived":
      return value;
    default:
      return "active";
  }
}

function normalizeQuestionnaireStatus(value?: string): QuestionnaireStatus {
  switch (value) {
    case "draft":
    case "closed":
      return value;
    default:
      return "live";
  }
}

function normalizeTenantMemberSignups(
  tenantId: TenantId,
  input?: ReadonlyArray<MemberSignupRequest>,
): ReadonlyArray<MemberSignupRequest> {
  return (input ?? [])
    .map((signup) => ({
      ...signup,
      tenantId,
      fullName: signup.fullName.trim(),
      email: normalizeEmail(signup.email),
      phone: signup.phone.trim(),
      membershipPlanId: signup.membershipPlanId.trim(),
      preferredLocationId: signup.preferredLocationId.trim(),
      paymentMethod: normalizeBillingPaymentMethod(signup.paymentMethod),
      status: normalizeMemberSignupStatus(signup.status),
      notes: signup.notes?.trim() || undefined,
      ownerNotes: signup.ownerNotes?.trim() || undefined,
      approvedMemberId: signup.approvedMemberId?.trim() || undefined,
      contractAcceptedAt: new Date(signup.contractAcceptedAt).toISOString(),
      waiverAcceptedAt: new Date(signup.waiverAcceptedAt).toISOString(),
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function normalizeBillingBackofficeData(
  tenantId: TenantId,
  input?: Partial<StoredBillingBackofficeData>,
): StoredBillingBackofficeData {
  const base = createDefaultBillingBackofficeData();

  return {
    invoices: (input?.invoices ?? base.invoices)
      .map((invoice) => ({
        ...invoice,
        tenantId,
        memberId: invoice.memberId?.trim() || undefined,
        memberName: invoice.memberName.trim(),
        description: invoice.description.trim(),
        amountCents: Math.max(0, Math.round(invoice.amountCents)),
        currency: invoice.currency.trim().toUpperCase() || "EUR",
        dueAt: new Date(invoice.dueAt).toISOString(),
        issuedAt: new Date(invoice.issuedAt).toISOString(),
        status: normalizeBillingInvoiceStatus(invoice.status),
        source: normalizeBillingInvoiceSource(invoice.source),
        retryCount: Math.max(0, Math.round(invoice.retryCount)),
        paidAt: invoice.paidAt ? new Date(invoice.paidAt).toISOString() : undefined,
        refundedAt: invoice.refundedAt ? new Date(invoice.refundedAt).toISOString() : undefined,
        lastWebhookEventType: invoice.lastWebhookEventType?.trim() || undefined,
        externalReference: invoice.externalReference?.trim() || undefined,
      }))
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt)),
    refunds: (input?.refunds ?? base.refunds)
      .map((refund) => ({
        ...refund,
        tenantId,
        invoiceId: refund.invoiceId.trim(),
        amountCents: Math.max(0, Math.round(refund.amountCents)),
        reason: refund.reason.trim(),
        status: normalizeBillingRefundStatus(refund.status),
        requestedAt: new Date(refund.requestedAt).toISOString(),
        processedAt: refund.processedAt ? new Date(refund.processedAt).toISOString() : undefined,
      }))
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt)),
    webhooks: (input?.webhooks ?? base.webhooks)
      .map((webhook) => ({
        ...webhook,
        tenantId,
        invoiceId: webhook.invoiceId.trim(),
        eventType: webhook.eventType.trim(),
        status: normalizeBillingWebhookStatus(webhook.status),
        providerReference: webhook.providerReference.trim(),
        payloadSummary: webhook.payloadSummary.trim(),
        receivedAt: new Date(webhook.receivedAt).toISOString(),
        processedAt: webhook.processedAt ? new Date(webhook.processedAt).toISOString() : undefined,
      }))
      .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt)),
    reconciliationRuns: (input?.reconciliationRuns ?? base.reconciliationRuns)
      .map((run) => ({
        ...run,
        tenantId,
        note: run.note?.trim() || undefined,
        matchedInvoiceIds: normalizeStringArray(run.matchedInvoiceIds),
        unmatchedInvoiceIds: normalizeStringArray(run.unmatchedInvoiceIds),
        totalInvoices: Math.max(0, Math.round(run.totalInvoices)),
        status: normalizeBillingReconciliationStatus(run.status),
        createdAt: new Date(run.createdAt).toISOString(),
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

function normalizeLeadAutomationData(
  tenantId: TenantId,
  input?: Partial<StoredLeadAutomationData>,
): StoredLeadAutomationData {
  const base = createDefaultLeadAutomationData();

  return {
    tasks: (input?.tasks ?? base.tasks)
      .map((task) => ({
        ...task,
        tenantId,
        type: normalizeLeadTaskType(task.type),
        title: task.title.trim(),
        dueAt: new Date(task.dueAt).toISOString(),
        status: normalizeLeadTaskStatus(task.status),
        source: (task.source === "system"
          ? "system"
          : normalizeLeadSource(task.source)) as LeadSource | "system",
        leadId: task.leadId?.trim() || undefined,
        memberId: task.memberId?.trim() || undefined,
        bookingId: task.bookingId?.trim() || undefined,
        notes: task.notes?.trim() || undefined,
        assignedStaffName: task.assignedStaffName?.trim() || undefined,
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    attributions: (input?.attributions ?? base.attributions)
      .map((attribution) => ({
        ...attribution,
        tenantId,
        leadId: attribution.leadId?.trim() || undefined,
        source: normalizeLeadSource(attribution.source),
        campaignLabel: attribution.campaignLabel.trim(),
        medium: attribution.medium.trim(),
        createdAt: new Date(attribution.createdAt).toISOString(),
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    runs: (input?.runs ?? base.runs)
      .map((run) => ({
        ...run,
        tenantId,
        trigger: normalizeLeadAutomationTrigger(run.trigger),
        createdTasks: Math.max(0, Math.round(run.createdTasks)),
        createdAt: new Date(run.createdAt).toISOString(),
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    lastRunAt: input?.lastRunAt ? new Date(input.lastRunAt).toISOString() : undefined,
  };
}

function normalizeAppointmentData(
  tenantId: TenantId,
  input?: Partial<StoredAppointmentData>,
): StoredAppointmentData {
  const base = createDefaultAppointmentData();

  return {
    creditPacks: (input?.creditPacks ?? base.creditPacks)
      .map((pack) => ({
        ...pack,
        tenantId,
        memberId: pack.memberId.trim(),
        memberName: pack.memberName.trim(),
        trainerId: pack.trainerId.trim(),
        title: pack.title.trim(),
        totalCredits: Math.max(0, Math.round(pack.totalCredits)),
        remainingCredits: Math.max(0, Math.round(pack.remainingCredits)),
        validUntil: new Date(pack.validUntil).toISOString(),
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    sessions: (input?.sessions ?? base.sessions)
      .map((session) => ({
        ...session,
        tenantId,
        trainerId: session.trainerId.trim(),
        trainerName: session.trainerName.trim(),
        memberId: session.memberId?.trim() || undefined,
        memberName: session.memberName?.trim() || undefined,
        locationId: session.locationId.trim(),
        startsAt: new Date(session.startsAt).toISOString(),
        durationMinutes: Math.max(15, Math.round(session.durationMinutes)),
        status: normalizeAppointmentStatus(session.status),
        recurrence: normalizeAppointmentRecurrence(session.recurrence),
        seriesId: session.seriesId?.trim() || undefined,
        creditPackId: session.creditPackId?.trim() || undefined,
        notes: session.notes?.trim() || undefined,
      }))
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
  };
}

function normalizeCommunityData(
  tenantId: TenantId,
  input?: Partial<StoredCommunityData>,
): StoredCommunityData {
  const base = createDefaultCommunityData();
  const responses = (input?.responses ?? base.responses)
    .map((response) => ({
      ...response,
      tenantId,
      questionnaireId: response.questionnaireId.trim(),
      memberId: response.memberId.trim(),
      memberName: response.memberName.trim(),
      answers: normalizeStringArray(response.answers),
      submittedAt: new Date(response.submittedAt).toISOString(),
    }))
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  const responseCountByQuestionnaire = new Map<string, number>();

  for (const response of responses) {
    responseCountByQuestionnaire.set(
      response.questionnaireId,
      (responseCountByQuestionnaire.get(response.questionnaireId) ?? 0) + 1,
    );
  }

  return {
    groups: (input?.groups ?? base.groups)
      .map((group) => ({
        ...group,
        tenantId,
        name: group.name.trim(),
        channel: group.channel.trim(),
        description: group.description.trim(),
        memberIds: normalizeStringArray(group.memberIds),
        status: normalizeCommunityGroupStatus(group.status),
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    challenges: (input?.challenges ?? base.challenges)
      .map((challenge) => ({
        ...challenge,
        tenantId,
        title: challenge.title.trim(),
        rewardLabel: challenge.rewardLabel.trim(),
        startsAt: new Date(challenge.startsAt).toISOString(),
        endsAt: new Date(challenge.endsAt).toISOString(),
        participantMemberIds: normalizeStringArray(challenge.participantMemberIds),
        status: normalizeChallengeStatus(challenge.status),
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    questionnaires: (input?.questionnaires ?? base.questionnaires)
      .map((questionnaire) => ({
        ...questionnaire,
        tenantId,
        title: questionnaire.title.trim(),
        trigger: questionnaire.trigger.trim(),
        questions: normalizeStringArray(questionnaire.questions),
        responseCount:
          responseCountByQuestionnaire.get(questionnaire.id) ??
          Math.max(0, Math.round(questionnaire.responseCount)),
        status: normalizeQuestionnaireStatus(questionnaire.status),
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    responses,
  };
}

function normalizeMobileSelfServiceData(
  tenantId: TenantId,
  input?: Partial<StoredMobileSelfServiceData>,
): StoredMobileSelfServiceData {
  const base = createDefaultMobileSelfServiceData();

  return {
    receipts: (input?.receipts ?? base.receipts)
      .map((receipt) => ({
        ...receipt,
        memberId: receipt.memberId?.trim() || undefined,
        memberName: receipt.memberName.trim(),
        description: receipt.description.trim(),
        amountCents: Math.max(0, Math.round(receipt.amountCents)),
        currency: receipt.currency.trim().toUpperCase() || "EUR",
        paidAt: new Date(receipt.paidAt).toISOString(),
      }))
      .sort((left, right) => right.paidAt.localeCompare(left.paidAt)),
    paymentMethodRequests: (input?.paymentMethodRequests ?? base.paymentMethodRequests)
      .map((request) => ({
        ...request,
        tenantId,
        memberId: request.memberId.trim(),
        memberName: request.memberName.trim(),
        requestedMethodLabel: request.requestedMethodLabel.trim(),
        note: request.note?.trim() || undefined,
        ownerNotes: request.ownerNotes?.trim() || undefined,
        status: normalizeReviewStatus(request.status),
        requestedAt: new Date(request.requestedAt).toISOString(),
        reviewedAt: request.reviewedAt ? new Date(request.reviewedAt).toISOString() : undefined,
      }))
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt)),
    pauseRequests: (input?.pauseRequests ?? base.pauseRequests)
      .map((request) => ({
        ...request,
        tenantId,
        memberId: request.memberId.trim(),
        memberName: request.memberName.trim(),
        startsAt: new Date(request.startsAt).toISOString(),
        endsAt: new Date(request.endsAt).toISOString(),
        reason: request.reason.trim(),
        ownerNotes: request.ownerNotes?.trim() || undefined,
        status: normalizeReviewStatus(request.status),
        requestedAt: new Date(request.requestedAt).toISOString(),
        reviewedAt: request.reviewedAt ? new Date(request.reviewedAt).toISOString() : undefined,
      }))
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt)),
    contracts: (input?.contracts ?? base.contracts)
      .map((contract) => ({
        ...contract,
        tenantId,
        memberId: contract.memberId.trim(),
        memberName: contract.memberName.trim(),
        membershipPlanId: contract.membershipPlanId.trim(),
        contractName: contract.contractName.trim(),
        documentLabel: contract.documentLabel.trim(),
        documentUrl: contract.documentUrl.trim(),
        signedAt: new Date(contract.signedAt).toISOString(),
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  };
}

function normalizeTenantModuleData(
  tenantId: TenantId,
  input?: Partial<StoredTenantModuleData>,
): StoredTenantModuleData {
  return {
    memberSignups: normalizeTenantMemberSignups(tenantId, input?.memberSignups),
    billingBackoffice: normalizeBillingBackofficeData(tenantId, input?.billingBackoffice),
    leadAutomation: normalizeLeadAutomationData(tenantId, input?.leadAutomation),
    appointments: normalizeAppointmentData(tenantId, input?.appointments),
    community: normalizeCommunityData(tenantId, input?.community),
    mobileSelfService: normalizeMobileSelfServiceData(tenantId, input?.mobileSelfService),
  };
}

function createDefaultTenantModuleSettings(): StoredTenantModuleSettings {
  return {
    booking: createDefaultBookingWorkspaceSettings(),
    revenue: createDefaultRevenueWorkspaceSettings(),
    coaching: createDefaultCoachingWorkspaceSettings(),
    retention: createDefaultRetentionWorkspaceSettings(),
    mobile: createDefaultMobileExperienceSettings(),
    marketing: createDefaultMarketingWorkspaceSettings(),
    integrations: createDefaultIntegrationWorkspaceSettings(),
  };
}

function normalizeTenantModuleSettings(
  input?: PersistedLocalTenantProfile["moduleSettings"],
): StoredTenantModuleSettings {
  return {
    booking: normalizeBookingWorkspaceSettings(input?.booking),
    revenue: normalizeRevenueWorkspaceSettings(input?.revenue),
    coaching: normalizeCoachingWorkspaceSettings(input?.coaching),
    retention: normalizeRetentionWorkspaceSettings(input?.retention),
    mobile: normalizeMobileExperienceSettings(input?.mobile),
    marketing: normalizeMarketingWorkspaceSettings(input?.marketing),
    integrations: normalizeIntegrationWorkspaceSettings(input?.integrations),
  };
}

function normalizeTenantFeatureFlagOverrides(
  input?: ReadonlyArray<StoredTenantFeatureFlagOverride>,
) {
  const overrides = new Map<string, StoredTenantFeatureFlagOverride>();

  for (const entry of input ?? []) {
    const key = entry.key.trim();

    if (!key) {
      continue;
    }

    overrides.set(key, {
      key,
      value: Boolean(entry.value),
      updatedAt: entry.updatedAt,
      updatedBy: entry.updatedBy?.trim() || undefined,
    });
  }

  return [...overrides.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function normalizeLeadSource(value?: string): LeadSource {
  switch (value) {
    case "instagram":
    case "referral":
    case "walk_in":
    case "meta_ads":
    case "booking":
      return value;
    default:
      return "website";
  }
}

function normalizeLeadStage(value?: string): LeadStage {
  switch (value) {
    case "contacted":
    case "trial_scheduled":
    case "won":
    case "lost":
      return value;
    default:
      return "new";
  }
}

function normalizeCollectionCaseStatus(value?: string): CollectionCaseStatus {
  switch (value) {
    case "retrying":
    case "resolved":
    case "cancelled":
      return value;
    default:
      return "open";
  }
}

function normalizeCollectionCasePaymentMethod(value?: string): CollectionCasePaymentMethod {
  switch (value) {
    case "direct_debit":
    case "payment_request":
    case "cash":
    case "bank_transfer":
      return value;
    default:
      return "one_time";
  }
}

function normalizeBillingPaymentMethod(value?: string): BillingPaymentMethod {
  switch (value) {
    case "direct_debit":
    case "payment_request":
      return value;
    default:
      return "one_time";
  }
}

function normalizeTenantLeads(
  tenantId: TenantId,
  input?: ReadonlyArray<GymLead>,
): ReadonlyArray<GymLead> {
  return (input ?? [])
    .map((lead) => ({
      ...lead,
      tenantId,
      fullName: lead.fullName.trim(),
      email: normalizeEmail(lead.email),
      phone: lead.phone.trim(),
      source: normalizeLeadSource(lead.source),
      stage: normalizeLeadStage(lead.stage),
      interest: lead.interest.trim(),
      notes: lead.notes?.trim() || undefined,
      assignedStaffName: lead.assignedStaffName?.trim() || undefined,
      expectedValueCents:
        typeof lead.expectedValueCents === "number"
          ? Math.max(0, Math.round(lead.expectedValueCents))
          : undefined,
      convertedMemberId: lead.convertedMemberId?.trim() || undefined,
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function normalizeTenantCollectionCases(
  tenantId: TenantId,
  input?: ReadonlyArray<CollectionCase>,
): ReadonlyArray<CollectionCase> {
  return (input ?? [])
    .map((collectionCase) => ({
      ...collectionCase,
      tenantId,
      memberId: collectionCase.memberId?.trim() || undefined,
      memberName: collectionCase.memberName.trim(),
      paymentMethod: normalizeCollectionCasePaymentMethod(collectionCase.paymentMethod),
      status: normalizeCollectionCaseStatus(collectionCase.status),
      amountCents: Math.max(0, Math.round(collectionCase.amountCents)),
      reason: collectionCase.reason.trim(),
      dueAt: new Date(collectionCase.dueAt).toISOString(),
      notes: collectionCase.notes?.trim() || undefined,
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function normalizeLegalComplianceSettings(
  input?: Partial<StoredLegalComplianceSettings>,
): StoredLegalComplianceSettings {
  const base = createDefaultLegalComplianceSettings();
  const normalized = {
    ...base,
    ...input,
    waiverRetentionMonths: Math.max(
      1,
      Number(input?.waiverRetentionMonths ?? base.waiverRetentionMonths),
    ),
  };
  const isComplete = Boolean(
    normalized.termsUrl &&
      normalized.privacyUrl &&
      normalized.sepaCreditorId &&
      normalized.sepaMandateText &&
      normalized.contractPdfTemplateKey &&
      normalized.waiverStorageKey,
  );

  return {
    ...normalized,
    lastValidatedAt: isComplete ? input?.lastValidatedAt : undefined,
  };
}

function toTenantIdFromName(name: string) {
  return toTenantId(slugifyTenantName(name));
}

function toTenantSlug(tenantId: string) {
  return tenantId.trim().toLowerCase();
}

function findTenantBySlug(
  state: LocalPlatformState,
  tenantSlug: string,
) {
  return state.tenants.find(
    (tenant) => toTenantSlug(tenant.id) === toTenantSlug(tenantSlug),
  );
}

function toTenantBootstrapResult(
  state: LocalPlatformState,
  tenantId: TenantId,
): LocalTenantBootstrapResult {
  const tenant = state.tenants.find((entry) => entry.id === tenantId);

  if (!tenant) {
    throw new AppError("Tenant niet gevonden in de platformstate.", {
      code: "RESOURCE_NOT_FOUND",
      details: { tenantId },
    });
  }

  return {
    tenant,
    accounts: state.accounts.filter((account) => account.tenantId === tenantId),
    data: state.data,
  };
}

function normalizeTenantProfile(
  tenant: PersistedLocalTenantProfile,
): LocalTenantProfile {
  return {
    ...tenant,
    billing: normalizeStoredBillingSettings(tenant.billing),
    bookingPolicy: normalizeBookingPolicySettings(tenant.bookingPolicy),
    collectionCases: normalizeTenantCollectionCases(tenant.id, tenant.collectionCases),
    featureFlags: normalizeTenantFeatureFlagOverrides(tenant.featureFlags),
    legal: normalizeLegalComplianceSettings(tenant.legal),
    leads: normalizeTenantLeads(tenant.id, tenant.leads),
    moduleData: normalizeTenantModuleData(tenant.id, tenant.moduleData),
    moduleSettings: normalizeTenantModuleSettings(tenant.moduleSettings),
    remoteAccess: normalizeStoredRemoteAccessSettings(tenant.remoteAccess),
  };
}

function normalizeAccount(
  account: LocalPlatformAccount,
): LocalPlatformAccount {
  return {
    ...account,
    email: normalizeEmail(account.email),
    linkedMemberId: account.linkedMemberId?.trim() || undefined,
  };
}

function normalizeState(
  state: PersistedLocalPlatformState,
): {
  readonly state: LocalPlatformState;
  readonly changed: boolean;
} {
  let changed = false;
  const tenants = state.tenants.map((tenant) => {
    const normalized = normalizeTenantProfile(tenant);

    if (
      !tenant.remoteAccess ||
      !tenant.billing ||
      !tenant.bookingPolicy ||
      !tenant.collectionCases ||
      !tenant.legal ||
      !tenant.featureFlags ||
      !tenant.leads ||
      !tenant.moduleData ||
      !tenant.moduleData.billingBackoffice ||
      !tenant.moduleData.leadAutomation ||
      !tenant.moduleData.appointments ||
      !tenant.moduleData.community ||
      !tenant.moduleData.mobileSelfService ||
      !tenant.moduleSettings ||
      !tenant.moduleSettings.booking ||
      !tenant.moduleSettings.revenue ||
      !tenant.moduleSettings.coaching ||
      !tenant.moduleSettings.retention ||
      !tenant.moduleSettings.mobile ||
      !tenant.moduleSettings.marketing ||
      !tenant.moduleSettings.integrations
    ) {
      changed = true;
    }

    return normalized;
  });
  const accounts = state.accounts.map((account) => {
    const normalized = normalizeAccount(account);

    if (
      normalized.email !== account.email ||
      normalized.linkedMemberId !== account.linkedMemberId
    ) {
      changed = true;
    }

    return normalized;
  });

  return {
    state: {
      ...state,
      tenants,
      accounts,
    },
    changed,
  };
}

function migrateLegacyState(parsed: LegacyLocalPlatformState): LocalPlatformState {
  return {
    version: stateVersion,
    tenants: [
      {
        ...parsed.tenant,
        billing: createDefaultBillingSettings(),
        bookingPolicy: createDefaultBookingPolicySettings(),
        collectionCases: [],
        featureFlags: [],
        legal: createDefaultLegalComplianceSettings(),
        leads: [],
        moduleData: createDefaultTenantModuleData(),
        moduleSettings: createDefaultTenantModuleSettings(),
        remoteAccess: createDefaultRemoteAccessSettings(),
      },
    ],
    accounts: parsed.accounts.map((account) => ({
      ...account,
      tenantId: parsed.tenant.id,
      linkedMemberId: undefined,
    })),
    data: parsed.data,
  };
}

function migrateVersion2State(
  parsed: LegacyVersion2LocalPlatformState,
): LocalPlatformState {
  const normalized = normalizeState({
    ...parsed,
    version: stateVersion,
  });

  return {
    ...normalized.state,
    version: stateVersion,
  };
}

async function persistState(state: LocalPlatformState) {
  const collection = await resolveMongoStateCollection();

  if (collection) {
    const document: MongoLocalPlatformStateDocument = {
      id: mongoPlatformStateDocumentId,
      ...state,
    };
    const existing = await collection.findOne({ id: mongoPlatformStateDocumentId });

    if (!existing) {
      await collection.insertOne(document);
      return;
    }

    await collection.updateOne(
      { id: mongoPlatformStateDocumentId },
      {
        set: {
          version: document.version,
          tenants: document.tenants,
          accounts: document.accounts,
          data: document.data,
        },
      },
    );
    return;
  }

  if (!shouldUseFileFallback()) {
    throw new AppError(
      "Platformstate kan niet lokaal worden opgeslagen. Configureer MongoDB voor runtime data.",
      {
        code: "INVALID_INPUT",
      },
    );
  }

  const stateFilePath = getStateFilePath();
  await mkdir(path.dirname(stateFilePath), { recursive: true });
  const temporaryPath = `${stateFilePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(state, null, 2), "utf8");
  await rename(temporaryPath, stateFilePath);
}

async function withStateMutation<T>(
  mutate: (current: LocalPlatformState | null) => Promise<T>,
) {
  const nextStep = mutationQueue.then(async () => {
    const current = await readLocalPlatformState();
    return mutate(current);
  });

  mutationQueue = nextStep.then(
    () => undefined,
    () => undefined,
  );

  return nextStep;
}

export async function readLocalPlatformState(): Promise<LocalPlatformState | null> {
  const collection = await resolveMongoStateCollection();

  if (collection) {
    const document = await collection.findOne({ id: mongoPlatformStateDocumentId });

    if (!document) {
      return null;
    }

    if (
      (document.version === 2 ||
        document.version === 3 ||
        document.version === 4 ||
        document.version === 5) &&
      "tenants" in document
    ) {
      const migrated = migrateVersion2State(document);
      await persistState(migrated);
      return migrated;
    }

    if (document.version !== stateVersion || !("tenants" in document)) {
      throw new AppError("De platformstate in de database heeft een onverwachte versie.", {
        code: "INVALID_INPUT",
        details: { expectedVersion: stateVersion, actualVersion: document.version },
      });
    }

    const normalized = normalizeState(document);

    if (normalized.changed) {
      await persistState(normalized.state);
    }

    return normalized.state;
  }

  if (!shouldUseFileFallback()) {
    throw new AppError(
      "Platformstate kan niet lokaal worden gelezen. Configureer MONGODB_URI voor deze app.",
      {
        code: "INVALID_INPUT",
      },
    );
  }

  try {
    const raw = readFileSync(getStateFilePath(), "utf8");

    if (!raw.trim()) {
      return null;
    }

    const parsed = JSON.parse(raw) as
      | PersistedLocalPlatformState
      | LegacyVersion2LocalPlatformState
      | LegacyLocalPlatformState;

    if (parsed.version === 1 && "tenant" in parsed) {
      const migrated = migrateLegacyState(parsed);
      await persistState(migrated);
      return migrated;
    }

    if (
      (parsed.version === 2 ||
        parsed.version === 3 ||
        parsed.version === 4 ||
        parsed.version === 5) &&
      "tenants" in parsed
    ) {
      const migrated = migrateVersion2State(parsed);
      await persistState(migrated);
      return migrated;
    }

    if (parsed.version !== stateVersion || !("tenants" in parsed)) {
      throw new AppError("De platformstate heeft een onverwachte versie.", {
        code: "INVALID_INPUT",
        details: { expectedVersion: stateVersion, actualVersion: parsed.version },
      });
    }

    const normalized = normalizeState(parsed);

    if (normalized.changed) {
      await persistState(normalized.state);
    }

    return normalized.state;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

export async function hasLocalPlatformSetup() {
  const state = await readLocalPlatformState();
  return (state?.tenants.length ?? 0) > 0;
}

export async function listLocalTenants() {
  const state = await readLocalPlatformState();
  return state?.tenants ?? [];
}

export async function bootstrapLocalPlatform(input: BootstrapPlatformInput) {
  return withStateMutation(async (current) => {
    const nextStateBase = current ?? createEmptyState();
    const tenantId = toTenantIdFromName(input.tenantName);

    if (nextStateBase.tenants.some((tenant) => tenant.id === tenantId)) {
      throw new AppError("Er bestaat al een gym met deze naam of slug.", {
        code: "INVALID_INPUT",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const tenant: LocalTenantProfile = {
      id: tenantId,
      name: input.tenantName.trim(),
      billing: createDefaultBillingSettings(),
      bookingPolicy: createDefaultBookingPolicySettings(),
      collectionCases: [],
      featureFlags: [],
      legal: createDefaultLegalComplianceSettings(),
      leads: [],
      moduleData: createDefaultTenantModuleData(),
      moduleSettings: createDefaultTenantModuleSettings(),
      remoteAccess: createDefaultRemoteAccessSettings(),
      createdAt: now,
      updatedAt: now,
    };
    const ownerAccount: LocalPlatformAccount = {
      userId: accountIdGenerator.next(),
      tenantId,
      email: normalizeEmail(input.ownerEmail),
      displayName: input.ownerName.trim(),
      roleKey: "owner",
      passwordHash: hashPassword(input.password),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const nextState: LocalPlatformState = {
      ...nextStateBase,
      version: stateVersion,
      tenants: [...nextStateBase.tenants, tenant],
      accounts: [...nextStateBase.accounts, ownerAccount],
    };

    await persistState(nextState);
    return toTenantBootstrapResult(nextState, tenantId);
  });
}

export async function authenticateLocalAccount(
  email: string,
  password: string,
  tenantSlug?: string,
): Promise<AuthenticatedLocalAccount | null> {
  await ensureConfiguredSuperadminAccount();
  const state = await readLocalPlatformState();

  if (!state) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const candidateAccounts = state.accounts.filter(
    (entry) =>
      entry.status === "active" && normalizeEmail(entry.email) === normalizedEmail,
  );

  if (candidateAccounts.length === 0) {
    return null;
  }

  const scopedAccounts = tenantSlug
    ? candidateAccounts.filter(
        (entry) => toTenantSlug(entry.tenantId) === toTenantSlug(tenantSlug),
      )
    : candidateAccounts;

  const matchingAccounts = scopedAccounts.filter((entry) =>
    verifyPassword(password, entry.passwordHash),
  );

  if (matchingAccounts.length === 0) {
    return null;
  }

  const matchingTenants = matchingAccounts
    .map((account) => state.tenants.find((entry) => entry.id === account.tenantId) ?? null)
    .filter((tenant): tenant is LocalTenantProfile => tenant !== null);

  if (matchingTenants.length !== matchingAccounts.length) {
    return null;
  }

  if (matchingAccounts.length > 1 && !matchingAccounts.every(isMemberAccount)) {
    return null;
  }

  const [account] = matchingAccounts;
  const [tenant] = matchingTenants;

  if (!account || !tenant) {
    return null;
  }

  return {
    account,
    tenant,
    accounts: matchingAccounts,
    tenants: matchingTenants,
  };
}

export async function listLocalPlatformAccounts(tenantId?: string) {
  const state = await readLocalPlatformState();

  if (!state) {
    return [];
  }

  if (!tenantId) {
    return state.accounts;
  }

  return state.accounts.filter((account) => account.tenantId === tenantId);
}

export async function listLocalMemberPortalAccountsByEmail(email: string) {
  const state = await readLocalPlatformState();

  if (!state) {
    return [];
  }

  const normalizedEmail = normalizeEmail(email);
  return state.accounts.filter(
    (account) =>
      isMemberAccount(account) &&
      account.status === "active" &&
      account.linkedMemberId &&
      normalizeEmail(account.email) === normalizedEmail,
  );
}

export async function getLocalTenantProfile(tenantId?: string) {
  const state = await readLocalPlatformState();

  if (!state) {
    return null;
  }

  if (!tenantId) {
    return state.tenants[0] ?? null;
  }

  return state.tenants.find((tenant) => tenant.id === tenantId) ?? null;
}

export async function getLocalTenantProfileBySlug(tenantSlug: string) {
  const state = await readLocalPlatformState();

  if (!state) {
    return null;
  }

  return findTenantBySlug(state, tenantSlug) ?? null;
}

export async function createLocalPlatformAccount(
  tenantId: string,
  input: CreatePlatformAccountInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je teamaccounts toevoegt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor dit teamaccount.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const normalizedEmail = normalizeEmail(input.email);
    assertUniqueTenantEmail(current.accounts, tenant.id, normalizedEmail);

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
            }
          : entry,
      ),
      accounts: [
        ...current.accounts,
        {
          userId: accountIdGenerator.next(),
          tenantId: tenant.id,
          email: normalizedEmail,
          displayName: input.displayName.trim(),
          roleKey: input.roleKey,
          passwordHash: hashPassword(input.password),
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
    };

    await persistState(nextState);
    return toTenantBootstrapResult(nextState, tenant.id);
  });
}

export async function upsertLocalSuperadminAccount(
  input: UpsertSuperadminAccountInput,
) {
  return withStateMutation(async (current) => {
    if (!current || current.tenants.length === 0) {
      throw new AppError("Maak eerst minimaal één gym aan voordat je een superadmin koppelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant =
      (input.tenantId
        ? current.tenants.find((entry) => entry.id === input.tenantId)
        : current.tenants[0]) ?? null;

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor dit superadmin-account.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId: input.tenantId },
      });
    }

    const normalizedEmail = normalizeEmail(input.email);
    const existingAccount = current.accounts.find(
      (account) =>
        isSuperadminAccount(account) &&
        normalizeEmail(account.email) === normalizedEmail,
    );
    assertUniquePlatformEmail(current.accounts, normalizedEmail, existingAccount?.userId);

    const displayName = input.displayName.trim() || "Platform Superadmin";
    const passwordStillValid =
      existingAccount && verifyPassword(input.password, existingAccount.passwordHash);

    if (
      existingAccount &&
      existingAccount.tenantId === tenant.id &&
      existingAccount.displayName === displayName &&
      existingAccount.status === "active" &&
      passwordStillValid
    ) {
      return toTenantBootstrapResult(current, tenant.id);
    }

    const now = new Date().toISOString();
    const nextAccount: LocalPlatformAccount = existingAccount
      ? {
          ...existingAccount,
          tenantId: tenant.id,
          displayName,
          email: normalizedEmail,
          passwordHash: passwordStillValid
            ? existingAccount.passwordHash
            : hashPassword(input.password),
          status: "active",
          updatedAt: now,
        }
      : {
          userId: accountIdGenerator.next(),
          tenantId: tenant.id,
          email: normalizedEmail,
          displayName,
          roleKey: "superadmin",
          passwordHash: hashPassword(input.password),
          status: "active",
          createdAt: now,
          updatedAt: now,
        };

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenant.id ? { ...entry, updatedAt: now } : entry,
      ),
      accounts: existingAccount
        ? current.accounts.map((account) =>
            account.userId === existingAccount.userId ? nextAccount : account,
          )
        : [...current.accounts, nextAccount],
    };

    await persistState(nextState);
    return toTenantBootstrapResult(nextState, tenant.id);
  });
}

export async function ensureConfiguredSuperadminAccount() {
  const email = process.env.SUPERADMIN_EMAIL?.trim();
  const password = process.env.SUPERADMIN_PASSWORD?.trim();

  if (!email || !password) {
    return null;
  }

  const state = await readLocalPlatformState();

  if (!state || state.tenants.length === 0) {
    return null;
  }

  return upsertLocalSuperadminAccount({
    displayName: process.env.SUPERADMIN_NAME?.trim() || "Platform Superadmin",
    email,
    password,
    tenantId: process.env.SUPERADMIN_TENANT_ID?.trim() || undefined,
  });
}

export async function upsertLocalMemberPortalAccount(
  tenantId: string,
  input: UpsertMemberPortalAccountInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je ledenaccounts beheert.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor dit ledenaccount.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const existingAccount = current.accounts.find(
      (account) =>
        account.tenantId === tenant.id &&
        isMemberAccount(account) &&
        account.linkedMemberId === input.memberId,
    );
    const normalizedEmail = normalizeEmail(input.email);
    const passwordHash = hashPassword(input.password);
    assertUniqueTenantEmail(
      current.accounts,
      tenant.id,
      normalizedEmail,
      existingAccount?.userId,
    );

    const now = new Date().toISOString();
    const nextAccount: LocalPlatformAccount = existingAccount
      ? {
          ...existingAccount,
          displayName: input.displayName.trim(),
          email: normalizedEmail,
          passwordHash,
          status: "active",
          updatedAt: now,
        }
      : {
          userId: memberAccountIdGenerator.next(),
          tenantId: tenant.id,
          email: normalizedEmail,
          displayName: input.displayName.trim(),
          roleKey: "member",
          linkedMemberId: input.memberId,
          passwordHash,
          status: "active",
          createdAt: now,
          updatedAt: now,
        };

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenant.id ? { ...entry, updatedAt: now } : entry,
      ),
      accounts: (
        existingAccount
          ? current.accounts.map((account) =>
              account.userId === existingAccount.userId ? nextAccount : account,
            )
          : [...current.accounts, nextAccount]
      ).map((account) =>
        isMemberAccount(account) && normalizeEmail(account.email) === normalizedEmail
          ? {
              ...account,
              passwordHash,
              updatedAt: now,
            }
          : account,
      ),
    };

    await persistState(nextState);
    return nextAccount;
  });
}

export async function syncLocalMemberPortalAccount(
  tenantId: string,
  input: {
    readonly memberId: string;
    readonly displayName: string;
    readonly email: string;
    readonly status: "active" | "archived";
  },
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je ledenaccounts beheert.", {
        code: "FORBIDDEN",
      });
    }

    const existingAccount = current.accounts.find(
      (account) =>
        account.tenantId === tenantId &&
        isMemberAccount(account) &&
        account.linkedMemberId === input.memberId,
    );

    if (!existingAccount) {
      return null;
    }

    const normalizedEmail = normalizeEmail(input.email);
    assertUniqueTenantEmail(
      current.accounts,
      existingAccount.tenantId,
      normalizedEmail,
      existingAccount.userId,
    );

    const now = new Date().toISOString();
    const nextAccount: LocalPlatformAccount = {
      ...existingAccount,
      displayName: input.displayName.trim(),
      email: normalizedEmail,
      status: input.status,
      updatedAt: now,
    };
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === existingAccount.tenantId ? { ...entry, updatedAt: now } : entry,
      ),
      accounts: current.accounts.map((account) =>
        account.userId === existingAccount.userId ? nextAccount : account,
      ),
    };

    await persistState(nextState);
    return nextAccount;
  });
}

export async function deleteLocalMemberPortalAccountByMemberId(
  tenantId: string,
  memberId: string,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je ledenaccounts beheert.", {
        code: "FORBIDDEN",
      });
    }

    const matchingAccounts = current.accounts.filter(
      (account) =>
        account.tenantId === tenantId &&
        isMemberAccount(account) &&
        account.linkedMemberId === memberId,
    );

    if (matchingAccounts.length === 0) {
      return 0;
    }

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId ? { ...entry, updatedAt: now } : entry,
      ),
      accounts: current.accounts.filter(
        (account) =>
          !(
            account.tenantId === tenantId &&
            isMemberAccount(account) &&
            account.linkedMemberId === memberId
          ),
      ),
    };

    await persistState(nextState);
    return matchingAccounts.length;
  });
}

export async function updateLocalPlatformAccount(
  tenantId: string,
  input: UpdatePlatformAccountInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je teamaccounts beheert.", {
        code: "FORBIDDEN",
      });
    }

    const account = current.accounts.find(
      (entry) => entry.tenantId === tenantId && entry.userId === input.userId,
    );

    if (!account) {
      throw new AppError("Teamaccount niet gevonden binnen deze gym.", {
        code: "RESOURCE_NOT_FOUND",
        details: { userId: input.userId, tenantId },
      });
    }

    if (account.updatedAt !== input.expectedUpdatedAt) {
      throw new AppError("Teamaccount is al gewijzigd; laad eerst opnieuw.", {
        code: "VERSION_CONFLICT",
        details: {
          userId: input.userId,
          expectedUpdatedAt: input.expectedUpdatedAt,
          actualUpdatedAt: account.updatedAt,
        },
      });
    }

    const normalizedEmail = normalizeEmail(input.email);
    assertUniqueTenantEmail(current.accounts, account.tenantId, normalizedEmail, input.userId);

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((tenant) =>
        tenant.id === tenantId ? { ...tenant, updatedAt: now } : tenant,
      ),
      accounts: current.accounts.map((entry) =>
        entry.tenantId === tenantId && entry.userId === input.userId
          ? {
              ...entry,
              displayName: input.displayName.trim(),
              email: normalizedEmail,
              roleKey: input.roleKey,
              status: input.status,
              updatedAt: now,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return toTenantBootstrapResult(nextState, account.tenantId);
  });
}

export async function deleteLocalPlatformAccount(
  tenantId: string,
  input: { readonly userId: string; readonly expectedUpdatedAt: string },
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je teamaccounts beheert.", {
        code: "FORBIDDEN",
      });
    }

    const account = current.accounts.find(
      (entry) => entry.tenantId === tenantId && entry.userId === input.userId,
    );

    if (!account) {
      throw new AppError("Teamaccount niet gevonden binnen deze gym.", {
        code: "RESOURCE_NOT_FOUND",
        details: { userId: input.userId, tenantId },
      });
    }

    if (account.updatedAt !== input.expectedUpdatedAt) {
      throw new AppError("Teamaccount is al gewijzigd; laad eerst opnieuw.", {
        code: "VERSION_CONFLICT",
        details: {
          userId: input.userId,
          expectedUpdatedAt: input.expectedUpdatedAt,
          actualUpdatedAt: account.updatedAt,
        },
      });
    }

    if (
      account.roleKey === "owner" &&
      account.status === "active" &&
      current.accounts.filter(
        (entry) =>
          entry.tenantId === tenantId &&
          entry.roleKey === "owner" &&
          entry.status === "active",
      ).length <= 1
    ) {
      throw new AppError("Je kunt de laatste actieve owner niet verwijderen.", {
        code: "FORBIDDEN",
      });
    }

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((tenant) =>
        tenant.id === tenantId ? { ...tenant, updatedAt: now } : tenant,
      ),
      accounts: current.accounts.filter(
        (entry) => !(entry.tenantId === tenantId && entry.userId === input.userId),
      ),
    };

    await persistState(nextState);
    return toTenantBootstrapResult(nextState, account.tenantId);
  });
}

export async function updateLocalTenantRemoteAccess(
  tenantId: string,
  input: UpdateLocalTenantRemoteAccessInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je remote toegang instelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor remote toegang.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextRemoteAccessBase = normalizeStoredRemoteAccessSettings({
      ...tenant.remoteAccess,
      ...input,
      allowedRoleKeys: input.allowedRoleKeys ?? tenant.remoteAccess.allowedRoleKeys,
      lastRemoteActionAt: tenant.remoteAccess.lastRemoteActionAt,
      lastRemoteActionBy: tenant.remoteAccess.lastRemoteActionBy,
    });
    const nextConnectionStatus = getRemoteAccessConnectionStatus(nextRemoteAccessBase);
    const nextRemoteAccess: StoredRemoteAccessSettings = {
      ...nextRemoteAccessBase,
      lastValidatedAt:
        nextConnectionStatus === "configured" ? now : undefined,
    };

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              remoteAccess: nextRemoteAccess,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantBillingSettings(
  tenantId: string,
  input: UpdateLocalTenantBillingSettingsInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je betalingen instelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor betalingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextBillingBase = normalizeStoredBillingSettings({
      ...tenant.billing,
      ...input,
      lastPaymentActionAt: tenant.billing.lastPaymentActionAt,
      lastPaymentActionBy: tenant.billing.lastPaymentActionBy,
    });
    const nextBilling: StoredBillingSettings = {
      ...nextBillingBase,
      lastValidatedAt:
        nextBillingBase.profileLabel &&
        nextBillingBase.profileId &&
        nextBillingBase.supportEmail
          ? now
          : undefined,
    };

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              billing: nextBilling,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function startLocalTenantMollieConnect(
  tenantId: string,
  input: {
    readonly state: string;
    readonly testMode: boolean;
    readonly scope: string;
  },
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je Mollie koppelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor Mollie Connect.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextBilling = normalizeStoredBillingSettings({
      ...tenant.billing,
      mollieConnect: {
        ...tenant.billing.mollieConnect,
        scope: input.scope,
        testMode: input.testMode,
        state: input.state,
        stateCreatedAt: now,
      },
    });

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              billing: nextBilling,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function disconnectLocalTenantMollieConnect(tenantId: string) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je Mollie ontkoppelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor Mollie Connect.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextBilling = normalizeStoredBillingSettings({
      ...tenant.billing,
      profileId: "",
      profileLabel: "",
      mollieConnect: undefined,
    });
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              billing: nextBilling,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function recordLocalTenantMollieClientLink(
  tenantId: string,
  input: {
    readonly state: string;
    readonly testMode: boolean;
    readonly scope: string;
    readonly clientLinkId: string;
    readonly clientLinkUrl: string;
    readonly onboardingUrl: string;
  },
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je Mollie onboardt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor Mollie onboarding.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextBilling = normalizeStoredBillingSettings({
      ...tenant.billing,
      mollieConnect: {
        ...tenant.billing.mollieConnect,
        scope: input.scope,
        testMode: input.testMode,
        state: input.state,
        stateCreatedAt: now,
        clientLinkId: input.clientLinkId,
        clientLinkUrl: input.clientLinkUrl,
        onboardingUrl: input.onboardingUrl,
      },
    });

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              billing: nextBilling,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function findLocalTenantByMollieConnectState(state: string) {
  const platformState = await readLocalPlatformState();
  const normalizedState = state.trim();

  if (!normalizedState) {
    return null;
  }

  return (
    platformState?.tenants.find(
      (tenant) => tenant.billing.mollieConnect?.state === normalizedState,
    ) ?? null
  );
}

export async function completeLocalTenantMollieConnect(
  tenantId: string,
  input: {
    readonly state: string;
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresAt: string;
    readonly scope: string;
    readonly testMode: boolean;
    readonly profileId?: string;
    readonly profileLabel?: string;
    readonly profileStatus?: string;
  },
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je Mollie koppelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor Mollie Connect.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    if (tenant.billing.mollieConnect?.state !== input.state) {
      throw new AppError("Mollie OAuth state klopt niet meer.", {
        code: "FORBIDDEN",
      });
    }

    const now = new Date().toISOString();
    const nextBilling = normalizeStoredBillingSettings({
      ...tenant.billing,
      profileId: input.profileId || tenant.billing.profileId,
      profileLabel: input.profileLabel || tenant.billing.profileLabel || tenant.name,
      paymentMethods:
        tenant.billing.paymentMethods.length > 0
          ? tenant.billing.paymentMethods
          : ["direct_debit", "one_time", "payment_request"],
      mollieConnect: {
        ...tenant.billing.mollieConnect,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        expiresAt: input.expiresAt,
        scope: input.scope,
        connectedAt: now,
        testMode: input.testMode,
        state: undefined,
        stateCreatedAt: undefined,
        profileStatus: input.profileStatus,
      },
    });

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              billing: nextBilling,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantFeatureFlag(
  tenantId: string,
  input: UpdateLocalTenantFeatureFlagInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je feature flags instelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor feature flags.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const key = input.key.trim();

    if (!key) {
      throw new AppError("Feature flag key ontbreekt.", {
        code: "INVALID_INPUT",
      });
    }

    const now = new Date().toISOString();
    const nextFeatureFlag = {
      key,
      value: input.value,
      updatedAt: now,
      updatedBy: input.updatedBy?.trim() || undefined,
    } satisfies StoredTenantFeatureFlagOverride;

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              featureFlags: normalizeTenantFeatureFlagOverrides([
                ...entry.featureFlags.filter((feature) => feature.key !== key),
                nextFeatureFlag,
              ]),
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function createLocalTenantLead(
  tenantId: string,
  input: CreateLocalTenantLeadInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je leads toevoegt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor leadbeheer.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextLead = normalizeTenantLeads(tenant.id, [
      {
        id: leadIdGenerator.next(),
        tenantId: tenant.id,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        source: input.source,
        stage: input.stage,
        interest: input.interest,
        notes: input.notes,
        assignedStaffName: input.assignedStaffName,
        expectedValueCents: input.expectedValueCents,
        createdAt: now,
        updatedAt: now,
      },
    ])[0]!;

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              leads: normalizeTenantLeads(entry.id, [...entry.leads, nextLead]),
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextLead;
  });
}

export async function updateLocalTenantLead(
  tenantId: string,
  input: UpdateLocalTenantLeadInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je leads bijwerkt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor leadbeheer.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const lead = tenant.leads.find((entry) => entry.id === input.id);

    if (!lead) {
      throw new AppError("Lead niet gevonden.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId, leadId: input.id },
      });
    }

    const now = new Date().toISOString();
    const nextLead = normalizeTenantLeads(tenant.id, [
      {
        ...lead,
        stage: input.stage,
        notes: input.notes ?? lead.notes,
        assignedStaffName: input.assignedStaffName ?? lead.assignedStaffName,
        convertedMemberId: input.convertedMemberId ?? lead.convertedMemberId,
        updatedAt: now,
      },
    ])[0]!;

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              leads: normalizeTenantLeads(
                entry.id,
                entry.leads.map((existing) => (existing.id === input.id ? nextLead : existing)),
              ),
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextLead;
  });
}

export async function createLocalTenantCollectionCase(
  tenantId: string,
  input: CreateLocalTenantCollectionCaseInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je collections toevoegt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor collections.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextCollectionCase = normalizeTenantCollectionCases(tenant.id, [
      {
        id: collectionCaseIdGenerator.next(),
        tenantId: tenant.id,
        memberId: input.memberId,
        memberName: input.memberName,
        paymentMethod: input.paymentMethod,
        status: input.status,
        amountCents: input.amountCents,
        reason: input.reason,
        dueAt: input.dueAt,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      },
    ])[0]!;

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              collectionCases: normalizeTenantCollectionCases(entry.id, [
                ...entry.collectionCases,
                nextCollectionCase,
              ]),
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextCollectionCase;
  });
}

export async function updateLocalTenantCollectionCase(
  tenantId: string,
  input: UpdateLocalTenantCollectionCaseInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je collections bijwerkt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor collections.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const collectionCase = tenant.collectionCases.find((entry) => entry.id === input.id);

    if (!collectionCase) {
      throw new AppError("Collection case niet gevonden.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId, collectionCaseId: input.id },
      });
    }

    const now = new Date().toISOString();
    const nextCollectionCase = normalizeTenantCollectionCases(tenant.id, [
      {
        ...collectionCase,
        status: input.status,
        notes: input.notes ?? collectionCase.notes,
        updatedAt: now,
      },
    ])[0]!;

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              collectionCases: normalizeTenantCollectionCases(
                entry.id,
                entry.collectionCases.map((existing) =>
                  existing.id === input.id ? nextCollectionCase : existing,
                ),
              ),
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextCollectionCase;
  });
}

export async function createLocalTenantMemberSignup(
  tenantId: string,
  input: CreateLocalTenantMemberSignupInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je member signups toevoegt.",
      "Gym niet gevonden voor member signups.",
    );
    const now = new Date().toISOString();
    const signup = normalizeTenantMemberSignups(tenant.id, [
      {
        id: signupIdGenerator.next(),
        tenantId: tenant.id,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        phoneCountry: input.phoneCountry,
        membershipPlanId: input.membershipPlanId,
        preferredLocationId: input.preferredLocationId,
        paymentMethod: input.paymentMethod,
        contractAcceptedAt: input.contractAcceptedAt,
        waiverAcceptedAt: input.waiverAcceptedAt,
        status: "pending_review",
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      },
    ])[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                memberSignups: normalizeTenantMemberSignups(entry.id, [
                  ...entry.moduleData.memberSignups,
                  signup,
                ]),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return signup;
  });
}

export async function reviewLocalTenantMemberSignup(
  tenantId: string,
  input: ReviewLocalTenantMemberSignupInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je member signups beoordeelt.",
      "Gym niet gevonden voor member signups.",
    );
    const existing = tenant.moduleData.memberSignups.find((entry) => entry.id === input.id);

    if (!existing) {
      throw new AppError("Member signup niet gevonden.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId, signupId: input.id },
      });
    }

    const now = new Date().toISOString();
    const state = current ?? createEmptyState();
    const nextSignup = normalizeTenantMemberSignups(tenant.id, [
      {
        ...existing,
        status: input.status,
        ownerNotes: input.ownerNotes ?? existing.ownerNotes,
        approvedMemberId: input.approvedMemberId ?? existing.approvedMemberId,
        updatedAt: now,
      },
    ])[0]!;
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                memberSignups: normalizeTenantMemberSignups(
                  entry.id,
                  entry.moduleData.memberSignups.map((signup) =>
                    signup.id === input.id ? nextSignup : signup,
                  ),
                ),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextSignup;
  });
}

export async function createLocalTenantBillingInvoice(
  tenantId: string,
  input: CreateLocalTenantBillingInvoiceInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je invoices toevoegt.",
      "Gym niet gevonden voor billing backoffice.",
    );
    const now = new Date().toISOString();
    const invoice = normalizeBillingBackofficeData(tenant.id, {
      invoices: [
        {
          id: invoiceIdGenerator.next(),
          tenantId: tenant.id,
          memberId: input.memberId,
          memberName: input.memberName,
          description: input.description,
          amountCents: input.amountCents,
          currency: input.currency ?? "EUR",
          dueAt: input.dueAt,
          issuedAt: now,
          status: "open",
          source: input.source,
          retryCount: 0,
          externalReference: input.externalReference,
        },
      ],
    }).invoices[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                billingBackoffice: normalizeBillingBackofficeData(entry.id, {
                  ...entry.moduleData.billingBackoffice,
                  invoices: [...entry.moduleData.billingBackoffice.invoices, invoice],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return invoice;
  });
}

export async function updateLocalTenantBillingInvoice(
  tenantId: string,
  input: UpdateLocalTenantBillingInvoiceInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je invoices bijwerkt.",
      "Gym niet gevonden voor billing backoffice.",
    );
    const existing = tenant.moduleData.billingBackoffice.invoices.find(
      (entry) => entry.id === input.id,
    );

    if (!existing) {
      throw new AppError("Invoice niet gevonden.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId, invoiceId: input.id },
      });
    }

    const nextInvoice = normalizeBillingBackofficeData(tenant.id, {
      invoices: [
        {
          ...existing,
          status: input.status,
          retryCount: input.retryCount ?? existing.retryCount,
          paidAt: input.paidAt ?? existing.paidAt,
          refundedAt: input.refundedAt ?? existing.refundedAt,
          lastWebhookEventType: input.lastWebhookEventType ?? existing.lastWebhookEventType,
          externalReference: input.externalReference ?? existing.externalReference,
        },
      ],
    }).invoices[0]!;
    const paidReceipt =
      nextInvoice.status === "paid" && nextInvoice.paidAt
        ? {
            invoiceId: nextInvoice.id,
            memberId: nextInvoice.memberId,
            memberName: nextInvoice.memberName,
            description: nextInvoice.description,
            amountCents: nextInvoice.amountCents,
            currency: nextInvoice.currency,
            paidAt: nextInvoice.paidAt,
          }
        : null;
    const now = new Date().toISOString();
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) => {
        if (entry.id !== tenantId) {
          return entry;
        }

        const receipts = paidReceipt
          ? normalizeMobileSelfServiceData(entry.id, {
              ...entry.moduleData.mobileSelfService,
              receipts: [
                ...entry.moduleData.mobileSelfService.receipts.filter(
                  (receipt) => receipt.invoiceId !== nextInvoice.id,
                ),
                paidReceipt,
              ],
            }).receipts
          : entry.moduleData.mobileSelfService.receipts;

        return {
          ...entry,
          updatedAt: now,
          moduleData: {
            ...entry.moduleData,
            billingBackoffice: normalizeBillingBackofficeData(entry.id, {
              ...entry.moduleData.billingBackoffice,
              invoices: entry.moduleData.billingBackoffice.invoices.map((invoice) =>
                invoice.id === input.id ? nextInvoice : invoice,
              ),
            }),
            mobileSelfService: normalizeMobileSelfServiceData(entry.id, {
              ...entry.moduleData.mobileSelfService,
              receipts,
            }),
          },
        };
      }),
    };

    await persistState(nextState);
    return nextInvoice;
  });
}

export async function createLocalTenantBillingRefund(
  tenantId: string,
  input: CreateLocalTenantBillingRefundInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je refunds toevoegt.",
      "Gym niet gevonden voor billing backoffice.",
    );
    const now = new Date().toISOString();
    const refund = normalizeBillingBackofficeData(tenant.id, {
      refunds: [
        {
          id: refundIdGenerator.next(),
          tenantId: tenant.id,
          invoiceId: input.invoiceId,
          amountCents: input.amountCents,
          reason: input.reason,
          status: input.status,
          requestedAt: now,
          processedAt: input.status === "processed" ? now : undefined,
        },
      ],
    }).refunds[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                billingBackoffice: normalizeBillingBackofficeData(entry.id, {
                  ...entry.moduleData.billingBackoffice,
                  refunds: [...entry.moduleData.billingBackoffice.refunds, refund],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return refund;
  });
}

export async function createLocalTenantBillingWebhook(
  tenantId: string,
  input: CreateLocalTenantBillingWebhookInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je webhooks toevoegt.",
      "Gym niet gevonden voor billing backoffice.",
    );
    const now = new Date().toISOString();
    const webhook = normalizeBillingBackofficeData(tenant.id, {
      webhooks: [
        {
          id: webhookIdGenerator.next(),
          tenantId: tenant.id,
          invoiceId: input.invoiceId,
          eventType: input.eventType,
          status: input.status,
          providerReference: input.providerReference,
          payloadSummary: input.payloadSummary,
          receivedAt: now,
          processedAt: input.status === "processed" ? now : undefined,
        },
      ],
    }).webhooks[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                billingBackoffice: normalizeBillingBackofficeData(entry.id, {
                  ...entry.moduleData.billingBackoffice,
                  webhooks: [...entry.moduleData.billingBackoffice.webhooks, webhook],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return webhook;
  });
}

export async function createLocalTenantBillingReconciliationRun(
  tenantId: string,
  input: CreateLocalTenantBillingReconciliationRunInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je reconciliatie draait.",
      "Gym niet gevonden voor billing backoffice.",
    );
    const now = new Date().toISOString();
    const run = normalizeBillingBackofficeData(tenant.id, {
      reconciliationRuns: [
        {
          id: reconciliationIdGenerator.next(),
          tenantId: tenant.id,
          note: input.note,
          matchedInvoiceIds: input.matchedInvoiceIds,
          unmatchedInvoiceIds: input.unmatchedInvoiceIds,
          totalInvoices: input.matchedInvoiceIds.length + input.unmatchedInvoiceIds.length,
          status: input.unmatchedInvoiceIds.length === 0 ? "balanced" : "attention",
          createdAt: now,
        },
      ],
    }).reconciliationRuns[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                billingBackoffice: normalizeBillingBackofficeData(entry.id, {
                  ...entry.moduleData.billingBackoffice,
                  reconciliationRuns: [
                    ...entry.moduleData.billingBackoffice.reconciliationRuns,
                    run,
                  ],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return run;
  });
}

export async function createLocalTenantLeadTask(
  tenantId: string,
  input: CreateLocalTenantLeadTaskInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je lead taken toevoegt.",
      "Gym niet gevonden voor lead automation.",
    );
    const now = new Date().toISOString();
    const task = normalizeLeadAutomationData(tenant.id, {
      tasks: [
        {
          id: leadTaskIdGenerator.next(),
          tenantId: tenant.id,
          type: input.type,
          title: input.title,
          dueAt: input.dueAt,
          status: "open",
          source: input.source,
          leadId: input.leadId,
          memberId: input.memberId,
          bookingId: input.bookingId,
          notes: input.notes,
          assignedStaffName: input.assignedStaffName,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }).tasks[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                leadAutomation: normalizeLeadAutomationData(entry.id, {
                  ...entry.moduleData.leadAutomation,
                  tasks: [...entry.moduleData.leadAutomation.tasks, task],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return task;
  });
}

export async function updateLocalTenantLeadTask(
  tenantId: string,
  input: UpdateLocalTenantLeadTaskInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je lead taken bijwerkt.",
      "Gym niet gevonden voor lead automation.",
    );
    const existing = tenant.moduleData.leadAutomation.tasks.find((entry) => entry.id === input.id);

    if (!existing) {
      throw new AppError("Lead taak niet gevonden.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId, taskId: input.id },
      });
    }

    const now = new Date().toISOString();
    const state = current ?? createEmptyState();
    const task = normalizeLeadAutomationData(tenant.id, {
      tasks: [
        {
          ...existing,
          status: input.status,
          notes: input.notes ?? existing.notes,
          updatedAt: now,
        },
      ],
    }).tasks[0]!;
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                leadAutomation: normalizeLeadAutomationData(entry.id, {
                  ...entry.moduleData.leadAutomation,
                  tasks: entry.moduleData.leadAutomation.tasks.map((item) =>
                    item.id === input.id ? task : item,
                  ),
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return task;
  });
}

export async function createLocalTenantLeadAttribution(
  tenantId: string,
  input: CreateLocalTenantLeadAttributionInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je attributie toevoegt.",
      "Gym niet gevonden voor lead automation.",
    );
    const now = new Date().toISOString();
    const attribution = normalizeLeadAutomationData(tenant.id, {
      attributions: [
        {
          id: attributionIdGenerator.next(),
          tenantId: tenant.id,
          leadId: input.leadId,
          source: input.source,
          campaignLabel: input.campaignLabel,
          medium: input.medium,
          createdAt: now,
        },
      ],
    }).attributions[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                leadAutomation: normalizeLeadAutomationData(entry.id, {
                  ...entry.moduleData.leadAutomation,
                  attributions: [...entry.moduleData.leadAutomation.attributions, attribution],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return attribution;
  });
}

export async function createLocalTenantLeadAutomationRun(
  tenantId: string,
  input: CreateLocalTenantLeadAutomationRunInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je automations draait.",
      "Gym niet gevonden voor lead automation.",
    );
    const now = new Date().toISOString();
    const run = normalizeLeadAutomationData(tenant.id, {
      runs: [
        {
          id: leadRunIdGenerator.next(),
          tenantId: tenant.id,
          trigger: input.trigger,
          createdTasks: input.createdTasks,
          createdAt: now,
        },
      ],
      lastRunAt: now,
    }).runs[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                leadAutomation: normalizeLeadAutomationData(entry.id, {
                  ...entry.moduleData.leadAutomation,
                  runs: [...entry.moduleData.leadAutomation.runs, run],
                  lastRunAt: now,
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return run;
  });
}

export async function createLocalTenantAppointmentPack(
  tenantId: string,
  input: CreateLocalTenantAppointmentPackInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je strippenkaarten toevoegt.",
      "Gym niet gevonden voor appointments.",
    );
    const now = new Date().toISOString();
    const pack = normalizeAppointmentData(tenant.id, {
      creditPacks: [
        {
          id: appointmentPackIdGenerator.next(),
          tenantId: tenant.id,
          memberId: input.memberId,
          memberName: input.memberName,
          trainerId: input.trainerId,
          title: input.title,
          totalCredits: input.totalCredits,
          remainingCredits: input.remainingCredits,
          validUntil: input.validUntil,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }).creditPacks[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                appointments: normalizeAppointmentData(entry.id, {
                  ...entry.moduleData.appointments,
                  creditPacks: [...entry.moduleData.appointments.creditPacks, pack],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return pack;
  });
}

export async function updateLocalTenantAppointmentPack(
  tenantId: string,
  input: UpdateLocalTenantAppointmentPackInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je strippenkaarten bijwerkt.",
      "Gym niet gevonden voor appointments.",
    );
    const existing = tenant.moduleData.appointments.creditPacks.find((entry) => entry.id === input.id);

    if (!existing) {
      throw new AppError("Strippenkaart niet gevonden.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId, packId: input.id },
      });
    }

    const now = new Date().toISOString();
    const state = current ?? createEmptyState();
    const pack = normalizeAppointmentData(tenant.id, {
      creditPacks: [
        {
          ...existing,
          remainingCredits: input.remainingCredits,
          updatedAt: now,
        },
      ],
    }).creditPacks[0]!;
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                appointments: normalizeAppointmentData(entry.id, {
                  ...entry.moduleData.appointments,
                  creditPacks: entry.moduleData.appointments.creditPacks.map((item) =>
                    item.id === input.id ? pack : item,
                  ),
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return pack;
  });
}

export async function createLocalTenantCoachAppointments(
  tenantId: string,
  input: ReadonlyArray<CreateLocalTenantCoachAppointmentInput>,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je appointments toevoegt.",
      "Gym niet gevonden voor appointments.",
    );
    const now = new Date().toISOString();
    const appointments = normalizeAppointmentData(tenant.id, {
      sessions: input.map((appointment) => ({
        id: coachAppointmentIdGenerator.next(),
        tenantId: tenant.id,
        trainerId: appointment.trainerId,
        trainerName: appointment.trainerName,
        memberId: appointment.memberId,
        memberName: appointment.memberName,
        locationId: appointment.locationId,
        startsAt: appointment.startsAt,
        durationMinutes: appointment.durationMinutes,
        status: appointment.status,
        recurrence: appointment.recurrence,
        seriesId: appointment.seriesId,
        creditPackId: appointment.creditPackId,
        notes: appointment.notes,
        createdAt: now,
        updatedAt: now,
      })),
    }).sessions;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                appointments: normalizeAppointmentData(entry.id, {
                  ...entry.moduleData.appointments,
                  sessions: [...entry.moduleData.appointments.sessions, ...appointments],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return appointments;
  });
}

export async function createLocalTenantCommunityGroup(
  tenantId: string,
  input: CreateLocalTenantCommunityGroupInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je community groups toevoegt.",
      "Gym niet gevonden voor community data.",
    );
    const now = new Date().toISOString();
    const group = normalizeCommunityData(tenant.id, {
      groups: [
        {
          id: communityGroupIdGenerator.next(),
          tenantId: tenant.id,
          name: input.name,
          channel: input.channel,
          description: input.description,
          memberIds: input.memberIds,
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
    }).groups[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                community: normalizeCommunityData(entry.id, {
                  ...entry.moduleData.community,
                  groups: [...entry.moduleData.community.groups, group],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return group;
  });
}

export async function createLocalTenantChallenge(
  tenantId: string,
  input: CreateLocalTenantChallengeInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je challenges toevoegt.",
      "Gym niet gevonden voor community data.",
    );
    const now = new Date().toISOString();
    const challenge = normalizeCommunityData(tenant.id, {
      challenges: [
        {
          id: challengeIdGenerator.next(),
          tenantId: tenant.id,
          title: input.title,
          rewardLabel: input.rewardLabel,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          participantMemberIds: input.participantMemberIds,
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
    }).challenges[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                community: normalizeCommunityData(entry.id, {
                  ...entry.moduleData.community,
                  challenges: [...entry.moduleData.community.challenges, challenge],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return challenge;
  });
}

export async function createLocalTenantQuestionnaire(
  tenantId: string,
  input: CreateLocalTenantQuestionnaireInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je questionnaires toevoegt.",
      "Gym niet gevonden voor community data.",
    );
    const now = new Date().toISOString();
    const questionnaire = normalizeCommunityData(tenant.id, {
      questionnaires: [
        {
          id: questionnaireIdGenerator.next(),
          tenantId: tenant.id,
          title: input.title,
          trigger: input.trigger,
          questions: input.questions,
          responseCount: 0,
          status: "live",
          createdAt: now,
          updatedAt: now,
        },
      ],
    }).questionnaires[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                community: normalizeCommunityData(entry.id, {
                  ...entry.moduleData.community,
                  questionnaires: [...entry.moduleData.community.questionnaires, questionnaire],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return questionnaire;
  });
}

export async function createLocalTenantQuestionnaireResponse(
  tenantId: string,
  input: CreateLocalTenantQuestionnaireResponseInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je questionnaire responses toevoegt.",
      "Gym niet gevonden voor community data.",
    );
    const now = new Date().toISOString();
    const response = normalizeCommunityData(tenant.id, {
      responses: [
        {
          id: questionnaireResponseIdGenerator.next(),
          tenantId: tenant.id,
          questionnaireId: input.questionnaireId,
          memberId: input.memberId,
          memberName: input.memberName,
          answers: input.answers,
          submittedAt: now,
        },
      ],
      questionnaires: tenant.moduleData.community.questionnaires,
    }).responses[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                community: normalizeCommunityData(entry.id, {
                  ...entry.moduleData.community,
                  responses: [...entry.moduleData.community.responses, response],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return response;
  });
}

export async function createLocalTenantPaymentMethodRequest(
  tenantId: string,
  input: CreateLocalTenantPaymentMethodRequestInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je payment method requests toevoegt.",
      "Gym niet gevonden voor mobile self-service.",
    );
    const now = new Date().toISOString();
    const request = normalizeMobileSelfServiceData(tenant.id, {
      paymentMethodRequests: [
        {
          id: paymentMethodRequestIdGenerator.next(),
          tenantId: tenant.id,
          memberId: input.memberId,
          memberName: input.memberName,
          requestedMethodLabel: input.requestedMethodLabel,
          note: input.note,
          status: "pending",
          requestedAt: now,
        },
      ],
    }).paymentMethodRequests[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                mobileSelfService: normalizeMobileSelfServiceData(entry.id, {
                  ...entry.moduleData.mobileSelfService,
                  paymentMethodRequests: [
                    ...entry.moduleData.mobileSelfService.paymentMethodRequests,
                    request,
                  ],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return request;
  });
}

export async function reviewLocalTenantPaymentMethodRequest(
  tenantId: string,
  input: ReviewLocalTenantPaymentMethodRequestInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je payment method requests beoordeelt.",
      "Gym niet gevonden voor mobile self-service.",
    );
    const existing = tenant.moduleData.mobileSelfService.paymentMethodRequests.find(
      (entry) => entry.id === input.id,
    );

    if (!existing) {
      throw new AppError("Payment method request niet gevonden.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId, requestId: input.id },
      });
    }

    const now = new Date().toISOString();
    const state = current ?? createEmptyState();
    const request = normalizeMobileSelfServiceData(tenant.id, {
      paymentMethodRequests: [
        {
          ...existing,
          status: input.status,
          ownerNotes: input.ownerNotes ?? existing.ownerNotes,
          reviewedAt: now,
        },
      ],
    }).paymentMethodRequests[0]!;
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                mobileSelfService: normalizeMobileSelfServiceData(entry.id, {
                  ...entry.moduleData.mobileSelfService,
                  paymentMethodRequests: entry.moduleData.mobileSelfService.paymentMethodRequests.map(
                    (item) => (item.id === input.id ? request : item),
                  ),
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return request;
  });
}

export async function createLocalTenantPauseRequest(
  tenantId: string,
  input: CreateLocalTenantPauseRequestInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je pause requests toevoegt.",
      "Gym niet gevonden voor mobile self-service.",
    );
    const now = new Date().toISOString();
    const request = normalizeMobileSelfServiceData(tenant.id, {
      pauseRequests: [
        {
          id: pauseRequestIdGenerator.next(),
          tenantId: tenant.id,
          memberId: input.memberId,
          memberName: input.memberName,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          reason: input.reason,
          status: "pending",
          requestedAt: now,
        },
      ],
    }).pauseRequests[0]!;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                mobileSelfService: normalizeMobileSelfServiceData(entry.id, {
                  ...entry.moduleData.mobileSelfService,
                  pauseRequests: [...entry.moduleData.mobileSelfService.pauseRequests, request],
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return request;
  });
}

export async function reviewLocalTenantPauseRequest(
  tenantId: string,
  input: ReviewLocalTenantPauseRequestInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je pause requests beoordeelt.",
      "Gym niet gevonden voor mobile self-service.",
    );
    const existing = tenant.moduleData.mobileSelfService.pauseRequests.find(
      (entry) => entry.id === input.id,
    );

    if (!existing) {
      throw new AppError("Pause request niet gevonden.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId, requestId: input.id },
      });
    }

    const now = new Date().toISOString();
    const state = current ?? createEmptyState();
    const request = normalizeMobileSelfServiceData(tenant.id, {
      pauseRequests: [
        {
          ...existing,
          status: input.status,
          ownerNotes: input.ownerNotes ?? existing.ownerNotes,
          reviewedAt: now,
        },
      ],
    }).pauseRequests[0]!;
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                mobileSelfService: normalizeMobileSelfServiceData(entry.id, {
                  ...entry.moduleData.mobileSelfService,
                  pauseRequests: entry.moduleData.mobileSelfService.pauseRequests.map((item) =>
                    item.id === input.id ? request : item,
                  ),
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return request;
  });
}

export async function createLocalTenantContractRecord(
  tenantId: string,
  input: CreateLocalTenantContractRecordInput,
) {
  return withStateMutation(async (current) => {
    const tenant = requireTenantForMutation(
      current,
      tenantId,
      "Richt eerst het platform in voordat je contractrecords toevoegt.",
      "Gym niet gevonden voor mobile self-service.",
    );
    const now = new Date().toISOString();
    const contract = normalizeMobileSelfServiceData(tenant.id, {
      contracts: [
        {
          id: contractRecordIdGenerator.next(),
          tenantId: tenant.id,
          memberId: input.memberId,
          memberName: input.memberName,
          membershipPlanId: input.membershipPlanId,
          contractName: input.contractName,
          documentLabel: input.documentLabel,
          documentUrl: input.documentUrl,
          status: input.status,
          signedAt: input.signedAt,
          updatedAt: now,
        },
      ],
    }).contracts[0]!;
    const nextContracts = normalizeMobileSelfServiceData(tenant.id, {
      ...tenant.moduleData.mobileSelfService,
      contracts: [
        ...tenant.moduleData.mobileSelfService.contracts.filter(
          (entry) => entry.memberId !== input.memberId,
        ),
        contract,
      ],
    }).contracts;
    const state = current ?? createEmptyState();
    const nextState: LocalPlatformState = {
      ...state,
      tenants: state.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleData: {
                ...entry.moduleData,
                mobileSelfService: normalizeMobileSelfServiceData(entry.id, {
                  ...entry.moduleData.mobileSelfService,
                  contracts: nextContracts,
                }),
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return contract;
  });
}

export async function updateLocalTenantBookingPolicy(
  tenantId: string,
  input: UpdateLocalTenantBookingPolicyInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je bookingbeleid opslaat.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor bookingbeleid.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextBookingPolicy = normalizeBookingPolicySettings({
      ...tenant.bookingPolicy,
      ...input,
      lastUpdatedAt: now,
    });

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              bookingPolicy: nextBookingPolicy,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantBookingSettings(
  tenantId: string,
  input: UpdateLocalTenantBookingSettingsInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je bookinginstellingen opslaat.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor bookinginstellingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextBooking = normalizeBookingWorkspaceSettings({
      ...tenant.moduleSettings.booking,
      ...input,
      lastUpdatedAt: now,
    });

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleSettings: {
                ...entry.moduleSettings,
                booking: nextBooking,
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantRevenueSettings(
  tenantId: string,
  input: UpdateLocalTenantRevenueSettingsInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je omzetinstellingen opslaat.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor omzetinstellingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextRevenue = normalizeRevenueWorkspaceSettings({
      ...tenant.moduleSettings.revenue,
      ...input,
      lastUpdatedAt: now,
    });

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleSettings: {
                ...entry.moduleSettings,
                revenue: nextRevenue,
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantCoachingSettings(
  tenantId: string,
  input: UpdateLocalTenantCoachingSettingsInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je coaching instelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor coachinginstellingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextCoaching = normalizeCoachingWorkspaceSettings({
      ...tenant.moduleSettings.coaching,
      ...input,
      lastUpdatedAt: now,
    });

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleSettings: {
                ...entry.moduleSettings,
                coaching: nextCoaching,
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantRetentionSettings(
  tenantId: string,
  input: UpdateLocalTenantRetentionSettingsInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je retentie instelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor retentie-instellingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextRetention = normalizeRetentionWorkspaceSettings({
      ...tenant.moduleSettings.retention,
      ...input,
      lastUpdatedAt: now,
    });

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleSettings: {
                ...entry.moduleSettings,
                retention: nextRetention,
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantMobileSettings(
  tenantId: string,
  input: UpdateLocalTenantMobileSettingsInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je mobile instelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor mobile-instellingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextMobile = normalizeMobileExperienceSettings({
      ...tenant.moduleSettings.mobile,
      ...input,
      lastUpdatedAt: now,
    });

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleSettings: {
                ...entry.moduleSettings,
                mobile: nextMobile,
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantMarketingSettings(
  tenantId: string,
  input: UpdateLocalTenantMarketingSettingsInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je marketing instelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor marketinginstellingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextMarketing = normalizeMarketingWorkspaceSettings({
      ...tenant.moduleSettings.marketing,
      ...input,
      lastUpdatedAt: now,
    });

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleSettings: {
                ...entry.moduleSettings,
                marketing: nextMarketing,
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantIntegrationSettings(
  tenantId: string,
  input: UpdateLocalTenantIntegrationSettingsInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je integraties instelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor integratie-instellingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextIntegrations = normalizeIntegrationWorkspaceSettings({
      ...tenant.moduleSettings.integrations,
      ...input,
      lastUpdatedAt: now,
    });

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              moduleSettings: {
                ...entry.moduleSettings,
                integrations: nextIntegrations,
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantLegalSettings(
  tenantId: string,
  input: UpdateLocalTenantLegalSettingsInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je juridische instellingen opslaat.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor juridische instellingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextLegalBase = normalizeLegalComplianceSettings({
      ...tenant.legal,
      ...input,
      lastValidatedAt: tenant.legal.lastValidatedAt,
    });
    const nextLegal: StoredLegalComplianceSettings = {
      ...nextLegalBase,
      lastValidatedAt:
        nextLegalBase.termsUrl &&
        nextLegalBase.privacyUrl &&
        nextLegalBase.sepaCreditorId &&
        nextLegalBase.sepaMandateText &&
        nextLegalBase.contractPdfTemplateKey &&
        nextLegalBase.waiverStorageKey
          ? now
          : undefined,
    };

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              legal: nextLegal,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function markLocalTenantRemoteAccessAction(
  tenantId: string,
  actorName: string,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je remote toegang gebruikt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor remote toegang.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              remoteAccess: {
                ...entry.remoteAccess,
                lastRemoteActionAt: now,
                lastRemoteActionBy: actorName,
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function markLocalTenantBillingAction(
  tenantId: string,
  actorName: string,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je betalingen gebruikt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor betalingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              billing: {
                ...entry.billing,
                lastPaymentActionAt: now,
                lastPaymentActionBy: actorName,
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalPlatformData(
  update: (data: MemoryGymStoreState) => MemoryGymStoreState,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je data opslaat.", {
        code: "FORBIDDEN",
      });
    }

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((tenant) => ({
        ...tenant,
        updatedAt: now,
      })),
      data: update(current.data),
    };

    await persistState(nextState);
    return nextState;
  });
}
