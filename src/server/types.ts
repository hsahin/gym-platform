import type { SupportedPhoneCountryCode } from "@claimtech/i18n";
import type { AuditEntry, SystemHealthReport } from "@claimtech/ops";
import type { TenantId } from "@claimtech/tenant";

export type EntityStatus = "active" | "paused" | "archived";
export type MemberStatus = "active" | "trial" | "paused" | "archived";
export type BookingStatus = "confirmed" | "waitlisted" | "checked_in" | "cancelled";
export type BookingSource = "frontdesk" | "coach" | "member_app";
export type AttendanceChannel = "qr" | "frontdesk" | "coach";
export type RemoteAccessProvider = "nuki" | "salto_ks" | "tedee" | "yale_smart";
export type RemoteAccessBridgeType = "cloud_api" | "bridge" | "hub";
export type RemoteAccessConnectionStatus = "not_configured" | "configured" | "attention";
export type BillingProvider = "mollie";
export type BillingPaymentMethod = "direct_debit" | "one_time" | "payment_request";
export type BillingConnectionStatus = "not_configured" | "configured" | "attention";
export type LeadSource =
  | "website"
  | "instagram"
  | "referral"
  | "walk_in"
  | "meta_ads"
  | "booking";
export type LeadStage = "new" | "contacted" | "trial_scheduled" | "won" | "lost";
export type CollectionCaseStatus = "open" | "retrying" | "resolved" | "cancelled";
export type CollectionCasePaymentMethod = BillingPaymentMethod | "cash" | "bank_transfer";
export type MemberSignupStatus = "pending_review" | "approved" | "rejected";
export type BillingInvoiceStatus = "draft" | "open" | "paid" | "failed" | "refunded";
export type BillingInvoiceSource =
  | "membership"
  | "signup_checkout"
  | "appointment_pack"
  | "late_fee"
  | "manual";
export type BillingRefundStatus = "pending" | "processed" | "failed";
export type BillingWebhookEventStatus = "received" | "processed" | "failed";
export type BillingReconciliationStatus = "balanced" | "attention";
export type LeadTaskType = "nurture" | "abandoned_booking" | "follow_up";
export type LeadTaskStatus = "open" | "done" | "cancelled";
export type LeadAutomationTrigger = "manual" | "schedule" | "booking_cancellation";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled";
export type AppointmentRecurrence = "none" | "weekly";
export type CommunityGroupStatus = "active" | "archived";
export type ChallengeStatus = "draft" | "active" | "completed" | "archived";
export type QuestionnaireStatus = "draft" | "live" | "closed";
export type ReviewRequestStatus = "pending" | "approved" | "rejected";

