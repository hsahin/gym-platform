import { AppError, createPrefixedIdGenerator } from "@claimtech/core";
import type { TenantContext } from "@claimtech/tenant";
import { addMonthsToIsoDate, getMembershipBillingCycleMonths } from "@/lib/memberships";
import type {
  CancelBookingResult,
  BookingMutationResult,
  GymStore,
} from "@/server/persistence/gym-contracts";
import type {
  AttendanceRecord,
  ClassBooking,
  ClassSession,
  GymLocation,
  GymMember,
  GymTrainer,
  MembershipPlan,
  WaiverRecord,
} from "@/server/types";

export interface MemoryGymStoreState {
  locations: GymLocation[];
  membershipPlans: MembershipPlan[];
  members: GymMember[];
  trainers: GymTrainer[];
  classSessions: ClassSession[];
  bookings: ClassBooking[];
  attendance: AttendanceRecord[];
  waivers: WaiverRecord[];
}

interface MemoryGymStoreOptions {
  readonly initialState?: MemoryGymStoreState;
  readonly onChange?: (state: MemoryGymStoreState) => Promise<void> | void;
}

const locationIdGenerator = createPrefixedIdGenerator({ prefix: "loc" });
const membershipPlanIdGenerator = createPrefixedIdGenerator({ prefix: "plan" });
const memberIdGenerator = createPrefixedIdGenerator({ prefix: "member" });
const trainerIdGenerator = createPrefixedIdGenerator({ prefix: "trainer" });
const classSessionIdGenerator = createPrefixedIdGenerator({ prefix: "class" });
const bookingIdGenerator = createPrefixedIdGenerator({ prefix: "booking" });
const attendanceIdGenerator = createPrefixedIdGenerator({ prefix: "attendance" });
const waiverIdGenerator = createPrefixedIdGenerator({ prefix: "waiver" });

export function createEmptyGymStoreState(): MemoryGymStoreState {
  return {
    locations: [],
    membershipPlans: [],
    members: [],
    trainers: [],
    classSessions: [],
    bookings: [],
    attendance: [],
    waivers: [],
  };
}

function cloneRecord<T>(record: T): T {
  return { ...record };
}

function cloneState(state: MemoryGymStoreState): MemoryGymStoreState {
  return {
    locations: state.locations.map(cloneRecord),
    membershipPlans: state.membershipPlans.map(cloneRecord),
    members: state.members.map(cloneRecord),
    trainers: state.trainers.map(cloneRecord),
    classSessions: state.classSessions.map(cloneRecord),
    bookings: state.bookings.map(cloneRecord),
    attendance: state.attendance.map(cloneRecord),
    waivers: state.waivers.map(cloneRecord),
  };
}

function listForTenant<T extends { tenantId: ClassBooking["tenantId"] }>(
  records: ReadonlyArray<T>,
  tenantContext: TenantContext,
) {
  return records.filter((record) => record.tenantId === tenantContext.tenantId);
}

