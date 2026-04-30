import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const clientLinkOwnerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email().optional(),
  address: z.object({
    streetAndNumber: z.string().trim().min(2),
    postalCode: z.string().trim().min(2),
    city: z.string().trim().min(2),
    country: z.string().trim().length(2),
  }),
  registrationNumber: z.string().trim().min(1).nullable().optional(),
  vatNumber: z.string().trim().min(1).nullable().optional(),
  legalEntity: z.string().trim().min(2),
  registrationOffice: z.string().trim().min(2),
  incorporationDate: z.string().trim().min(4).nullable().optional(),
});

const clientLinkSchema = z.object({
  owner: clientLinkOwnerSchema,
});

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = clientLinkSchema.parse(await request.json());

      return services.createMollieClientLink(viewer.actor, viewer.tenantContext, payload);
    },
    { successStatus: 201 },
  );
}
