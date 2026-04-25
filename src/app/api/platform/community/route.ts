import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const communitySchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("create_group"),
    name: z.string().min(2),
    channel: z.string().min(2),
    description: z.string().min(2),
    memberIds: z.array(z.string().min(1)).default([]),
  }),
  z.object({
    operation: z.literal("create_challenge"),
    title: z.string().min(2),
    rewardLabel: z.string().min(2),
    startsAt: z.string().min(10),
    endsAt: z.string().min(10),
    participantMemberIds: z.array(z.string().min(1)).default([]),
  }),
  z.object({
    operation: z.literal("create_questionnaire"),
    title: z.string().min(2),
    trigger: z.string().min(2),
    questions: z.array(z.string().min(2)).min(1),
  }),
  z.object({
    operation: z.literal("submit_response"),
    questionnaireId: z.string().min(1),
    memberId: z.string().min(1),
    memberName: z.string().min(2),
    answers: z.array(z.string().min(1)).min(1),
  }),
]);

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();

    return (await services.getDashboardSnapshot(viewer.actor, viewer.tenantContext)).communityHub;
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);
    const services = await getGymPlatformServices();
    requireMutationSecurity(request);
    const payload = communitySchema.parse(await request.json());

    switch (payload.operation) {
      case "create_group":
        return services.createCommunityGroup(viewer.actor, viewer.tenantContext, payload);
      case "create_challenge":
        return services.createMemberChallenge(viewer.actor, viewer.tenantContext, payload);
      case "create_questionnaire":
        return services.createQuestionnaire(viewer.actor, viewer.tenantContext, payload);
      case "submit_response":
        return services.submitQuestionnaireResponse(viewer.actor, viewer.tenantContext, payload);
    }
  });
}
