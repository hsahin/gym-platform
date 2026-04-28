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

function buildWaiverFileName(fullName: string) {
  return `${fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-waiver.pdf`;
}

function buildWaiverStorageKey(storagePrefix: string | undefined, fileName: string | undefined) {
  if (!storagePrefix?.trim() || !fileName) {
    return undefined;
  }

  return `${storagePrefix.trim().replace(/\/+$/g, "")}/${fileName}`;
}

function cloneState(state: MemoryGymStoreState): MemoryGymStoreState {
  const normalized = normalizeGymStoreState(state);

  return {
    locations: normalized.locations.map(cloneRecord),
    membershipPlans: normalized.membershipPlans.map(cloneRecord),
    members: normalized.members.map(cloneRecord),
    trainers: normalized.trainers.map(cloneRecord),
    classSessions: normalized.classSessions.map(cloneRecord),
    bookings: normalized.bookings.map(cloneRecord),
    attendance: normalized.attendance.map(cloneRecord),
    waivers: normalized.waivers.map(cloneRecord),
  };
}

export function normalizeGymStoreState(state: MemoryGymStoreState): MemoryGymStoreState {
  return {
    locations: state.locations.map((location) => ({
      ...location,
      status: location.status ?? "active",
    })),
    membershipPlans: state.membershipPlans.map((plan) => ({
      ...plan,
      status: plan.status ?? "active",
    })),
    members: state.members.map((member) => ({
      ...member,
      status: member.status ?? "active",
    })),
    trainers: state.trainers.map((trainer) => ({
      ...trainer,
      status: trainer.status ?? "active",
    })),
    classSessions: state.classSessions.map((classSession) => ({
      ...classSession,
      status: classSession.status ?? "active",
    })),
    bookings: state.bookings,
    attendance: state.attendance,
    waivers: state.waivers,
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

  function assertExpectedVersion(
    label: string,
    id: string,
    actualVersion: number,
    expectedVersion: number,
  ) {
    if (actualVersion !== expectedVersion) {
      throw new AppError(`${label} is al gewijzigd; laad eerst opnieuw.`, {
        code: "VERSION_CONFLICT",
        details: { id, expectedVersion, actualVersion },
      });
    }
  }

  function adjustMembershipActiveMembers(
    tenantContext: TenantContext,
    membershipPlanId: string,
    delta: number,
    updatedAt: string,
  ) {
    if (delta === 0) {
      return;
    }

    const planIndex = state.membershipPlans.findIndex(
      (entry) =>
        entry.tenantId === tenantContext.tenantId && entry.id === membershipPlanId,
    );

    if (planIndex === -1) {
      return;
    }

    const plan = state.membershipPlans[planIndex]!;
    state.membershipPlans[planIndex] = {
      ...plan,
      version: plan.version + 1,
      updatedAt,
      activeMembers: Math.max(0, plan.activeMembers + delta),
    };
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
    async updateLocation(tenantContext, input) {
      const locationIndex = state.locations.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.id,
      );

      if (locationIndex === -1) {
        throw new AppError("Vestiging niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { locationId: input.id },
        });
      }

      const location = state.locations[locationIndex]!;
      assertExpectedVersion("Vestiging", location.id, location.version, input.expectedVersion);

      const updatedLocation: GymLocation = {
        ...location,
        version: location.version + 1,
        updatedAt: new Date().toISOString(),
        name: input.name,
        city: input.city,
        neighborhood: input.neighborhood,
        capacity: input.capacity,
        managerName: input.managerName,
        amenities: [...input.amenities],
        status: input.status,
      };

      state.locations[locationIndex] = updatedLocation;
      await persistState();
      return cloneRecord(updatedLocation);
    },
    async archiveLocation(tenantContext, input) {
      const location = requireLocation(tenantContext, input.id);
      assertExpectedVersion("Vestiging", location.id, location.version, input.expectedVersion);
      const locationIndex = state.locations.findIndex((entry) => entry.id === location.id);
      const updatedLocation = {
        ...location,
        version: location.version + 1,
        updatedAt: new Date().toISOString(),
        status: "archived" as const,
      };
      state.locations[locationIndex] = updatedLocation;
      await persistState();
      return cloneRecord(updatedLocation);
    },
    async deleteLocation(tenantContext, input) {
      const locationIndex = state.locations.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.id,
      );

      if (locationIndex === -1) {
        throw new AppError("Vestiging niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { locationId: input.id },
        });
      }

      const location = state.locations[locationIndex]!;
      assertExpectedVersion("Vestiging", location.id, location.version, input.expectedVersion);

      const isInUse =
        state.members.some(
          (entry) =>
            entry.tenantId === tenantContext.tenantId &&
            entry.homeLocationId === location.id,
        ) ||
        state.trainers.some(
          (entry) =>
            entry.tenantId === tenantContext.tenantId &&
            entry.homeLocationId === location.id,
        ) ||
        state.classSessions.some(
          (entry) =>
            entry.tenantId === tenantContext.tenantId &&
            entry.locationId === location.id,
        );

      if (isInUse) {
        throw new AppError("Archiveer deze vestiging eerst; er zijn nog gekoppelde leden, trainers of lessen.", {
          code: "FORBIDDEN",
          details: { locationId: location.id },
        });
      }

      state.locations.splice(locationIndex, 1);
      await persistState();
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
        status: "active",
      };

      state.membershipPlans.push(membershipPlan);
      await persistState();
      return cloneRecord(membershipPlan);
    },
    async updateMembershipPlan(tenantContext, input) {
      const planIndex = state.membershipPlans.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.id,
      );

      if (planIndex === -1) {
        throw new AppError("Membership niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { membershipPlanId: input.id },
        });
      }

      const plan = state.membershipPlans[planIndex]!;
      assertExpectedVersion("Contract", plan.id, plan.version, input.expectedVersion);

      const updatedPlan: MembershipPlan = {
        ...plan,
        version: plan.version + 1,
        updatedAt: new Date().toISOString(),
        name: input.name,
        priceMonthly: input.priceMonthly,
        billingCycle: input.billingCycle,
        perks: [...input.perks],
        status: input.status,
      };

      state.membershipPlans[planIndex] = updatedPlan;
      await persistState();
      return cloneRecord(updatedPlan);
    },
    async archiveMembershipPlan(tenantContext, input) {
      const plan = requireMembershipPlan(tenantContext, input.id);
      assertExpectedVersion("Contract", plan.id, plan.version, input.expectedVersion);
      const planIndex = state.membershipPlans.findIndex((entry) => entry.id === plan.id);
      const updatedPlan = {
        ...plan,
        version: plan.version + 1,
        updatedAt: new Date().toISOString(),
        status: "archived" as const,
      };
      state.membershipPlans[planIndex] = updatedPlan;
      await persistState();
      return cloneRecord(updatedPlan);
    },
    async deleteMembershipPlan(tenantContext, input) {
      const planIndex = state.membershipPlans.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.id,
      );

      if (planIndex === -1) {
        throw new AppError("Membership niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { membershipPlanId: input.id },
        });
      }

      const plan = state.membershipPlans[planIndex]!;
      assertExpectedVersion("Contract", plan.id, plan.version, input.expectedVersion);

      if (
        state.members.some(
          (entry) =>
            entry.tenantId === tenantContext.tenantId &&
            entry.membershipPlanId === plan.id,
        )
      ) {
        throw new AppError("Archiveer dit contract eerst; er zijn nog leden aan gekoppeld.", {
          code: "FORBIDDEN",
          details: { membershipPlanId: plan.id },
        });
      }

      state.membershipPlans.splice(planIndex, 1);
      await persistState();
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
    async updateTrainer(tenantContext, input) {
      requireLocation(tenantContext, input.homeLocationId);

      const trainerIndex = state.trainers.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.id,
      );

      if (trainerIndex === -1) {
        throw new AppError("Trainer niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { trainerId: input.id },
        });
      }

      const trainer = state.trainers[trainerIndex]!;
      assertExpectedVersion("Trainer", trainer.id, trainer.version, input.expectedVersion);

      const updatedTrainer: GymTrainer = {
        ...trainer,
        version: trainer.version + 1,
        updatedAt: new Date().toISOString(),
        fullName: input.fullName,
        specialties: [...input.specialties],
        certifications: [...input.certifications],
        homeLocationId: input.homeLocationId,
        status: input.status,
      };

      state.trainers[trainerIndex] = updatedTrainer;
      await persistState();
      return cloneRecord(updatedTrainer);
    },
    async archiveTrainer(tenantContext, input) {
      const trainer = requireTrainer(tenantContext, input.id);
      assertExpectedVersion("Trainer", trainer.id, trainer.version, input.expectedVersion);
      const trainerIndex = state.trainers.findIndex((entry) => entry.id === trainer.id);
      const updatedTrainer = {
        ...trainer,
        version: trainer.version + 1,
        updatedAt: new Date().toISOString(),
        status: "archived" as const,
      };
      state.trainers[trainerIndex] = updatedTrainer;
      await persistState();
      return cloneRecord(updatedTrainer);
    },
    async deleteTrainer(tenantContext, input) {
      const trainerIndex = state.trainers.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.id,
      );

      if (trainerIndex === -1) {
        throw new AppError("Trainer niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { trainerId: input.id },
        });
      }

      const trainer = state.trainers[trainerIndex]!;
      assertExpectedVersion("Trainer", trainer.id, trainer.version, input.expectedVersion);

      if (
        state.classSessions.some(
          (entry) =>
            entry.tenantId === tenantContext.tenantId &&
            entry.trainerId === trainer.id,
        )
      ) {
        throw new AppError("Archiveer deze trainer eerst; er zijn nog lessen aan gekoppeld.", {
          code: "FORBIDDEN",
          details: { trainerId: trainer.id },
        });
      }

      state.trainers.splice(trainerIndex, 1);
      await persistState();
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

      const waiverFileName =
        input.waiverStatus === "complete" ? buildWaiverFileName(member.fullName) : undefined;

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
        fileName: waiverFileName,
        storageKey: buildWaiverStorageKey(input.waiverStorageKey, waiverFileName),
      });

      await persistState();
      return cloneRecord(member);
    },
    async updateMember(tenantContext, input) {
      const nextMembershipPlan = requireMembershipPlan(tenantContext, input.membershipPlanId);
      requireLocation(tenantContext, input.homeLocationId);

      const memberIndex = state.members.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.id,
      );

      if (memberIndex === -1) {
        throw new AppError("Lid niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { memberId: input.id },
        });
      }

      const member = state.members[memberIndex]!;
      assertExpectedVersion("Lid", member.id, member.version, input.expectedVersion);

      const now = new Date().toISOString();
      const updatedMember: GymMember = {
        ...member,
        version: member.version + 1,
        updatedAt: now,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        phoneCountry: input.phoneCountry,
        membershipPlanId: input.membershipPlanId,
        homeLocationId: input.homeLocationId,
        status: input.status,
        tags: [...input.tags],
        waiverStatus: input.waiverStatus,
        nextRenewalAt:
          member.membershipPlanId === input.membershipPlanId
            ? member.nextRenewalAt
            : addMonthsToIsoDate(now, getMembershipBillingCycleMonths(nextMembershipPlan.billingCycle)),
      };

      state.members[memberIndex] = updatedMember;

      if (member.membershipPlanId !== updatedMember.membershipPlanId) {
        adjustMembershipActiveMembers(
          tenantContext,
          member.membershipPlanId,
          member.status === "active" ? -1 : 0,
          now,
        );
        adjustMembershipActiveMembers(
          tenantContext,
          updatedMember.membershipPlanId,
          updatedMember.status === "active" ? 1 : 0,
          now,
        );
      } else if (member.status !== updatedMember.status) {
        adjustMembershipActiveMembers(
          tenantContext,
          updatedMember.membershipPlanId,
          (updatedMember.status === "active" ? 1 : 0) -
            (member.status === "active" ? 1 : 0),
          now,
        );
      }

      const waiverIndex = state.waivers.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.memberId === member.id,
      );

      if (waiverIndex >= 0) {
        const waiver = state.waivers[waiverIndex]!;
        const waiverFileName =
          input.waiverStatus === "complete"
            ? waiver.fileName ?? buildWaiverFileName(updatedMember.fullName)
            : undefined;
        state.waivers[waiverIndex] = {
          ...waiver,
          version: waiver.version + 1,
          updatedAt: now,
          memberName: updatedMember.fullName,
          status: input.waiverStatus === "complete" ? "signed" : "requested",
          uploadedAt: input.waiverStatus === "complete" ? waiver.uploadedAt ?? now : undefined,
          fileName: waiverFileName,
          storageKey:
            buildWaiverStorageKey(input.waiverStorageKey, waiverFileName) ??
            (input.waiverStatus === "complete" ? waiver.storageKey : undefined),
        };
      }

      await persistState();
      return cloneRecord(updatedMember);
    },
    async archiveMember(tenantContext, input) {
      const member = requireMember(tenantContext, input.id);
      assertExpectedVersion("Lid", member.id, member.version, input.expectedVersion);
      const memberIndex = state.members.findIndex((entry) => entry.id === member.id);
      const now = new Date().toISOString();
      const updatedMember = {
        ...member,
        version: member.version + 1,
        updatedAt: now,
        status: "archived" as const,
      };
      state.members[memberIndex] = updatedMember;
      adjustMembershipActiveMembers(
        tenantContext,
        member.membershipPlanId,
        member.status === "active" ? -1 : 0,
        now,
      );
      await persistState();
      return cloneRecord(updatedMember);
    },
    async deleteMember(tenantContext, input) {
      const memberIndex = state.members.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.id,
      );

      if (memberIndex === -1) {
        throw new AppError("Lid niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { memberId: input.id },
        });
      }

      const member = state.members[memberIndex]!;
      assertExpectedVersion("Lid", member.id, member.version, input.expectedVersion);

      if (
        state.bookings.some(
          (entry) =>
            entry.tenantId === tenantContext.tenantId &&
            entry.memberId === member.id,
        )
      ) {
        throw new AppError("Archiveer dit lid eerst; er zijn nog reserveringen aan gekoppeld.", {
          code: "FORBIDDEN",
          details: { memberId: member.id },
        });
      }

      state.members.splice(memberIndex, 1);
      adjustMembershipActiveMembers(
        tenantContext,
        member.membershipPlanId,
        member.status === "active" ? -1 : 0,
        new Date().toISOString(),
      );
      state.waivers = state.waivers.filter(
        (entry) =>
          entry.tenantId !== tenantContext.tenantId || entry.memberId !== member.id,
      );
      await persistState();
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
        status: "active",
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
    async updateClassSession(tenantContext, input) {
      requireLocation(tenantContext, input.locationId);
      const trainer = requireTrainer(tenantContext, input.trainerId);

      const classSessionIndex = state.classSessions.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.id,
      );

      if (classSessionIndex === -1) {
        throw new AppError("Les niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { classSessionId: input.id },
        });
      }

      const classSession = state.classSessions[classSessionIndex]!;
      assertExpectedVersion("Les", classSession.id, classSession.version, input.expectedVersion);

      const now = new Date().toISOString();
      const updatedClassSession: ClassSession = {
        ...classSession,
        version: classSession.version + 1,
        updatedAt: now,
        title: input.title,
        locationId: input.locationId,
        trainerId: input.trainerId,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        capacity: input.capacity,
        level: input.level,
        focus: input.focus,
        status: input.status,
      };

      state.classSessions[classSessionIndex] = updatedClassSession;

      if (classSession.trainerId !== input.trainerId) {
        const previousTrainerIndex = state.trainers.findIndex(
          (entry) =>
            entry.tenantId === tenantContext.tenantId &&
            entry.id === classSession.trainerId,
        );

        if (previousTrainerIndex >= 0) {
          const previousTrainer = state.trainers[previousTrainerIndex]!;
          state.trainers[previousTrainerIndex] = {
            ...previousTrainer,
            version: previousTrainer.version + 1,
            updatedAt: now,
            classIds: previousTrainer.classIds.filter((id) => id !== classSession.id),
          };
        }

        const nextTrainerIndex = state.trainers.findIndex(
          (entry) =>
            entry.tenantId === tenantContext.tenantId && entry.id === trainer.id,
        );

        if (nextTrainerIndex >= 0 && !trainer.classIds.includes(classSession.id)) {
          state.trainers[nextTrainerIndex] = {
            ...trainer,
            version: trainer.version + 1,
            updatedAt: now,
            classIds: [...trainer.classIds, classSession.id],
          };
        }
      }

      await persistState();
      return cloneRecord(updatedClassSession);
    },
    async archiveClassSession(tenantContext, input) {
      const classSession = requireClassSession(tenantContext, input.id);
      assertExpectedVersion("Les", classSession.id, classSession.version, input.expectedVersion);
      const classSessionIndex = state.classSessions.findIndex(
        (entry) => entry.id === classSession.id,
      );
      const updatedClassSession = {
        ...classSession,
        version: classSession.version + 1,
        updatedAt: new Date().toISOString(),
        status: "archived" as const,
      };
      state.classSessions[classSessionIndex] = updatedClassSession;
      await persistState();
      return cloneRecord(updatedClassSession);
    },
    async deleteClassSession(tenantContext, input) {
      const classSessionIndex = state.classSessions.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId && entry.id === input.id,
      );

      if (classSessionIndex === -1) {
        throw new AppError("Les niet gevonden binnen deze tenant.", {
          code: "RESOURCE_NOT_FOUND",
          details: { classSessionId: input.id },
        });
      }

      const classSession = state.classSessions[classSessionIndex]!;
      assertExpectedVersion("Les", classSession.id, classSession.version, input.expectedVersion);

      if (
        state.bookings.some(
          (entry) =>
            entry.tenantId === tenantContext.tenantId &&
            entry.classSessionId === classSession.id,
        )
      ) {
        throw new AppError("Archiveer deze les eerst; er zijn nog reserveringen aan gekoppeld.", {
          code: "FORBIDDEN",
          details: { classSessionId: classSession.id },
        });
      }

      state.classSessions.splice(classSessionIndex, 1);
      const trainerIndex = state.trainers.findIndex(
        (entry) =>
          entry.tenantId === tenantContext.tenantId &&
          entry.id === classSession.trainerId,
      );

      if (trainerIndex >= 0) {
        const trainer = state.trainers[trainerIndex]!;
        state.trainers[trainerIndex] = {
          ...trainer,
          version: trainer.version + 1,
          updatedAt: new Date().toISOString(),
          classIds: trainer.classIds.filter((id) => id !== classSession.id),
        };
      }

      await persistState();
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
