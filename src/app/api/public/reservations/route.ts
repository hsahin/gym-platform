import type { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@claimtech/core";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const createPublicReservationSchema = z.object({
  tenantSlug: z.string().min(2).optional(),
  classSessionId: z.string().min(1),
  notes: z.string().max(280).optional(),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      const viewer = await resolveViewerFromToken(token);

      if (!viewer) {
        throw new AppError("Log eerst in om te reserveren.", {
          code: "FORBIDDEN",
        });
      }

      if (viewer.roleKey !== "member") {
        throw new AppError("Alleen leden kunnen via deze flow reserveren.", {
          code: "FORBIDDEN",
        });
      }

      const payload = createPublicReservationSchema.parse(await request.json());

      return services.createMemberReservation(viewer.actor, {
        tenantSlug: payload.tenantSlug,
        classSessionId: payload.classSessionId,
        notes: payload.notes,
      });
    },
    { successStatus: 201 },
  );
}
