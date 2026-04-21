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

type CollectionDocument<T> = T & TenantDocument;

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

export class MongoGymStore implements GymStore {
  constructor(private readonly databaseClient: DatabaseClient) {}

  private db(tenantContext: TenantContext) {
    return this.databaseClient.forTenant(tenantContext);
  }

  async listLocations(tenantContext: TenantContext) {
    return this.db(tenantContext)
      .collection<CollectionDocument<GymLocation>>(collections.locations)
      .findMany({}, { sort: { name: 1 } });
  }

  async listMembershipPlans(tenantContext: TenantContext) {
    return this.db(tenantContext)
      .collection<CollectionDocument<MembershipPlan>>(collections.membershipPlans)
      .findMany({}, { sort: { priceMonthly: 1 } });
  }

  async listMembers(tenantContext: TenantContext) {
    return this.db(tenantContext)
      .collection<CollectionDocument<GymMember>>(collections.members)
      .findMany({}, { sort: { fullName: 1 } });
  }

  async getMember(tenantContext: TenantContext, memberId: string) {
    return this.db(tenantContext)
      .collection<CollectionDocument<GymMember>>(collections.members)
      .findOne({ id: memberId });
  }

  async listTrainers(tenantContext: TenantContext) {
    return this.db(tenantContext)
      .collection<CollectionDocument<GymTrainer>>(collections.trainers)
      .findMany({}, { sort: { fullName: 1 } });
  }

  async listClassSessions(tenantContext: TenantContext) {
    return this.db(tenantContext)
      .collection<CollectionDocument<ClassSession>>(collections.classSessions)
      .findMany({}, { sort: { startsAt: 1 } });
  }

  async getClassSession(tenantContext: TenantContext, classSessionId: string) {
    return this.db(tenantContext)
      .collection<CollectionDocument<ClassSession>>(collections.classSessions)
      .findOne({ id: classSessionId });
  }

  async listBookings(tenantContext: TenantContext) {
    return this.db(tenantContext)
      .collection<CollectionDocument<ClassBooking>>(collections.bookings)
      .findMany({}, { sort: { createdAt: -1 } });
  }

  async listAttendance(tenantContext: TenantContext) {
    return this.db(tenantContext)
      .collection<CollectionDocument<AttendanceRecord>>(collections.attendance)
      .findMany({}, { sort: { checkedInAt: -1 } });
  }

  async listWaivers(tenantContext: TenantContext) {
    return this.db(tenantContext)
      .collection<CollectionDocument<WaiverRecord>>(collections.waivers)
      .findMany({}, { sort: { updatedAt: -1 } });
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
    };

    await this.db(tenantContext)
      .collection<CollectionDocument<MembershipPlan>>(collections.membershipPlans)
      .insertOne(membershipPlan);

    return membershipPlan;
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
      fileName:
        input.waiverStatus === "complete"
          ? `${member.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-waiver.pdf`
          : undefined,
    });

    return member;
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
      return { booking: existing, alreadyExisted: true };
    }

    const existingBooking = await bookings.findOne({
      memberId: input.memberId,
      classSessionId: input.classSessionId,
      status: { $ne: "cancelled" } as never,
    });

    if (existingBooking) {
      return { booking: existingBooking, alreadyExisted: true };
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

    return { booking, alreadyExisted: false };
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
      return { booking };
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
      booking: cancelledBooking,
      promotedBooking,
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

    return refreshedBooking;
  }
}
