import type { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@claimtech/core";
import {
  DEFAULT_PHONE_COUNTRY,
  isSupportedPhoneCountry,
} from "@claimtech/i18n";
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
  fullName: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().min(2).optional(),
    ),
  email: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().email().optional(),
    ),
  phone: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().min(6).optional(),
    ),
  phoneCountry: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      isSupportedPhoneCountry(value) ? value : DEFAULT_PHONE_COUNTRY,
    ),
  notes: z.string().max(280).optional(),
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const services = await getGymPlatformServices();
      requireMutationSecurity(request, {
        rateLimit: {
          scope: "public.reservations",
          maxRequests: 8,
          windowMs: 5 * 60_000,
        },
      });
      const payload = createPublicReservationSchema.parse(await request.json());
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      const viewer = await resolveViewerFromToken(token);

      if (viewer?.roleKey === "member") {
        return services.createMemberReservation(viewer.actor, {
          tenantSlug: payload.tenantSlug,
          classSessionId: payload.classSessionId,
          notes: payload.notes,
        });
      }

      throw new AppError(
        "Boeken kan alleen als lid. Start een proefles, word lid of neem contact op met de gym.",
        {
          code: "FORBIDDEN",
        },
      );
    },
    { successStatus: 201 },
  );
}
