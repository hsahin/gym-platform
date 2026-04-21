import type { SupportedPhoneCountryCode } from "@claimtech/i18n";
import type { TenantContext } from "@claimtech/tenant";
import type {
  AttendanceChannel,
  AttendanceRecord,
  ClassBooking,
  ClassSession,
  GymLocation,
  GymMember,
  GymTrainer,
  MemberStatus,
  MembershipPlan,
  WaiverRecord,
} from "@/server/types";

export interface CreateBookingInput {
  readonly classSessionId: string;
  readonly memberId: string;
  readonly idempotencyKey: string;
  readonly source?: ClassBooking["source"];
  readonly phone?: string;
  readonly phoneCountry?: SupportedPhoneCountryCode;
  readonly notes?: string;
}

export interface RecordAttendanceInput {
  readonly bookingId: string;
  readonly expectedVersion: number;
  readonly channel: AttendanceChannel;
}

export interface CancelBookingInput {
  readonly bookingId: string;
  readonly expectedVersion: number;
}

export interface CreateLocationInput {
  readonly name: string;
  readonly city: string;
  readonly neighborhood: string;
  readonly capacity: number;
  readonly managerName: string;
  readonly amenities: ReadonlyArray<string>;
}

export interface CreateMembershipPlanInput {
  readonly name: string;
  readonly priceMonthly: number;
  readonly billingCycle: MembershipPlan["billingCycle"];
  readonly perks: ReadonlyArray<string>;
}

export interface CreateTrainerInput {
  readonly fullName: string;
  readonly specialties: ReadonlyArray<string>;
  readonly certifications: ReadonlyArray<string>;
  readonly homeLocationId: string;
}

export interface CreateMemberInput {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly phoneCountry: SupportedPhoneCountryCode;
  readonly membershipPlanId: string;
  readonly homeLocationId: string;
  readonly status: MemberStatus;
  readonly tags: ReadonlyArray<string>;
  readonly waiverStatus: GymMember["waiverStatus"];
}

export interface CreateClassSessionInput {
  readonly title: string;
  readonly locationId: string;
  readonly trainerId: string;
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly capacity: number;
  readonly level: ClassSession["level"];
  readonly focus: string;
}

export interface BookingMutationResult {
  readonly booking: ClassBooking;
  readonly alreadyExisted: boolean;
}

export interface CancelBookingResult {
  readonly booking: ClassBooking;
  readonly promotedBooking?: ClassBooking;
}

export interface GymStore {
  listLocations(tenantContext: TenantContext): Promise<ReadonlyArray<GymLocation>>;
  listMembershipPlans(
    tenantContext: TenantContext,
  ): Promise<ReadonlyArray<MembershipPlan>>;
  listMembers(tenantContext: TenantContext): Promise<ReadonlyArray<GymMember>>;
  getMember(
    tenantContext: TenantContext,
    memberId: string,
  ): Promise<GymMember | null>;
  listTrainers(tenantContext: TenantContext): Promise<ReadonlyArray<GymTrainer>>;
  listClassSessions(
    tenantContext: TenantContext,
  ): Promise<ReadonlyArray<ClassSession>>;
  getClassSession(
    tenantContext: TenantContext,
    classSessionId: string,
  ): Promise<ClassSession | null>;
  listBookings(tenantContext: TenantContext): Promise<ReadonlyArray<ClassBooking>>;
  listAttendance(
    tenantContext: TenantContext,
  ): Promise<ReadonlyArray<AttendanceRecord>>;
  listWaivers(tenantContext: TenantContext): Promise<ReadonlyArray<WaiverRecord>>;
  createBooking(
    tenantContext: TenantContext,
    input: CreateBookingInput,
  ): Promise<BookingMutationResult>;
  cancelBooking(
    tenantContext: TenantContext,
    input: CancelBookingInput,
  ): Promise<CancelBookingResult>;
  createLocation(
    tenantContext: TenantContext,
    input: CreateLocationInput,
  ): Promise<GymLocation>;
  createMembershipPlan(
    tenantContext: TenantContext,
    input: CreateMembershipPlanInput,
  ): Promise<MembershipPlan>;
  createTrainer(
    tenantContext: TenantContext,
    input: CreateTrainerInput,
  ): Promise<GymTrainer>;
  createMember(
    tenantContext: TenantContext,
    input: CreateMemberInput,
  ): Promise<GymMember>;
  createClassSession(
    tenantContext: TenantContext,
    input: CreateClassSessionInput,
  ): Promise<ClassSession>;
  recordAttendance(
    tenantContext: TenantContext,
    input: RecordAttendanceInput,
  ): Promise<ClassBooking>;
}
