import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const appointmentsSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("create_pack"),
    memberId: z.string().min(1),
    memberName: z.string().min(2),
    trainerId: z.string().min(1),
    title: z.string().min(2),
    totalCredits: z.number().int().positive(),
    validUntil: z.string().min(10),
  }),
  z.object({
    operation: z.literal("create_sessions"),
    trainerId: z.string().min(1),
    memberId: z.string().min(1).optional(),
    memberName: z.string().min(2).optional(),
    locationId: z.string().min(1),
    startsAt: z.string().min(10),
    durationMinutes: z.number().int().positive(),
    recurrence: z.enum(["none", "weekly"]),
    occurrences: z.number().int().positive().max(12),
    creditPackId: z.string().min(1).optional(),
    notes: z.string().max(280).optional(),
  }),
]);

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();

    return (await services.getDashboardSnapshot(viewer.actor, viewer.tenantContext)).appointments;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    const payload = appointmentsSchema.parse(await request.json());

    switch (payload.operation) {
      case "create_pack":
        return services.createAppointmentPack(viewer.actor, viewer.tenantContext, payload);
      case "create_sessions":
        return services.createCoachAppointments(viewer.actor, viewer.tenantContext, payload);
    }
  });
}