export function createMemoryGymStore(
  options: MemoryGymStoreOptions = {},
): GymStore {
  const state = cloneState(options.initialState ?? createEmptyGymStoreState());

  async function persistState() {
    await options.onChange?.(cloneState(state));
  }

  function requireLocation(tenantContext: TenantContext, locationId: string) {
    const location = state.locations.find(
      (entry) =>
        entry.tenantId === tenantContext.tenantId && entry.id === locationId,
    );

    if (!location) {
      throw new AppError("Vestiging niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { locationId },
      });
    }

    return location;
  }

  function requireMembershipPlan(tenantContext: TenantContext, membershipPlanId: string) {
    const plan = state.membershipPlans.find(
      (entry) =>
        entry.tenantId === tenantContext.tenantId &&
        entry.id === membershipPlanId,
    );

    if (!plan) {
      throw new AppError("Membership niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { membershipPlanId },
      });
    }

    return plan;
  }

  function requireMember(tenantContext: TenantContext, memberId: string) {
    const member = state.members.find(
      (entry) =>
        entry.tenantId === tenantContext.tenantId && entry.id === memberId,
    );

    if (!member) {
      throw new AppError("Lid niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { memberId },
      });
    }

    return member;
  }

  function requireTrainer(tenantContext: TenantContext, trainerId: string) {
    const trainer = state.trainers.find(
      (entry) =>
        entry.tenantId === tenantContext.tenantId && entry.id === trainerId,
    );

    if (!trainer) {
      throw new AppError("Trainer niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { trainerId },
      });
    }

    return trainer;
  }

  function requireClassSession(tenantContext: TenantContext, classSessionId: string) {
    const classSession = state.classSessions.find(
      (entry) =>
        entry.tenantId === tenantContext.tenantId &&
        entry.id === classSessionId,
    );

    if (!classSession) {
      throw new AppError("Les niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { classSessionId },
      });
    }

    return classSession;
  }

  function findExistingActiveBooking(
    tenantContext: TenantContext,
    memberId: string,
    classSessionId: string,
  ) {
    return state.bookings.find(
      (entry) =>
        entry.tenantId === tenantContext.tenantId &&
        entry.memberId === memberId &&
        entry.classSessionId === classSessionId &&
        entry.status !== "cancelled",
    );
  }

  return {
    async listLocations(tenantContext) {
      return listForTenant(state.locations, tenantContext).map(cloneRecord);
    },
    async listMembershipPlans(tenantContext) {
      return listForTenant(state.membershipPlans, tenantContext).map(cloneRecord);
    },
    async listMembers(tenantContext) {
      return listForTenant(state.members, tenantContext).map(cloneRecord);
    },
    async getMember(tenantContext, memberId) {
      const member = listForTenant(state.members, tenantContext).find(
        (entry) => entry.id === memberId,
      );
      return member ? cloneRecord(member) : null;
    },
    async listTrainers(tenantContext) {
      return listForTenant(state.trainers, tenantContext).map(cloneRecord);
    },
    async listClassSessions(tenantContext) {
      return listForTenant(state.classSessions, tenantContext).map(cloneRecord);
    },
    async getClassSession(tenantContext, classSessionId) {
      const classSession = listForTenant(state.classSessions, tenantContext).find(
        (entry) => entry.id === classSessionId,
      );
      return classSession ? cloneRecord(classSession) : null;
    },
    async listBookings(tenantContext) {
      return listForTenant(state.bookings, tenantContext).map(cloneRecord);
    },
    async listAttendance(tenantContext) {
      return listForTenant(state.attendance, tenantContext).map(cloneRecord);
    },
    async listWaivers(tenantContext) {
      return listForTenant(state.waivers, tenantContext).map(cloneRecord);
    },
    async createLocation(tenantContext, input) {
      const now = new Date().toISOString();
      const location: GymLocation = {
        tenantId: tenantContext.tenantId,
        id: locationIdGenerator.next(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        name: input.name,
        city: input.city,
        neighborhood: input.neighborhood,
        capacity: input.capacity,
        managerName: input.managerName,
        amenities: [...input.amenities],
        status: "active",
      };

      state.locations.push(location);
      await persistState();
      return cloneRecord(location);
    },
    async createMembershipPlan(tenantContext, input) {
      const now = new Date().toISOString();
      const membershipPlan: MembershipPlan = {
        tenantId: tenantContext.tenantId,
        id: membershipPlanIdGenerator.next(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        name: input.name,
        priceMonthly: input.priceMonthly,
        currency: "EUR",
        billingCycle: input.billingCycle,
        perks: [...input.perks],
        activeMembers: 0,
      };

      state.membershipPlans.push(membershipPlan);
      await persistState();
      return cloneRecord(membershipPlan);
    },
    async createTrainer(tenantContext, input) {
      requireLocation(tenantContext, input.homeLocationId);

      const now = new Date().toISOString();
      const trainer: GymTrainer = {
        tenantId: tenantContext.tenantId,
        id: trainerIdGenerator.next(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        fullName: input.fullName,
        specialties: [...input.specialties],
        certifications: [...input.certifications],
        homeLocationId: input.homeLocationId,
        classIds: [],
        status: "active",
      };

      state.trainers.push(trainer);
      await persistState();
      return cloneRecord(trainer);
    },
    async createMember(tenantContext, input) {
      const membershipPlan = requireMembershipPlan(tenantContext, input.membershipPlanId);
      requireLocation(tenantContext, input.homeLocationId);

      const now = new Date().toISOString();
      const member: GymMember = {
        tenantId: tenantContext.tenantId,
        id: memberIdGenerator.next(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        phoneCountry: input.phoneCountry,
        membershipPlanId: input.membershipPlanId,
        homeLocationId: input.homeLocationId,
        joinedAt: now,
        nextRenewalAt: addMonthsToIsoDate(
          now,
          getMembershipBillingCycleMonths(membershipPlan.billingCycle),
        ),
        status: input.status,
        tags: [...input.tags],
        waiverStatus: input.waiverStatus,
      };

      state.members.push(member);

      const planIndex = state.membershipPlans.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId &&
          entry.id === input.membershipPlanId,
      );

      if (planIndex >= 0 && input.status === "active") {
        state.membershipPlans[planIndex] = {
          ...state.membershipPlans[planIndex],
          version: state.membershipPlans[planIndex]!.version + 1,
          updatedAt: now,
          activeMembers: state.membershipPlans[planIndex]!.activeMembers + 1,
        };
      }

      state.waivers.unshift({
        tenantId: tenantContext.tenantId,
        id: waiverIdGenerator.next(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        memberId: member.id,
        memberName: member.fullName,
        status: input.waiverStatus === "complete" ? "signed" : "requested",
        uploadedAt: input.waiverStatus === "complete" ? now : undefined,
        fileName:
          input.waiverStatus === "complete"
            ? `${member.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-waiver.pdf`
            : undefined,
      });

      await persistState();
      return cloneRecord(member);
    },
    async createClassSession(tenantContext, input) {
      requireLocation(tenantContext, input.locationId);
      const trainer = requireTrainer(tenantContext, input.trainerId);

      const now = new Date().toISOString();
      const classSession: ClassSession = {
        tenantId: tenantContext.tenantId,
        id: classSessionIdGenerator.next(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        title: input.title,
        locationId: input.locationId,
        trainerId: input.trainerId,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        capacity: input.capacity,
        bookedCount: 0,
        waitlistCount: 0,
        level: input.level,
        focus: input.focus,
      };

      state.classSessions.push(classSession);

      const trainerIndex = state.trainers.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === trainer.id,
      );

      if (trainerIndex >= 0) {
        state.trainers[trainerIndex] = {
          ...trainer,
          version: trainer.version + 1,
          updatedAt: now,
          classIds: [...trainer.classIds, classSession.id],
        };
      }

      await persistState();
      return cloneRecord(classSession);
    },
    async createBooking(tenantContext, input): Promise<BookingMutationResult> {
      const existing = state.bookings.find(
        (entry) =>
          entry.tenantId === tenantContext.tenantId &&
          entry.idempotencyKey === input.idempotencyKey,
      );

      if (existing) {
        return { booking: cloneRecord(existing), alreadyExisted: true };
      }

      const existingBooking = findExistingActiveBooking(
        tenantContext,
        input.memberId,
        input.classSessionId,
      );

      if (existingBooking) {
        return { booking: cloneRecord(existingBooking), alreadyExisted: true };
      }

      const member = requireMember(tenantContext, input.memberId);
      const classSession = requireClassSession(tenantContext, input.classSessionId);
      const now = new Date().toISOString();
      const isConfirmed = classSession.bookedCount < classSession.capacity;

      const booking: ClassBooking = {
        tenantId: tenantContext.tenantId,
        id: bookingIdGenerator.next(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        classSessionId: classSession.id,
        memberId: member.id,
        memberName: member.fullName,
        phone: input.phone ?? member.phone,
        phoneCountry: input.phoneCountry ?? member.phoneCountry,
        status: isConfirmed ? "confirmed" : "waitlisted",
        source: input.source ?? "frontdesk",
        idempotencyKey: input.idempotencyKey,
        notes: input.notes,
      };

      state.bookings.unshift(booking);

      const sessionIndex = state.classSessions.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId &&
          entry.id === classSession.id,
      );

      state.classSessions[sessionIndex] = {
        ...classSession,
        version: classSession.version + 1,
        updatedAt: now,
        bookedCount: isConfirmed
          ? classSession.bookedCount + 1
          : classSession.bookedCount,
        waitlistCount: isConfirmed
          ? classSession.waitlistCount
          : classSession.waitlistCount + 1,
      };

      await persistState();
      return { booking: cloneRecord(booking), alreadyExisted: false };
    },
    async cancelBooking(tenantContext, input): Promise<CancelBookingResult> {
      const bookingIndex = state.bookings.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.bookingId,
      );

      if (bookingIndex === -1) {
        throw new AppError("Boeking niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { bookingId: input.bookingId },
        });
      }

      const booking = state.bookings[bookingIndex]!;

      if (booking.version !== input.expectedVersion) {
        throw new AppError("De boeking is al gewijzigd; laad eerst opnieuw.", {
          code: "VERSION_CONFLICT",
          details: {
            bookingId: booking.id,
            expectedVersion: input.expectedVersion,
            actualVersion: booking.version,
          },
        });
      }

      if (booking.status === "cancelled") {
        return { booking: cloneRecord(booking) };
      }

      if (booking.status === "checked_in") {
        throw new AppError("Een ingecheckte booking kan niet meer geannuleerd worden.", {
          code: "FORBIDDEN",
          details: { bookingId: booking.id },
        });
      }

      const classSession = requireClassSession(tenantContext, booking.classSessionId);
      const now = new Date().toISOString();
      const updatedBooking: ClassBooking = {
        ...booking,
        version: booking.version + 1,
        updatedAt: now,
        status: "cancelled",
      };

      state.bookings[bookingIndex] = updatedBooking;

      const sessionIndex = state.classSessions.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId &&
          entry.id === classSession.id,
      );

      let nextBookedCount = classSession.bookedCount;
      let nextWaitlistCount = classSession.waitlistCount;

      if (booking.status === "confirmed") {
        nextBookedCount = Math.max(0, nextBookedCount - 1);
      }

      if (booking.status === "waitlisted") {
        nextWaitlistCount = Math.max(0, nextWaitlistCount - 1);
      }

      let promotedBooking: ClassBooking | undefined;

      if (booking.status === "confirmed") {
        const waitlistedBooking = [...state.bookings]
          .filter(
            (entry) =>
              entry.tenantId === tenantContext.tenantId &&
              entry.classSessionId === classSession.id &&
              entry.status === "waitlisted",
          )
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];

        if (waitlistedBooking) {
          const promotedIndex = state.bookings.findIndex(
            (entry) => entry.id === waitlistedBooking.id,
          );

          promotedBooking = {
            ...waitlistedBooking,
            version: waitlistedBooking.version + 1,
            updatedAt: now,
            status: "confirmed",
          };

          state.bookings[promotedIndex] = promotedBooking;
          nextBookedCount += 1;
          nextWaitlistCount = Math.max(0, nextWaitlistCount - 1);
        }
      }

      state.classSessions[sessionIndex] = {
        ...classSession,
        version: classSession.version + 1,
        updatedAt: now,
        bookedCount: nextBookedCount,
        waitlistCount: nextWaitlistCount,
      };

      await persistState();

      return {
        booking: cloneRecord(updatedBooking),
        promotedBooking: promotedBooking ? cloneRecord(promotedBooking) : undefined,
      };
    },
    async recordAttendance(tenantContext, input) {
      const bookingIndex = state.bookings.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.bookingId,
      );

      if (bookingIndex === -1) {
        throw new AppError("Boeking niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { bookingId: input.bookingId },
        });
      }

      const booking = state.bookings[bookingIndex]!;

      if (booking.version !== input.expectedVersion) {
        throw new AppError("De boeking is al gewijzigd; laad eerst opnieuw.", {
          code: "VERSION_CONFLICT",
          details: {
            bookingId: booking.id,
            expectedVersion: input.expectedVersion,
            actualVersion: booking.version,
          },
        });
      }

      if (booking.status === "checked_in") {
        return cloneRecord(booking);
      }

      const now = new Date().toISOString();
      const updatedBooking: ClassBooking = {
        ...booking,
        version: booking.version + 1,
        updatedAt: now,
        status: "checked_in",
      };

      state.bookings[bookingIndex] = updatedBooking;

      const existingAttendance = state.attendance.find(
        (entry) =>
          entry.tenantId === tenantContext.tenantId &&
          entry.bookingId === updatedBooking.id,
      );

      if (!existingAttendance) {
        state.attendance.unshift({
          tenantId: tenantContext.tenantId,
          id: attendanceIdGenerator.next(),
          version: 1,
          createdAt: now,
          updatedAt: now,
          classSessionId: updatedBooking.classSessionId,
          bookingId: updatedBooking.id,
          memberId: updatedBooking.memberId,
          checkedInAt: now,
          channel: input.channel,
        });
      }

      await persistState();
      return cloneRecord(updatedBooking);
    },
  };
}
