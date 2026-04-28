import { AppError } from "@claimtech/core";
import type { DatabaseClient, TenantDocument } from "@claimtech/database";
import type { TenantContext } from "@claimtech/tenant";
import { addMonthsToIsoDate, getMembershipBillingCycleMonths } from "@/lib/memberships";
import type {
  CancelBookingInput,
  CancelBookingResult,
  BookingMutationResult,
  CreateBookingInput,
  CreateClassSessionInput,
  CreateLocationInput,
  CreateMemberInput,
  CreateMembershipPlanInput,
  CreateTrainerInput,
  GymStore,
  RecordAttendanceInput,
  UpdateClassSessionInput,
  UpdateLocationInput,
  UpdateMemberInput,
  UpdateMembershipPlanInput,
  UpdateTrainerInput,
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
import { toClientPlain } from "@/server/lib/to-client-plain";

type CollectionDocument<T> = T & TenantDocument;

function toEntity<T>(document: CollectionDocument<T>): T {
  return toClientPlain(document);
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

const collections = {
  locations: "gym_locations",
  membershipPlans: "gym_membership_plans",
  members: "gym_members",
  trainers: "gym_trainers",
  classSessions: "gym_class_sessions",
  bookings: "gym_bookings",
  attendance: "gym_attendance",
  waivers: "gym_waivers",
} as const;

function withLocationDefaults(location: CollectionDocument<GymLocation>) {
  return {
    ...toEntity(location),
    status: location.status ?? "active",
  } satisfies GymLocation;
}

function withMembershipPlanDefaults(plan: CollectionDocument<MembershipPlan>) {
  return {
    ...toEntity(plan),
    status: plan.status ?? "active",
  } satisfies MembershipPlan;
}

function withMemberDefaults(member: CollectionDocument<GymMember>) {
  return {
    ...toEntity(member),
    status: member.status ?? "active",
  } satisfies GymMember;
}

function withTrainerDefaults(trainer: CollectionDocument<GymTrainer>) {
  return {
    ...toEntity(trainer),
    status: trainer.status ?? "active",
  } satisfies GymTrainer;
}

function withClassSessionDefaults(classSession: CollectionDocument<ClassSession>) {
  return {
    ...toEntity(classSession),
    status: classSession.status ?? "active",
  } satisfies ClassSession;
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

export class MongoGymStore implements GymStore {
  constructor(private readonly databaseClient: DatabaseClient) {}

  private db(tenantContext: TenantContext) {
    return this.databaseClient.forTenant(tenantContext);
  }

  async listLocations(tenantContext: TenantContext) {
    const locations = await this.db(tenantContext)
      .collection<CollectionDocument<GymLocation>>(collections.locations)
      .findMany({}, { sort: { name: 1 } });
    return locations.map(withLocationDefaults);
  }

  async listMembershipPlans(tenantContext: TenantContext) {
    const plans = await this.db(tenantContext)
      .collection<CollectionDocument<MembershipPlan>>(collections.membershipPlans)
      .findMany({}, { sort: { priceMonthly: 1 } });
    return plans.map(withMembershipPlanDefaults);
  }

  async listMembers(tenantContext: TenantContext) {
    const members = await this.db(tenantContext)
      .collection<CollectionDocument<GymMember>>(collections.members)
      .findMany({}, { sort: { fullName: 1 } });
    return members.map(withMemberDefaults);
  }

  async getMember(tenantContext: TenantContext, memberId: string) {
    const member = await this.db(tenantContext)
      .collection<CollectionDocument<GymMember>>(collections.members)
      .findOne({ id: memberId });
    return member ? withMemberDefaults(member) : null;
  }

  async listTrainers(tenantContext: TenantContext) {
    const trainers = await this.db(tenantContext)
      .collection<CollectionDocument<GymTrainer>>(collections.trainers)
      .findMany({}, { sort: { fullName: 1 } });
    return trainers.map(withTrainerDefaults);
  }

  async listClassSessions(tenantContext: TenantContext) {
    const classSessions = await this.db(tenantContext)
      .collection<CollectionDocument<ClassSession>>(collections.classSessions)
      .findMany({}, { sort: { startsAt: 1 } });
    return classSessions.map(withClassSessionDefaults);
  }

  async getClassSession(tenantContext: TenantContext, classSessionId: string) {
    const classSession = await this.db(tenantContext)
      .collection<CollectionDocument<ClassSession>>(collections.classSessions)
      .findOne({ id: classSessionId });
    return classSession ? withClassSessionDefaults(classSession) : null;
  }

  async listBookings(tenantContext: TenantContext) {
    const bookings = await this.db(tenantContext)
      .collection<CollectionDocument<ClassBooking>>(collections.bookings)
      .findMany({}, { sort: { createdAt: -1 } });
    return bookings.map((booking) => toEntity(booking));
  }

  async listAttendance(tenantContext: TenantContext) {
    const attendance = await this.db(tenantContext)
      .collection<CollectionDocument<AttendanceRecord>>(collections.attendance)
      .findMany({}, { sort: { checkedInAt: -1 } });
    return attendance.map((entry) => toEntity(entry));
  }

  async listWaivers(tenantContext: TenantContext) {
    const waivers = await this.db(tenantContext)
      .collection<CollectionDocument<WaiverRecord>>(collections.waivers)
      .findMany({}, { sort: { updatedAt: -1 } });
    return waivers.map((waiver) => toEntity(waiver));
  }

  async createLocation(tenantContext: TenantContext, input: CreateLocationInput) {
    const now = new Date().toISOString();
    const location: CollectionDocument<GymLocation> = {
      tenantId: tenantContext.tenantId,
      id: `loc_${crypto.randomUUID()}`,
      version: 1,
      createdAt: now,
      updatedAt: now,
      name: input.name,
      city: input.city,
      neighborhood: input.neighborhood,
      capacity: input.capacity,
      amenities: [...input.amenities],
      managerName: input.managerName,
      status: "active",
    };

    await this.db(tenantContext)
      .collection<CollectionDocument<GymLocation>>(collections.locations)
      .insertOne(location);

    return location;
  }

  async updateLocation(tenantContext: TenantContext, input: UpdateLocationInput) {
    const locations = this.db(tenantContext)
      .collection<CollectionDocument<GymLocation>>(collections.locations);
    const location = await locations.findOne({ id: input.id });

    if (!location) {
      throw new AppError("Vestiging niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { locationId: input.id },
      });
    }

    assertExpectedVersion("Vestiging", location.id, location.version, input.expectedVersion);

    const now = new Date().toISOString();
    const updateResult = await locations.updateOne(
      { id: location.id, version: input.expectedVersion },
      {
        set: {
          name: input.name,
          city: input.city,
          neighborhood: input.neighborhood,
          capacity: input.capacity,
          amenities: [...input.amenities],
          managerName: input.managerName,
          status: input.status,
          updatedAt: now,
        },
        increment: { version: 1 },
      },
    );

    if (updateResult.modifiedCount === 0) {
      throw new AppError("Vestiging is al gewijzigd; laad eerst opnieuw.", {
        code: "VERSION_CONFLICT",
        details: { locationId: location.id },
      });
    }

    const updatedLocation = await locations.findOne({ id: location.id });
    return withLocationDefaults(updatedLocation!);
  }

  async archiveLocation(
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ) {
    const location = await this.db(tenantContext)
      .collection<CollectionDocument<GymLocation>>(collections.locations)
      .findOne({ id: input.id });

    if (!location) {
      throw new AppError("Vestiging niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { locationId: input.id },
      });
    }

    return this.updateLocation(tenantContext, {
      ...withLocationDefaults(location),
      expectedVersion: input.expectedVersion,
      status: "archived",
    });
  }

  async deleteLocation(
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ) {
    const db = this.db(tenantContext);
    const locations = db.collection<CollectionDocument<GymLocation>>(collections.locations);
    const location = await locations.findOne({ id: input.id });

    if (!location) {
      throw new AppError("Vestiging niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { locationId: input.id },
      });
    }

    assertExpectedVersion("Vestiging", location.id, location.version, input.expectedVersion);

    const [membersUsingLocation, trainersUsingLocation, classesUsingLocation] =
      await Promise.all([
        db.collection<CollectionDocument<GymMember>>(collections.members).count({
          homeLocationId: location.id,
        }),
        db.collection<CollectionDocument<GymTrainer>>(collections.trainers).count({
          homeLocationId: location.id,
        }),
        db.collection<CollectionDocument<ClassSession>>(collections.classSessions).count({
          locationId: location.id,
        }),
      ]);

    if (membersUsingLocation + trainersUsingLocation + classesUsingLocation > 0) {
      throw new AppError("Archiveer deze vestiging eerst; er zijn nog gekoppelde leden, trainers of lessen.", {
        code: "FORBIDDEN",
        details: { locationId: location.id },
      });
    }

    await locations.deleteOne({ id: location.id, version: input.expectedVersion });
  }

  async createMembershipPlan(
    tenantContext: TenantContext,
    input: CreateMembershipPlanInput,
  ) {
    const now = new Date().toISOString();
    const membershipPlan: CollectionDocument<MembershipPlan> = {
      tenantId: tenantContext.tenantId,
      id: `plan_${crypto.randomUUID()}`,
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

    await this.db(tenantContext)
      .collection<CollectionDocument<MembershipPlan>>(collections.membershipPlans)
      .insertOne(membershipPlan);

    return membershipPlan;
  }

  async updateMembershipPlan(
    tenantContext: TenantContext,
    input: UpdateMembershipPlanInput,
  ) {
    const plans = this.db(tenantContext)
      .collection<CollectionDocument<MembershipPlan>>(collections.membershipPlans);
    const plan = await plans.findOne({ id: input.id });

    if (!plan) {
      throw new AppError("Membership niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { membershipPlanId: input.id },
      });
    }

    assertExpectedVersion("Contract", plan.id, plan.version, input.expectedVersion);

    const updateResult = await plans.updateOne(
      { id: plan.id, version: input.expectedVersion },
      {
        set: {
          name: input.name,
          priceMonthly: input.priceMonthly,
          billingCycle: input.billingCycle,
          perks: [...input.perks],
          status: input.status,
          updatedAt: new Date().toISOString(),
        },
        increment: { version: 1 },
      },
    );

    if (updateResult.modifiedCount === 0) {
      throw new AppError("Contract is al gewijzigd; laad eerst opnieuw.", {
        code: "VERSION_CONFLICT",
        details: { membershipPlanId: plan.id },
      });
    }

    const updatedPlan = await plans.findOne({ id: plan.id });
    return withMembershipPlanDefaults(updatedPlan!);
  }

  async archiveMembershipPlan(
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ) {
    const plan = await this.db(tenantContext)
      .collection<CollectionDocument<MembershipPlan>>(collections.membershipPlans)
      .findOne({ id: input.id });

    if (!plan) {
      throw new AppError("Membership niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { membershipPlanId: input.id },
      });
    }

    return this.updateMembershipPlan(tenantContext, {
      ...withMembershipPlanDefaults(plan),
      expectedVersion: input.expectedVersion,
      status: "archived",
    });
  }

  async deleteMembershipPlan(
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ) {
    const db = this.db(tenantContext);
    const plans = db.collection<CollectionDocument<MembershipPlan>>(
      collections.membershipPlans,
    );
    const plan = await plans.findOne({ id: input.id });

    if (!plan) {
      throw new AppError("Membership niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { membershipPlanId: input.id },
      });
    }

    assertExpectedVersion("Contract", plan.id, plan.version, input.expectedVersion);

    const membersUsingPlan = await db
      .collection<CollectionDocument<GymMember>>(collections.members)
      .count({ membershipPlanId: plan.id });

    if (membersUsingPlan > 0) {
      throw new AppError("Archiveer dit contract eerst; er zijn nog leden aan gekoppeld.", {
        code: "FORBIDDEN",
        details: { membershipPlanId: plan.id },
      });
    }

    await plans.deleteOne({ id: plan.id, version: input.expectedVersion });
  }

  async createTrainer(tenantContext: TenantContext, input: CreateTrainerInput) {
    const location = await this.db(tenantContext)
      .collection<CollectionDocument<GymLocation>>(collections.locations)
      .findOne({ id: input.homeLocationId });

    if (!location) {
      throw new AppError("Vestiging niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { locationId: input.homeLocationId },
      });
    }

    const now = new Date().toISOString();
    const trainer: CollectionDocument<GymTrainer> = {
      tenantId: tenantContext.tenantId,
      id: `trainer_${crypto.randomUUID()}`,
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

    await this.db(tenantContext)
      .collection<CollectionDocument<GymTrainer>>(collections.trainers)
      .insertOne(trainer);

    return trainer;
  }

  async updateTrainer(tenantContext: TenantContext, input: UpdateTrainerInput) {
    const db = this.db(tenantContext);
    const trainers = db.collection<CollectionDocument<GymTrainer>>(collections.trainers);
    const [trainer, location] = await Promise.all([
      trainers.findOne({ id: input.id }),
      db.collection<CollectionDocument<GymLocation>>(collections.locations).findOne({
        id: input.homeLocationId,
      }),
    ]);

    if (!trainer || !location) {
      throw new AppError("Trainer kon niet worden opgeslagen.", {
        code: "RESOURCE_NOT_FOUND",
        details: {
          trainerFound: Boolean(trainer),
          locationFound: Boolean(location),
        },
      });
    }

    assertExpectedVersion("Trainer", trainer.id, trainer.version, input.expectedVersion);

    const updateResult = await trainers.updateOne(
      { id: trainer.id, version: input.expectedVersion },
      {
        set: {
          fullName: input.fullName,
          specialties: [...input.specialties],
          certifications: [...input.certifications],
          homeLocationId: input.homeLocationId,
          status: input.status,
          updatedAt: new Date().toISOString(),
        },
        increment: { version: 1 },
      },
    );

    if (updateResult.modifiedCount === 0) {
      throw new AppError("Trainer is al gewijzigd; laad eerst opnieuw.", {
        code: "VERSION_CONFLICT",
        details: { trainerId: trainer.id },
      });
    }

    const updatedTrainer = await trainers.findOne({ id: trainer.id });
    return withTrainerDefaults(updatedTrainer!);
  }

  async archiveTrainer(
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ) {
    const trainer = await this.db(tenantContext)
      .collection<CollectionDocument<GymTrainer>>(collections.trainers)
      .findOne({ id: input.id });

    if (!trainer) {
      throw new AppError("Trainer niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { trainerId: input.id },
      });
    }

    return this.updateTrainer(tenantContext, {
      ...withTrainerDefaults(trainer),
      expectedVersion: input.expectedVersion,
      status: "archived",
    });
  }

  async deleteTrainer(
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ) {
    const db = this.db(tenantContext);
    const trainers = db.collection<CollectionDocument<GymTrainer>>(collections.trainers);
    const trainer = await trainers.findOne({ id: input.id });

    if (!trainer) {
      throw new AppError("Trainer niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { trainerId: input.id },
      });
    }

    assertExpectedVersion("Trainer", trainer.id, trainer.version, input.expectedVersion);

    const classesUsingTrainer = await db
      .collection<CollectionDocument<ClassSession>>(collections.classSessions)
      .count({ trainerId: trainer.id });

    if (classesUsingTrainer > 0) {
      throw new AppError("Archiveer deze trainer eerst; er zijn nog lessen aan gekoppeld.", {
        code: "FORBIDDEN",
        details: { trainerId: trainer.id },
      });
    }

    await trainers.deleteOne({ id: trainer.id, version: input.expectedVersion });
  }

  async createMember(tenantContext: TenantContext, input: CreateMemberInput) {
    const members = this.db(tenantContext).collection<CollectionDocument<GymMember>>(
      collections.members,
    );
    const plans = this.db(tenantContext).collection<CollectionDocument<MembershipPlan>>(
      collections.membershipPlans,
    );
    const locations = this.db(tenantContext).collection<CollectionDocument<GymLocation>>(
      collections.locations,
    );
    const waivers = this.db(tenantContext).collection<CollectionDocument<WaiverRecord>>(
      collections.waivers,
    );

    const [plan, location] = await Promise.all([
      plans.findOne({ id: input.membershipPlanId }),
      locations.findOne({ id: input.homeLocationId }),
    ]);

    if (!plan || !location) {
      throw new AppError("Lid kon niet worden opgeslagen.", {
        code: "RESOURCE_NOT_FOUND",
        details: {
          membershipPlanFound: Boolean(plan),
          locationFound: Boolean(location),
        },
      });
    }

    const now = new Date().toISOString();
    const member: CollectionDocument<GymMember> = {
      tenantId: tenantContext.tenantId,
      id: `member_${crypto.randomUUID()}`,
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
        getMembershipBillingCycleMonths(plan.billingCycle),
      ),
      status: input.status,
      tags: [...input.tags],
      waiverStatus: input.waiverStatus,
    };

    await members.insertOne(member);

    if (input.status === "active") {
      await plans.updateOne(
        { id: plan.id, version: plan.version },
        {
          set: { updatedAt: now },
          increment: { version: 1, activeMembers: 1 },
        },
      );
    }

    const waiverFileName =
      input.waiverStatus === "complete" ? buildWaiverFileName(member.fullName) : undefined;

    await waivers.insertOne({
      tenantId: tenantContext.tenantId,
      id: `waiver_${crypto.randomUUID()}`,
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

    return member;
  }

  async updateMember(tenantContext: TenantContext, input: UpdateMemberInput) {
    const db = this.db(tenantContext);
    const members = db.collection<CollectionDocument<GymMember>>(collections.members);
    const plans = db.collection<CollectionDocument<MembershipPlan>>(
      collections.membershipPlans,
    );
    const locations = db.collection<CollectionDocument<GymLocation>>(
      collections.locations,
    );
    const waivers = db.collection<CollectionDocument<WaiverRecord>>(collections.waivers);

    const [member, plan, location] = await Promise.all([
      members.findOne({ id: input.id }),
      plans.findOne({ id: input.membershipPlanId }),
      locations.findOne({ id: input.homeLocationId }),
    ]);

    if (!member || !plan || !location) {
      throw new AppError("Lid kon niet worden opgeslagen.", {
        code: "RESOURCE_NOT_FOUND",
        details: {
          memberFound: Boolean(member),
          membershipPlanFound: Boolean(plan),
          locationFound: Boolean(location),
        },
      });
    }

    const normalizedMember = withMemberDefaults(member);
    assertExpectedVersion(
      "Lid",
      normalizedMember.id,
      normalizedMember.version,
      input.expectedVersion,
    );

    const now = new Date().toISOString();
    const nextRenewalAt =
      normalizedMember.membershipPlanId === input.membershipPlanId
        ? normalizedMember.nextRenewalAt
        : addMonthsToIsoDate(now, getMembershipBillingCycleMonths(plan.billingCycle));

    const updateResult = await members.updateOne(
      { id: normalizedMember.id, version: input.expectedVersion },
      {
        set: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          phoneCountry: input.phoneCountry,
          membershipPlanId: input.membershipPlanId,
          homeLocationId: input.homeLocationId,
          status: input.status,
          tags: [...input.tags],
          waiverStatus: input.waiverStatus,
          nextRenewalAt,
          updatedAt: now,
        },
        increment: { version: 1 },
      },
    );

    if (updateResult.modifiedCount === 0) {
      throw new AppError("Lid is al gewijzigd; laad eerst opnieuw.", {
        code: "VERSION_CONFLICT",
        details: { memberId: normalizedMember.id },
      });
    }

    if (normalizedMember.membershipPlanId !== input.membershipPlanId) {
      if (normalizedMember.status === "active") {
        await plans.updateOne(
          { id: normalizedMember.membershipPlanId },
          { set: { updatedAt: now }, increment: { version: 1, activeMembers: -1 } },
        );
      }

      if (input.status === "active") {
        await plans.updateOne(
          { id: input.membershipPlanId },
          { set: { updatedAt: now }, increment: { version: 1, activeMembers: 1 } },
        );
      }
    } else if (normalizedMember.status !== input.status) {
      await plans.updateOne(
        { id: input.membershipPlanId },
        {
          set: { updatedAt: now },
          increment: {
            version: 1,
            activeMembers:
              (input.status === "active" ? 1 : 0) -
              (normalizedMember.status === "active" ? 1 : 0),
          },
        },
      );
    }

    const waiver = await waivers.findOne({ memberId: normalizedMember.id });
    if (waiver) {
      const waiverFileName =
        input.waiverStatus === "complete"
          ? waiver.fileName ?? buildWaiverFileName(input.fullName)
          : undefined;
      await waivers.updateOne(
        { id: waiver.id },
        {
          set: {
            memberName: input.fullName,
            status: input.waiverStatus === "complete" ? "signed" : "requested",
            uploadedAt: input.waiverStatus === "complete" ? waiver.uploadedAt ?? now : undefined,
            fileName: waiverFileName,
            storageKey:
              buildWaiverStorageKey(input.waiverStorageKey, waiverFileName) ??
              (input.waiverStatus === "complete" ? waiver.storageKey : undefined),
            updatedAt: now,
          },
          increment: { version: 1 },
        },
      );
    }

    const updatedMember = await members.findOne({ id: normalizedMember.id });
    return withMemberDefaults(updatedMember!);
  }

  async archiveMember(
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ) {
    const member = await this.getMember(tenantContext, input.id);

    if (!member) {
      throw new AppError("Lid niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { memberId: input.id },
      });
    }

    return this.updateMember(tenantContext, {
      ...member,
      expectedVersion: input.expectedVersion,
      status: "archived",
    });
  }

  async deleteMember(
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ) {
    const db = this.db(tenantContext);
    const members = db.collection<CollectionDocument<GymMember>>(collections.members);
    const member = await members.findOne({ id: input.id });

    if (!member) {
      throw new AppError("Lid niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { memberId: input.id },
      });
    }

    const normalizedMember = withMemberDefaults(member);
    assertExpectedVersion(
      "Lid",
      normalizedMember.id,
      normalizedMember.version,
      input.expectedVersion,
    );

    const linkedBookings = await db
      .collection<CollectionDocument<ClassBooking>>(collections.bookings)
      .count({ memberId: normalizedMember.id });

    if (linkedBookings > 0) {
      throw new AppError("Archiveer dit lid eerst; er zijn nog reserveringen aan gekoppeld.", {
        code: "FORBIDDEN",
        details: { memberId: normalizedMember.id },
      });
    }

    await members.deleteOne({ id: normalizedMember.id, version: input.expectedVersion });
    await db
      .collection<CollectionDocument<WaiverRecord>>(collections.waivers)
      .deleteOne({ memberId: normalizedMember.id });

    if (normalizedMember.status === "active") {
      await db
        .collection<CollectionDocument<MembershipPlan>>(collections.membershipPlans)
        .updateOne(
          { id: normalizedMember.membershipPlanId },
          {
            set: { updatedAt: new Date().toISOString() },
            increment: { version: 1, activeMembers: -1 },
          },
        );
    }
  }

  async createClassSession(
    tenantContext: TenantContext,
    input: CreateClassSessionInput,
  ) {
    const classSessions = this.db(tenantContext).collection<
      CollectionDocument<ClassSession>
    >(collections.classSessions);
    const trainers = this.db(tenantContext).collection<
      CollectionDocument<GymTrainer>
    >(collections.trainers);
    const locations = this.db(tenantContext).collection<
      CollectionDocument<GymLocation>
    >(collections.locations);

    const [trainer, location] = await Promise.all([
      trainers.findOne({ id: input.trainerId }),
      locations.findOne({ id: input.locationId }),
    ]);

    if (!trainer || !location) {
      throw new AppError("Les kon niet worden opgeslagen.", {
        code: "RESOURCE_NOT_FOUND",
        details: {
          trainerFound: Boolean(trainer),
          locationFound: Boolean(location),
        },
      });
    }

    const now = new Date().toISOString();
    const classSession: CollectionDocument<ClassSession> = {
      tenantId: tenantContext.tenantId,
      id: `class_${crypto.randomUUID()}`,
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

    await classSessions.insertOne(classSession);
    await trainers.updateOne(
      { id: trainer.id, version: trainer.version },
      {
        set: { updatedAt: now, classIds: [...trainer.classIds, classSession.id] },
        increment: { version: 1 },
      },
    );

    return classSession;
  }

  async updateClassSession(
    tenantContext: TenantContext,
    input: UpdateClassSessionInput,
  ) {
    const db = this.db(tenantContext);
    const classSessions = db.collection<CollectionDocument<ClassSession>>(
      collections.classSessions,
    );
    const trainers = db.collection<CollectionDocument<GymTrainer>>(collections.trainers);
    const locations = db.collection<CollectionDocument<GymLocation>>(
      collections.locations,
    );

    const [classSession, trainer, location] = await Promise.all([
      classSessions.findOne({ id: input.id }),
      trainers.findOne({ id: input.trainerId }),
      locations.findOne({ id: input.locationId }),
    ]);

    if (!classSession || !trainer || !location) {
      throw new AppError("Les kon niet worden opgeslagen.", {
        code: "RESOURCE_NOT_FOUND",
        details: {
          classSessionFound: Boolean(classSession),
          trainerFound: Boolean(trainer),
          locationFound: Boolean(location),
        },
      });
    }

    const normalizedClassSession = withClassSessionDefaults(classSession);
    assertExpectedVersion(
      "Les",
      normalizedClassSession.id,
      normalizedClassSession.version,
      input.expectedVersion,
    );

    const now = new Date().toISOString();
    const updateResult = await classSessions.updateOne(
      { id: normalizedClassSession.id, version: input.expectedVersion },
      {
        set: {
          title: input.title,
          locationId: input.locationId,
          trainerId: input.trainerId,
          startsAt: input.startsAt,
          durationMinutes: input.durationMinutes,
          capacity: input.capacity,
          level: input.level,
          focus: input.focus,
          status: input.status,
          updatedAt: now,
        },
        increment: { version: 1 },
      },
    );

    if (updateResult.modifiedCount === 0) {
      throw new AppError("Les is al gewijzigd; laad eerst opnieuw.", {
        code: "VERSION_CONFLICT",
        details: { classSessionId: normalizedClassSession.id },
      });
    }

    if (normalizedClassSession.trainerId !== input.trainerId) {
      const previousTrainer = await trainers.findOne({
        id: normalizedClassSession.trainerId,
      });

      if (previousTrainer) {
        await trainers.updateOne(
          { id: previousTrainer.id },
          {
            set: {
              updatedAt: now,
              classIds: previousTrainer.classIds.filter(
                (id) => id !== normalizedClassSession.id,
              ),
            },
            increment: { version: 1 },
          },
        );
      }

      if (!trainer.classIds.includes(normalizedClassSession.id)) {
        await trainers.updateOne(
          { id: trainer.id },
          {
            set: {
              updatedAt: now,
              classIds: [...trainer.classIds, normalizedClassSession.id],
            },
            increment: { version: 1 },
          },
        );
      }
    }

    const updatedClassSession = await classSessions.findOne({
      id: normalizedClassSession.id,
    });
    return withClassSessionDefaults(updatedClassSession!);
  }

  async archiveClassSession(
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ) {
    const classSession = await this.getClassSession(tenantContext, input.id);

    if (!classSession) {
      throw new AppError("Les niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { classSessionId: input.id },
      });
    }

    return this.updateClassSession(tenantContext, {
      ...classSession,
      expectedVersion: input.expectedVersion,
      status: "archived",
    });
  }

  async deleteClassSession(
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ) {
    const db = this.db(tenantContext);
    const classSessions = db.collection<CollectionDocument<ClassSession>>(
      collections.classSessions,
    );
    const classSession = await classSessions.findOne({ id: input.id });

    if (!classSession) {
      throw new AppError("Les niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { classSessionId: input.id },
      });
    }

    const normalizedClassSession = withClassSessionDefaults(classSession);
    assertExpectedVersion(
      "Les",
      normalizedClassSession.id,
      normalizedClassSession.version,
      input.expectedVersion,
    );

    const linkedBookings = await db
      .collection<CollectionDocument<ClassBooking>>(collections.bookings)
      .count({ classSessionId: normalizedClassSession.id });

    if (linkedBookings > 0) {
      throw new AppError("Archiveer deze les eerst; er zijn nog reserveringen aan gekoppeld.", {
        code: "FORBIDDEN",
        details: { classSessionId: normalizedClassSession.id },
      });
    }

    await classSessions.deleteOne({
      id: normalizedClassSession.id,
      version: input.expectedVersion,
    });

    const trainers = db.collection<CollectionDocument<GymTrainer>>(collections.trainers);
    const trainer = await trainers.findOne({ id: normalizedClassSession.trainerId });
    if (trainer) {
      await trainers.updateOne(
        { id: trainer.id },
        {
          set: {
            updatedAt: new Date().toISOString(),
            classIds: trainer.classIds.filter((id) => id !== normalizedClassSession.id),
          },
          increment: { version: 1 },
        },
      );
    }
  }

  async createBooking(
    tenantContext: TenantContext,
    input: CreateBookingInput,
  ): Promise<BookingMutationResult> {
    const bookings = this.db(tenantContext).collection<CollectionDocument<ClassBooking>>(
      collections.bookings,
    );
    const members = this.db(tenantContext).collection<CollectionDocument<GymMember>>(
      collections.members,
    );
    const classSessions = this.db(tenantContext).collection<
      CollectionDocument<ClassSession>
    >(collections.classSessions);

    const existing = await bookings.findOne({ idempotencyKey: input.idempotencyKey });

    if (existing) {
      return { booking: toEntity(existing), alreadyExisted: true };
    }

    const existingBooking = await bookings.findOne({
      memberId: input.memberId,
      classSessionId: input.classSessionId,
      status: { $ne: "cancelled" } as never,
    });

    if (existingBooking) {
      return { booking: toEntity(existingBooking), alreadyExisted: true };
    }

    const member = await members.findOne({ id: input.memberId });
    const classSession = await classSessions.findOne({ id: input.classSessionId });

    if (!member || !classSession) {
      throw new AppError("Boeking kon niet worden samengesteld.", {
        code: "RESOURCE_NOT_FOUND",
        details: {
          memberFound: Boolean(member),
          classSessionFound: Boolean(classSession),
        },
      });
    }

    const now = new Date().toISOString();
    const isConfirmed = classSession.bookedCount < classSession.capacity;

    const booking: CollectionDocument<ClassBooking> = {
      tenantId: tenantContext.tenantId,
      id: `booking_${crypto.randomUUID()}`,
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

    await bookings.insertOne(booking);
    await classSessions.updateOne(
      { id: classSession.id, version: classSession.version },
      {
        set: { updatedAt: now },
        increment: {
          version: 1,
          bookedCount: isConfirmed ? 1 : 0,
          waitlistCount: isConfirmed ? 0 : 1,
        },
      },
    );

    return { booking: toEntity(booking), alreadyExisted: false };
  }

  async cancelBooking(
    tenantContext: TenantContext,
    input: CancelBookingInput,
  ): Promise<CancelBookingResult> {
    const bookings = this.db(tenantContext).collection<CollectionDocument<ClassBooking>>(
      collections.bookings,
    );
    const classSessions = this.db(tenantContext).collection<
      CollectionDocument<ClassSession>
    >(collections.classSessions);

    const booking = await bookings.findOne({ id: input.bookingId });

    if (!booking) {
      throw new AppError("Boeking niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { bookingId: input.bookingId },
      });
    }

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
      return { booking: toEntity(booking) };
    }

    if (booking.status === "checked_in") {
      throw new AppError("Een ingecheckte booking kan niet meer geannuleerd worden.", {
        code: "FORBIDDEN",
        details: { bookingId: booking.id },
      });
    }

    const classSession = await classSessions.findOne({ id: booking.classSessionId });

    if (!classSession) {
      throw new AppError("Les niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { classSessionId: booking.classSessionId },
      });
    }

    const now = new Date().toISOString();
    const bookingUpdate = await bookings.updateOne(
      { id: booking.id, version: input.expectedVersion },
      {
        set: {
          status: "cancelled",
          updatedAt: now,
        },
        increment: { version: 1 },
      },
    );

    if (bookingUpdate.modifiedCount === 0) {
      throw new AppError("De boeking is al gewijzigd; laad eerst opnieuw.", {
        code: "VERSION_CONFLICT",
        details: {
          bookingId: booking.id,
          expectedVersion: input.expectedVersion,
          actualVersion: booking.version,
        },
      });
    }

    let sessionIncrements = {
      version: 1,
      bookedCount: booking.status === "confirmed" ? -1 : 0,
      waitlistCount: booking.status === "waitlisted" ? -1 : 0,
    };

    let promotedBooking: CollectionDocument<ClassBooking> | undefined;

    if (booking.status === "confirmed") {
      const waitlistedBooking = (
        await bookings.findMany(
          {
            classSessionId: classSession.id,
            status: "waitlisted",
          },
          {
            sort: { createdAt: 1 },
            limit: 1,
          },
        )
      )[0];

      if (waitlistedBooking) {
        const promotedAt = new Date().toISOString();
        const promotedUpdate = await bookings.updateOne(
          { id: waitlistedBooking.id, version: waitlistedBooking.version },
          {
            set: {
              status: "confirmed",
              updatedAt: promotedAt,
            },
            increment: { version: 1 },
          },
        );

        if (promotedUpdate.modifiedCount > 0) {
          promotedBooking = await bookings.findOne({ id: waitlistedBooking.id }) ?? undefined;

          sessionIncrements = {
            version: 1,
            bookedCount: 0,
            waitlistCount: -1,
          };
        }
      }
    }

    await classSessions.updateOne(
      { id: classSession.id, version: classSession.version },
      {
        set: { updatedAt: now },
        increment: sessionIncrements,
      },
    );

    const cancelledBooking = await bookings.findOne({ id: booking.id });

    if (!cancelledBooking) {
      throw new AppError("Bijgewerkte boeking kon niet worden teruggelezen.", {
        code: "RESOURCE_NOT_FOUND",
      });
    }

    return {
      booking: toEntity(cancelledBooking),
      promotedBooking: promotedBooking ? toEntity(promotedBooking) : undefined,
    };
  }

  async recordAttendance(tenantContext: TenantContext, input: RecordAttendanceInput) {
    const bookings = this.db(tenantContext).collection<CollectionDocument<ClassBooking>>(
      collections.bookings,
    );
    const attendance = this.db(tenantContext).collection<
      CollectionDocument<AttendanceRecord>
    >(collections.attendance);

    const booking = await bookings.findOne({ id: input.bookingId });

    if (!booking) {
      throw new AppError("Boeking niet gevonden binnen deze tenant.", {
        code: "RESOURCE_NOT_FOUND",
        details: { bookingId: input.bookingId },
      });
    }

    const updateResult = await bookings.updateOne(
      { id: booking.id, version: input.expectedVersion },
      {
        set: {
          status: "checked_in",
          updatedAt: new Date().toISOString(),
        },
        increment: { version: 1 },
      },
    );

    if (updateResult.modifiedCount === 0) {
      throw new AppError("De boeking is al gewijzigd; laad eerst opnieuw.", {
        code: "VERSION_CONFLICT",
        details: {
          bookingId: booking.id,
          expectedVersion: input.expectedVersion,
          actualVersion: booking.version,
        },
      });
    }

    const refreshedBooking = await bookings.findOne({ id: booking.id });

    if (!refreshedBooking) {
      throw new AppError("Bijgewerkte boeking kon niet worden teruggelezen.", {
        code: "RESOURCE_NOT_FOUND",
      });
    }

    const existingAttendance = await attendance.findOne({ bookingId: booking.id });

    if (!existingAttendance) {
      await attendance.insertOne({
        tenantId: tenantContext.tenantId,
        id: `attendance_${crypto.randomUUID()}`,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        classSessionId: refreshedBooking.classSessionId,
        bookingId: refreshedBooking.id,
        memberId: refreshedBooking.memberId,
        checkedInAt: new Date().toISOString(),
        channel: input.channel,
      });
    }

    return toEntity(refreshedBooking);
  }
}