export interface VersionedEntity {
  readonly id: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TenantOwnedEntity extends VersionedEntity {
  readonly tenantId: TenantId;
}

export interface GymLocation extends TenantOwnedEntity {
  readonly name: string;
  readonly city: string;
  readonly neighborhood: string;
  readonly capacity: number;
  readonly amenities: ReadonlyArray<string>;
  readonly managerName: string;
  readonly status: EntityStatus;
}

export interface MembershipPlan extends TenantOwnedEntity {
  readonly name: string;
  readonly priceMonthly: number;
  readonly currency: string;
  readonly billingCycle: "monthly" | "semiannual" | "annual";
  readonly perks: ReadonlyArray<string>;
  readonly activeMembers: number;
  readonly status: EntityStatus;
}

export interface GymMember extends TenantOwnedEntity {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly phoneCountry: SupportedPhoneCountryCode;
  readonly membershipPlanId: string;
  readonly homeLocationId: string;
  readonly joinedAt: string;
  readonly nextRenewalAt: string;
  readonly status: MemberStatus;
  readonly tags: ReadonlyArray<string>;
  readonly waiverStatus: "complete" | "pending";
}

export interface GymTrainer extends TenantOwnedEntity {
  readonly fullName: string;
  readonly specialties: ReadonlyArray<string>;
  readonly certifications: ReadonlyArray<string>;
  readonly homeLocationId: string;
  readonly classIds: ReadonlyArray<string>;
  readonly status: "active" | "away" | "archived";
}

export interface ClassSession extends TenantOwnedEntity {
  readonly title: string;
  readonly locationId: string;
  readonly trainerId: string;
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly capacity: number;
  readonly bookedCount: number;
  readonly waitlistCount: number;
  readonly level: "beginner" | "mixed" | "advanced";
  readonly focus: string;
  readonly status: EntityStatus;
}

export interface ClassBooking extends TenantOwnedEntity {
  readonly classSessionId: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly phone: string;
  readonly phoneCountry: SupportedPhoneCountryCode;
  readonly status: BookingStatus;
  readonly source: BookingSource;
  readonly idempotencyKey: string;
  readonly notes?: string;
}

export interface AttendanceRecord extends TenantOwnedEntity {
  readonly classSessionId: string;
  readonly bookingId: string;
  readonly memberId: string;
  readonly checkedInAt: string;
  readonly channel: AttendanceChannel;
}

export interface WaiverRecord extends TenantOwnedEntity {
  readonly memberId: string;
  readonly memberName: string;
  readonly status: "signed" | "requested" | "expired";
  readonly uploadedAt?: string;
  readonly fileName?: string;
  readonly storageKey?: string;
  readonly expiresAt?: string;
}

export interface GymLead {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly source: LeadSource;
  readonly stage: LeadStage;
  readonly interest: string;
  readonly notes?: string;
  readonly assignedStaffName?: string;
  readonly expectedValueCents?: number;
  readonly convertedMemberId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CollectionCase {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly memberId?: string;
  readonly memberName: string;
  readonly paymentMethod: CollectionCasePaymentMethod;
  readonly status: CollectionCaseStatus;
  readonly amountCents: number;
  readonly reason: string;
  readonly dueAt: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MemberSignupRequest {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly phoneCountry: SupportedPhoneCountryCode;
  readonly membershipPlanId: string;
  readonly preferredLocationId: string;
  readonly paymentMethod: BillingPaymentMethod;
  readonly contractAcceptedAt: string;
  readonly waiverAcceptedAt: string;
  readonly status: MemberSignupStatus;
  readonly notes?: string;
  readonly ownerNotes?: string;
  readonly approvedMemberId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublicMembershipSignupResult {
  readonly signup: MemberSignupRequest;
  readonly member: GymMember;
  readonly invoice: BillingInvoice;
  readonly contract: MemberContractRecord | null;
  readonly checkoutUrl: string;
  readonly providerPaymentId: string;
  readonly providerStatus: string;
}

export interface BillingInvoice {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly memberId?: string;
  readonly memberName: string;
  readonly description: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly dueAt: string;
  readonly issuedAt: string;
  readonly status: BillingInvoiceStatus;
  readonly source: BillingInvoiceSource;
  readonly retryCount: number;
  readonly paidAt?: string;
  readonly refundedAt?: string;
  readonly lastWebhookEventType?: string;
  readonly externalReference?: string;
}

export interface BillingRefund {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly invoiceId: string;
  readonly amountCents: number;
  readonly reason: string;
  readonly status: BillingRefundStatus;
  readonly requestedAt: string;
  readonly processedAt?: string;
}

export interface BillingWebhookEvent {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly invoiceId: string;
  readonly eventType: string;
  readonly status: BillingWebhookEventStatus;
  readonly providerReference: string;
  readonly payloadSummary: string;
  readonly receivedAt: string;
  readonly processedAt?: string;
}

export interface BillingReconciliationRun {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly note?: string;
  readonly matchedInvoiceIds: ReadonlyArray<string>;
  readonly unmatchedInvoiceIds: ReadonlyArray<string>;
  readonly totalInvoices: number;
  readonly status: BillingReconciliationStatus;
  readonly createdAt: string;
}

export interface BillingBackofficeSummary {
  readonly invoices: ReadonlyArray<BillingInvoice>;
  readonly refunds: ReadonlyArray<BillingRefund>;
  readonly webhooks: ReadonlyArray<BillingWebhookEvent>;
  readonly reconciliationRuns: ReadonlyArray<BillingReconciliationRun>;
}

export interface LeadFollowUpTask {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly type: LeadTaskType;
  readonly title: string;
  readonly dueAt: string;
  readonly status: LeadTaskStatus;
  readonly source: LeadSource | "system";
  readonly leadId?: string;
  readonly memberId?: string;
  readonly bookingId?: string;
  readonly notes?: string;
  readonly assignedStaffName?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LeadAttributionRecord {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly leadId?: string;
  readonly source: LeadSource;
  readonly campaignLabel: string;
  readonly medium: string;
  readonly createdAt: string;
}

export interface LeadAutomationRun {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly trigger: LeadAutomationTrigger;
  readonly createdTasks: number;
  readonly createdAt: string;
}

export interface LeadAutomationSummary {
  readonly tasks: ReadonlyArray<LeadFollowUpTask>;
  readonly attributions: ReadonlyArray<LeadAttributionRecord>;
  readonly runs: ReadonlyArray<LeadAutomationRun>;
  readonly lastRunAt?: string;
}

export interface AppointmentCreditPack {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly memberId: string;
  readonly memberName: string;
  readonly trainerId: string;
  readonly title: string;
  readonly totalCredits: number;
  readonly remainingCredits: number;
  readonly validUntil: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CoachAppointment {
  readonly id: string;
  readonly tenantId: TenantId;
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
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppointmentSummary {
  readonly creditPacks: ReadonlyArray<AppointmentCreditPack>;
  readonly sessions: ReadonlyArray<CoachAppointment>;
}

export interface CommunityGroup {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly channel: string;
  readonly description: string;
  readonly memberIds: ReadonlyArray<string>;
  readonly status: CommunityGroupStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MemberChallenge {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly rewardLabel: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly participantMemberIds: ReadonlyArray<string>;
  readonly status: ChallengeStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QuestionnaireRecord {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly trigger: string;
  readonly questions: ReadonlyArray<string>;
  readonly responseCount: number;
  readonly status: QuestionnaireStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QuestionnaireResponse {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly questionnaireId: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly answers: ReadonlyArray<string>;
  readonly submittedAt: string;
}

export interface CommunitySummary {
  readonly groups: ReadonlyArray<CommunityGroup>;
  readonly challenges: ReadonlyArray<MemberChallenge>;
  readonly questionnaires: ReadonlyArray<QuestionnaireRecord>;
  readonly responses: ReadonlyArray<QuestionnaireResponse>;
}

export interface MobileReceipt {
  readonly invoiceId: string;
  readonly memberId?: string;
  readonly memberName: string;
  readonly description: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly paidAt: string;
}

export interface MobilePaymentMethodRequest {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly memberId: string;
  readonly memberName: string;
  readonly requestedMethodLabel: string;
  readonly note?: string;
  readonly ownerNotes?: string;
  readonly status: ReviewRequestStatus;
  readonly requestedAt: string;
  readonly reviewedAt?: string;
}

export interface MembershipPauseRequest {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly memberId: string;
  readonly memberName: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string;
  readonly ownerNotes?: string;
  readonly status: ReviewRequestStatus;
  readonly requestedAt: string;
  readonly reviewedAt?: string;
}

export interface MemberContractRecord {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly memberId: string;
  readonly memberName: string;
  readonly membershipPlanId: string;
  readonly contractName: string;
  readonly documentLabel: string;
  readonly documentUrl: string;
  readonly status: "active" | "archived";
  readonly signedAt: string;
  readonly updatedAt: string;
}

export interface MobileSelfServiceSummary {
  readonly receipts: ReadonlyArray<MobileReceipt>;
  readonly paymentMethodRequests: ReadonlyArray<MobilePaymentMethodRequest>;
  readonly pauseRequests: ReadonlyArray<MembershipPauseRequest>;
  readonly contracts: ReadonlyArray<MemberContractRecord>;
}

export interface BookingPolicySummary {
  readonly cancellationWindowHours: number;
  readonly lateCancelFeeCents: number;
  readonly noShowFeeCents: number;
  readonly maxDailyBookingsPerMember: number;
  readonly maxDailyWaitlistPerMember: number;
  readonly autoPromoteWaitlist: boolean;
  readonly lastUpdatedAt?: string;
}

export interface FeatureState {
  readonly key: string;
  readonly title: string;
  readonly categoryKey: string;
  readonly categoryTitle: string;
  readonly dashboardPage: string;
  readonly enabled: boolean;
  readonly reason: string;
  readonly description: string;
  readonly statusLabel: "Live" | "Expanded" | "New";
  readonly badgeLabel?: "NEW";
}

export interface DashboardMetric {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
  readonly tone: "default" | "success" | "warning" | "info";
}

export interface StaffSummary {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly status: string;
  readonly roles: ReadonlyArray<string>;
  readonly roleKey?: string;
  readonly updatedAt?: string;
}

export interface SuperadminOwnerAccountSummary {
  readonly id: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly displayName: string;
  readonly email: string;
  readonly status: "active" | "archived";
  readonly roleKey: "owner";
  readonly updatedAt: string;
}

export interface SuperadminSummary {
  readonly tenantsCount: number;
  readonly activeOwnerAccounts: number;
  readonly archivedOwnerAccounts: number;
  readonly ownerAccounts: ReadonlyArray<SuperadminOwnerAccountSummary>;
}

export interface RuntimeState {
  readonly storeMode: "memory" | "mongo";
  readonly cacheMode: "memory" | "redis";
  readonly messagingMode: "not_configured" | "waha" | "whatsapp-cloud";
  readonly storageMode: "not_configured" | "spaces";
}

export interface DashboardUiCapabilities {
  readonly canCreateBooking: boolean;
  readonly canRecordAttendance: boolean;
  readonly canManagePlatform: boolean;
  readonly canManageStaff: boolean;
  readonly canManageRemoteAccess: boolean;
  readonly canManagePayments: boolean;
  readonly canManageFeatureFlags: boolean;
  readonly canManageOwnerAccounts: boolean;
}

export interface RemoteAccessSummary {
  readonly enabled: boolean;
  readonly provider: RemoteAccessProvider;
  readonly providerLabel: string;
  readonly bridgeType: RemoteAccessBridgeType;
  readonly locationId: string | null;
  readonly locationName: string | null;
  readonly deviceLabel: string;
  readonly externalDeviceId: string;
  readonly connectionStatus: RemoteAccessConnectionStatus;
  readonly statusLabel: string;
  readonly helpText: string;
  readonly previewMode: boolean;
  readonly notes?: string;
  readonly lastValidatedAt?: string;
  readonly lastRemoteActionAt?: string;
  readonly lastRemoteActionBy?: string;
}

export interface RemoteAccessActionReceipt {
  readonly provider: RemoteAccessProvider;
  readonly providerLabel: string;
  readonly deviceLabel: string;
  readonly locationName: string | null;
  readonly requestedAt: string;
  readonly mode: "live";
  readonly providerActionId: string;
  readonly providerStatus: string;
  readonly summary: string;
}

export interface BillingSummary {
  readonly enabled: boolean;
  readonly provider: BillingProvider;
  readonly providerLabel: string;
  readonly profileLabel: string;
  readonly profileId: string;
  readonly settlementLabel: string;
  readonly supportEmail: string;
  readonly paymentMethods: ReadonlyArray<BillingPaymentMethod>;
  readonly connectionStatus: BillingConnectionStatus;
  readonly statusLabel: string;
  readonly helpText: string;
  readonly previewMode: boolean;
  readonly notes?: string;
  readonly lastValidatedAt?: string;
  readonly lastPaymentActionAt?: string;
  readonly lastPaymentActionBy?: string;
}

export interface BillingActionReceipt {
  readonly provider: BillingProvider;
  readonly providerLabel: string;
  readonly paymentMethod: BillingPaymentMethod;
  readonly paymentMethodLabel: string;
  readonly amountLabel: string;
  readonly description: string;
  readonly memberName?: string;
  readonly requestedAt: string;
  readonly mode: "live";
  readonly invoiceId: string;
  readonly providerPaymentId: string;
  readonly providerStatus: string;
  readonly checkoutUrl: string;
  readonly summary: string;
}

export interface LegalComplianceSummary {
  readonly termsUrl: string;
  readonly privacyUrl: string;
  readonly sepaCreditorId: string;
  readonly sepaMandateText: string;
  readonly contractPdfTemplateKey: string;
  readonly waiverStorageKey: string;
  readonly waiverRetentionMonths: number;
  readonly statusLabel: string;
  readonly helpText: string;
  readonly lastValidatedAt?: string;
}

export interface BookingWorkspaceSummary {
  readonly oneToOneSessionName: string;
  readonly oneToOneDurationMinutes: number;
  readonly trialBookingUrl: string;
  readonly defaultCreditPackSize: number;
  readonly schedulingWindowDays: number;
  readonly lastUpdatedAt?: string;
}

export interface RevenueWorkspaceSummary {
  readonly webshopCollectionName: string;
  readonly pointOfSaleMode: "frontdesk" | "kiosk" | "hybrid";
  readonly cardTerminalLabel: string;
  readonly autocollectPolicy: string;
  readonly directDebitLeadDays: number;
  readonly lastUpdatedAt?: string;
}

export interface CoachingWorkspaceSummary {
  readonly workoutPlanFocus: string;
  readonly nutritionCadence: "weekly" | "biweekly" | "monthly";
  readonly videoLibraryUrl: string;
  readonly progressMetric: string;
  readonly heartRateProvider: string;
  readonly aiCoachMode: string;
  readonly lastUpdatedAt?: string;
}

export interface RetentionWorkspaceSummary {
  readonly retentionCadence: "weekly" | "biweekly" | "monthly";
  readonly communityChannel: string;
  readonly challengeTheme: string;
  readonly questionnaireTrigger: string;
  readonly proContentPath: string;
  readonly fitZoneOffer: string;
  readonly lastUpdatedAt?: string;
}

export interface MobileExperienceSummary {
  readonly appDisplayName: string;
  readonly onboardingHeadline: string;
  readonly supportChannel: string;
  readonly primaryAccent: string;
  readonly checkInMode: "qr" | "frontdesk" | "hybrid";
  readonly whiteLabelDomain: string;
  readonly lastUpdatedAt?: string;
}

export interface MarketingWorkspaceSummary {
  readonly emailSenderName: string;
  readonly emailReplyTo: string;
  readonly promotionHeadline: string;
  readonly leadPipelineLabel: string;
  readonly automationCadence: "weekly" | "biweekly" | "monthly";
  readonly lastUpdatedAt?: string;
}

export interface IntegrationWorkspaceSummary {
  readonly hardwareVendors: ReadonlyArray<string>;
  readonly softwareIntegrations: ReadonlyArray<string>;
  readonly equipmentIntegrations: ReadonlyArray<string>;
  readonly migrationProvider: string;
  readonly bodyCompositionProvider: string;
  readonly lastUpdatedAt?: string;
}

export interface PublicReservationClassSummary {
  readonly id: string;
  readonly title: string;
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly locationName: string;
  readonly trainerName: string;
  readonly capacity: number;
  readonly bookedCount: number;
  readonly waitlistCount: number;
  readonly level: ClassSession["level"];
  readonly focus: string;
}

export interface PublicReservationSnapshot {
  readonly tenantName: string;
  readonly tenantSlug: string | null;
  readonly availableGyms: ReadonlyArray<{
    readonly id: string;
    readonly slug: string;
    readonly name: string;
  }>;
  readonly bookingAccess?: {
    readonly trialEnabled: boolean;
    readonly trialBookingUrl: string;
    readonly membershipSignupUrl: string | null;
    readonly contactLabel: string;
  };
  readonly classSessions: ReadonlyArray<PublicReservationClassSummary>;
}

export interface PublicMembershipSignupSnapshot {
  readonly tenantName: string;
  readonly tenantSlug: string | null;
  readonly availableGyms: ReadonlyArray<{
    readonly id: string;
    readonly slug: string;
    readonly name: string;
  }>;
  readonly membershipPlans: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly priceMonthly: number;
    readonly billingCycle: MembershipPlan["billingCycle"];
  }>;
  readonly locations: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly city: string;
  }>;
  readonly legal: Pick<
    LegalComplianceSummary,
    | "termsUrl"
    | "privacyUrl"
    | "sepaMandateText"
    | "contractPdfTemplateKey"
    | "waiverStorageKey"
  >;
  readonly legalReady: boolean;
  readonly billingReady: boolean;
}

export interface MemberReservationSnapshot {
  readonly tenantName: string;
  readonly tenantSlug: string | null;
  readonly availableClubs: ReadonlyArray<{
    readonly id: string;
    readonly slug: string;
    readonly name: string;
  }>;
  readonly classSessions: ReadonlyArray<PublicReservationClassSummary>;
  readonly memberDisplayName: string;
  readonly memberEmail: string;
  readonly hasEligibleMembership: boolean;
  readonly selfService: MobileSelfServiceSummary;
}

export interface GymDashboardSnapshot {
  readonly tenantName: string;
  readonly actorName: string;
  readonly actorEmail?: string;
  readonly runtime: RuntimeState;
  readonly uiCapabilities: DashboardUiCapabilities;
  readonly remoteAccess: RemoteAccessSummary;
  readonly payments: BillingSummary;
  readonly legal: LegalComplianceSummary;
  readonly bookingWorkspace: BookingWorkspaceSummary;
  readonly revenueWorkspace: RevenueWorkspaceSummary;
  readonly coachingWorkspace: CoachingWorkspaceSummary;
  readonly retentionWorkspace: RetentionWorkspaceSummary;
  readonly mobileExperience: MobileExperienceSummary;
  readonly marketingWorkspace: MarketingWorkspaceSummary;
  readonly integrationWorkspace: IntegrationWorkspaceSummary;
  readonly bookingPolicy: BookingPolicySummary;
  readonly metrics: ReadonlyArray<DashboardMetric>;
  readonly featureFlags: ReadonlyArray<FeatureState>;
  readonly locations: ReadonlyArray<GymLocation>;
  readonly membershipPlans: ReadonlyArray<MembershipPlan>;
  readonly members: ReadonlyArray<GymMember>;
  readonly memberPortalAccessMemberIds: ReadonlyArray<string>;
  readonly trainers: ReadonlyArray<GymTrainer>;
  readonly classSessions: ReadonlyArray<ClassSession>;
  readonly bookings: ReadonlyArray<ClassBooking>;
  readonly attendance: ReadonlyArray<AttendanceRecord>;
  readonly waivers: ReadonlyArray<WaiverRecord>;
  readonly leads: ReadonlyArray<GymLead>;
  readonly collectionCases: ReadonlyArray<CollectionCase>;
  readonly memberSignups: ReadonlyArray<MemberSignupRequest>;
  readonly billingBackoffice: BillingBackofficeSummary;
  readonly leadAutomation: LeadAutomationSummary;
  readonly appointments: AppointmentSummary;
  readonly communityHub: CommunitySummary;
  readonly mobileSelfService: MobileSelfServiceSummary;
  readonly staff: ReadonlyArray<StaffSummary>;
  readonly superadmin: SuperadminSummary;
  readonly auditEntries: ReadonlyArray<AuditEntry>;
  readonly healthReport: SystemHealthReport;
  readonly projectedRevenueLabel: string;
  readonly notificationPreview: string;
  readonly waiverUploadPath: string;
  readonly supportedLanguages: ReadonlyArray<string>;
}
