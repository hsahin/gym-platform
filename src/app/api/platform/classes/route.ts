import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createClassSchema = z.object({
  title: z.string().min(2),
  seriesId: z.string().min(1).optional(),
  locationId: z.string().min(1),
  trainerId: z.string().min(1),
  startsAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  capacity: z.number().int().positive(),
  level: z.enum(["beginner", "mixed", "advanced"]),
  focus: z.string().min(2),
});
const updateClassSchema = createClassSchema.extend({
  id: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  status: z.enum(["active", "paused", "archived"]),
});
const entityMutationSchema = z.object({
  id: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});
const deleteSeriesMutationSchema = entityMutationSchema.extend({
  operation: z.literal("delete_series"),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    return services.listClassSessions(viewer.actor, viewer.tenantContext);
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = createClassSchema.parse(await request.json());

      return services.createClassSession(viewer.actor, viewer.tenantContext, payload);
    },
    { successStatus: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    const payload = await request.json();

    if (
      typeof payload === "object" &&
      payload !== null &&
      "operation" in payload &&
      payload.operation === "archive"
    ) {
      return services.archiveClassSession(
        viewer.actor,
        viewer.tenantContext,
        entityMutationSchema.parse(payload),
      );
    }

    return services.updateClassSession(
      viewer.actor,
      viewer.tenantContext,
      updateClassSchema.parse(payload),
    );
  });
}

export async function DELETE(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    const payload = await request.json();

    if (
      typeof payload === "object" &&
      payload !== null &&
      "operation" in payload &&
      payload.operation === "delete_series"
    ) {
      return services.deleteClassSessionSeries(
        viewer.actor,
        viewer.tenantContext,
        deleteSeriesMutationSchema.parse(payload),
      );
    }

    await services.deleteClassSession(
      viewer.actor,
      viewer.tenantContext,
      entityMutationSchema.parse(payload),
    );
    return { deleted: true };
  });
}
