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
