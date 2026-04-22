import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createStaffSchema = z.object({
  displayName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  roleKey: z.enum(["owner", "manager", "trainer", "frontdesk"]),
});
const updateStaffSchema = z.object({
  userId: z.string().min(1),
  expectedUpdatedAt: z.string().min(1),
  displayName: z.string().min(2),
  email: z.string().email(),
  roleKey: z.enum(["owner", "manager", "trainer", "frontdesk"]),
  status: z.enum(["active", "archived"]),
});
const staffMutationSchema = z.object({
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
    );
    return snapshot.staff;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = createStaffSchema.parse(await request.json());

      return services.createStaffAccount(viewer.actor, viewer.tenantContext, payload);
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
      const parsed = staffMutationSchema.parse(payload);
      const staff = (await services.getDashboardSnapshot(
        viewer.actor,
        viewer.tenantContext,
      )).staff.find((entry) => entry.id === parsed.userId);

      if (!staff) {
        return services.updateStaffAccount(
          viewer.actor,
          viewer.tenantContext,
          {
            userId: parsed.userId,
            expectedUpdatedAt: parsed.expectedUpdatedAt,
            displayName: "Onbekend teamlid",
            email: "archived@example.invalid",
            roleKey: "frontdesk",
            status: "archived",
          },
        );
      }

      return services.updateStaffAccount(
        viewer.actor,
        viewer.tenantContext,
        {
          userId: parsed.userId,
          expectedUpdatedAt: parsed.expectedUpdatedAt,
          displayName: staff.displayName,
          email: staff.email,
          roleKey: (staff.roleKey ?? "frontdesk") as never,
          status: "archived",
        },
      );
    }

    return services.updateStaffAccount(
      viewer.actor,
      viewer.tenantContext,
      updateStaffSchema.parse(payload),
    );
  });
}

export async function DELETE(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    await services.deleteStaffAccount(
      viewer.actor,
      viewer.tenantContext,
      staffMutationSchema.parse(await request.json()),
    );
    return { deleted: true };
  });
}
