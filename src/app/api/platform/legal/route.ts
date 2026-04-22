import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const legalSettingsSchema = z.object({
  termsUrl: z.string().min(1),
  privacyUrl: z.string().min(1),
  sepaCreditorId: z.string().min(1),
  sepaMandateText: z.string().min(12),
  contractPdfTemplateKey: z.string().min(1),
  waiverStorageKey: z.string().min(1),
  waiverRetentionMonths: z.number().int().positive(),
});

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    const snapshot = await services.getDashboardSnapshot(
      viewer.actor,
      viewer.tenantContext,
    );
    return snapshot.legal;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    return services.updateLegalSettings(
      viewer.actor,
      viewer.tenantContext,
      legalSettingsSchema.parse(await request.json()),
    );
  });
}
