import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createTrainerSchema = z.object({
  fullName: z.string().min(2),
  specialties: z.array(z.string().min(1)).default([]),
  certifications: z.array(z.string().min(1)).default([]),
  homeLocationId: z.string().min(1),
});
const updateTrainerSchema = createTrainerSchema.extend({
  id: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  status: z.enum(["active", "away", "archived"]),
});
const entityMutationSchema = z.object({
  id: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    const snapshot = await services.getDashboardSnapshot(
      viewer.actor,
      viewer.tenantContext,
    );
    return snapshot.trainers;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = createTrainerSchema.parse(await request.json());

      return services.createTrainer(viewer.actor, viewer.tenantContext, payload);
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
      return services.archiveTrainer(
        viewer.actor,
        viewer.tenantContext,
        entityMutationSchema.parse(payload),
      );
    }

    return services.updateTrainer(
      viewer.actor,
      viewer.tenantContext,
      updateTrainerSchema.parse(payload),
    );
  });
}

export async function DELETE(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    await services.deleteTrainer(
      viewer.actor,
      viewer.tenantContext,
      entityMutationSchema.parse(await request.json()),
    );
    return { deleted: true };
  });
}
