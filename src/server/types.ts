import type { SupportedPhoneCountryCode } from "@claimtech/i18n";
import type { AuditEntry, SystemHealthReport } from "@claimtech/ops";
import type { TenantId } from "@claimtech/tenant";

export type EntityStatus = "active" | "paused" | "archived";
export type MemberStatus = "active" | "trial" | "paused";
export type BookingStatus = "confirmed" | "waitlisted" | "checked_in" | "cancelled";
export type BookingSource = "frontdesk" | "coach" | "member_app";
export type AttendanceChannel = "qr" | "frontdesk" | "coach";
export type RemoteAccessProvider = "nuki" | "salto_ks" | "tedee" | "yale_smart";
export type RemoteAccessBridgeType = "cloud_api" | "bridge" | "hub";
export type RemoteAccessConnectionStatus = "not_configured" | "configured" | "attention";
export type BillingProvider = "mollie";
export type BillingPaymentMethod = "direct_debit" | "one_time" | "payment_request";
export type BillingConnectionStatus = "not_configured" | "configured" | "attention";

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
  readonly status: "active" | "away";
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

export interface FeatureState {
  readonly key: string;
  readonly enabled: boolean;
  readonly reason: string;
  readonly description: string;
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
}

export interface RuntimeState {
  readonly storeMode: "memory" | "mongo";
  readonly cacheMode: "memory" | "redis";
  readonly messagingMode: "preview" | "waha" | "whatsapp-cloud";
  readonly storageMode: "preview" | "spaces";
}

export interface DashboardUiCapabilities {
  readonly canCreateBooking: boolean;
  readonly canRecordAttendance: boolean;
  readonly canManagePlatform: boolean;
  readonly canManageStaff: boolean;
  readonly canManageRemoteAccess: boolean;
  readonly canManagePayments: boolean;
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
  readonly mode: "preview";
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
  readonly mode: "preview";
  readonly summary: string;
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
  readonly classSessions: ReadonlyArray<PublicReservationClassSummary>;
}

export interface GymDashboardSnapshot {
  readonly tenantName: string;
  readonly actorName: string;
  readonly actorEmail?: string;
  readonly runtime: RuntimeState;
  readonly uiCapabilities: DashboardUiCapabilities;
  readonly remoteAccess: RemoteAccessSummary;
  readonly payments: BillingSummary;
  readonly metrics: ReadonlyArray<DashboardMetric>;
  readonly featureFlags: ReadonlyArray<FeatureState>;
  readonly locations: ReadonlyArray<GymLocation>;
  readonly membershipPlans: ReadonlyArray<MembershipPlan>;
  readonly members: ReadonlyArray<GymMember>;
  readonly trainers: ReadonlyArray<GymTrainer>;
  readonly classSessions: ReadonlyArray<ClassSession>;
  readonly bookings: ReadonlyArray<ClassBooking>;
  readonly attendance: ReadonlyArray<AttendanceRecord>;
  readonly waivers: ReadonlyArray<WaiverRecord>;
  readonly staff: ReadonlyArray<StaffSummary>;
  readonly auditEntries: ReadonlyArray<AuditEntry>;
  readonly healthReport: SystemHealthReport;
  readonly projectedRevenueLabel: string;
  readonly notificationPreview: string;
  readonly waiverUploadPath: string;
  readonly supportedLanguages: ReadonlyArray<string>;
}
