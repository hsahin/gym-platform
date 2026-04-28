import type { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@claimtech/core";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createOwnerAccountSchema = z.object({
  tenantId: z.string().min(1),
  displayName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const updateOwnerAccountSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  expectedUpdatedAt: z.string().min(1),
  displayName: z.string().min(2),
  email: z.string().email(),
  status: z.enum(["active", "archived"]),
});

const ownerAccountMutationSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  expectedUpdatedAt: z.string().min(1),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    const snapshot = await services.getDashboardSnapshot(
      viewer.actor,
      viewer.tenantContext,
      { page: "superadmin" },
    );

    if (!snapshot.uiCapabilities.canManageOwnerAccounts) {
      throw new AppError("Alleen superadmins kunnen gym owner accounts beheren.", {
        code: "FORBIDDEN",
      });
    }

    return snapshot.superadmin;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      return services.createGymOwnerAccount(
        viewer.actor,
        viewer.tenantContext,
        createOwnerAccountSchema.parse(await request.json()),
      );
    },
    { successStatus: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    return services.updateGymOwnerAccount(
      viewer.actor,
      viewer.tenantContext,
      updateOwnerAccountSchema.parse(await request.json()),
    );
  });
}

export async function DELETE(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    await services.deleteGymOwnerAccount(
      viewer.actor,
      viewer.tenantContext,
      ownerAccountMutationSchema.parse(await request.json()),
    );
    return { deleted: true };
  });
}
