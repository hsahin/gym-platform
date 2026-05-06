import type { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { AppError } from "@claimtech/core";
import { toDataURL } from "qrcode";
import { z } from "zod";
import {
  requireRateLimitedMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";
import type {
  MemberPaymentReturnVerification,
  MemberReservationSnapshot,
} from "@/server/types";

const memberMobileSelfServiceSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("request_payment_method_update"),
    memberId: z.string().min(1),
    memberName: z.string().min(2),
    requestedMethodLabel: z.string().min(2),
    note: z.string().max(280).optional(),
  }),
  z.object({
    operation: z.literal("request_pause"),
    memberId: z.string().min(1),
    memberName: z.string().min(2),
    startsAt: z.string().min(10),
    endsAt: z.string().min(10),
    reason: z.string().min(2).max(280),
  }),
  z.object({
    operation: z.literal("request_account_deletion"),
    memberId: z.string().min(1).optional(),
    memberName: z.string().min(2).optional(),
    email: z.string().email(),
    reason: z.string().max(280).optional(),
  }),
  z.object({
    operation: z.literal("register_push_token"),
    token: z.string().min(12).max(4096),
    platform: z.enum(["ios", "android", "web", "unknown"]).default("unknown"),
    deviceId: z.string().trim().min(1).max(160).optional(),
    permission: z.enum(["granted", "denied", "prompt"]).default("granted"),
    memberId: z.string().min(1).optional(),
  }),
]);

function memberAppSecret() {
  return (
    process.env.CLAIMTECH_SESSION_SECRET?.trim() ||
    process.env.CLAIMTECH_CSRF_SECRET?.trim() ||
    "gymos-local-member-app-pass-secret"
  );
}

function buildPassCode(snapshot: MemberReservationSnapshot) {
  const tenantPart =
    snapshot.tenantSlug
      ?.replace(/[^a-z0-9]/gi, "")
      .slice(0, 8)
      .toUpperCase() || "MEMBER";
  const dayPart = new Date().toISOString().slice(0, 10);
  const signature = createHmac("sha256", memberAppSecret())
    .update(`${snapshot.tenantSlug ?? "tenant"}:${snapshot.memberEmail}:${dayPart}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();

  return `GYMOS-${tenantPart}-${signature}`;
}

function addMinutes(isoDate: string, minutes: number) {
  return new Date(new Date(isoDate).getTime() + minutes * 60_000).toISOString();
}

async function buildMemberAppSnapshot(
  snapshot: MemberReservationSnapshot,
  paymentReturn?: MemberPaymentReturnVerification,
) {
  const code = buildPassCode(snapshot);
  const signature = createHmac("sha256", memberAppSecret())
    .update(`${snapshot.tenantSlug ?? "tenant"}:${snapshot.memberEmail}:${code}`)
    .digest("hex")
    .slice(0, 16);
  const passPayload = `gymos://member/check-in?tenant=${encodeURIComponent(
    snapshot.tenantSlug ?? "",
  )}&code=${encodeURIComponent(code)}&sig=${signature}`;
  const nextReservation = snapshot.myReservations[0] ?? null;

  return {
    tenantName: snapshot.tenantName,
    tenantSlug: snapshot.tenantSlug,
    member: {
      displayName: snapshot.memberDisplayName,
      email: snapshot.memberEmail,
    },
    checkInPass: {
      code,
      payload: passPayload,
      qrDataUrl: await toDataURL(passPayload, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
      }),
      expiresAt: addMinutes(new Date().toISOString(), 24 * 60),
    },
    nextTraining: nextReservation
      ? {
          id: nextReservation.id,
          title: nextReservation.classTitle,
          startsAt: nextReservation.startsAt,
          endsAt: addMinutes(
            nextReservation.startsAt,
            nextReservation.durationMinutes,
          ),
          durationMinutes: nextReservation.durationMinutes,
          locationName: nextReservation.locationName,
          trainerName: nextReservation.trainerName,
          status: nextReservation.status,
        }
      : null,
    walletPassUrl: null,
    paymentReturn,
    selfServiceEnabled: snapshot.selfServiceEnabled,
    selfService: snapshot.selfService,
  };
}

export async function GET(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);

    if (viewer.roleKey !== "member") {
      throw new AppError("Deze route is alleen voor member self-service.", {
        code: "FORBIDDEN",
      });
    }

    const services = await getGymPlatformServices();
    const requestUrl = new URL(request.url);
    const tenantSlug =
      requestUrl.searchParams.get("tenant") ??
      requestUrl.searchParams.get("gym") ??
      undefined;
    const invoiceId =
      requestUrl.searchParams.get("invoice") ??
      requestUrl.searchParams.get("invoiceId") ??
      undefined;
    const providerPaymentId =
      requestUrl.searchParams.get("paymentId") ??
      requestUrl.searchParams.get("molliePaymentId") ??
      undefined;
    const snapshot = await services.getMemberReservationSnapshot(viewer.actor, {
      tenantSlug,
    });
    const paymentReturn =
      invoiceId || providerPaymentId
        ? await services.verifyMemberPaymentReturn(viewer.actor, {
            tenantSlug,
            invoiceId,
            providerPaymentId,
          })
        : undefined;

    return buildMemberAppSnapshot(snapshot, paymentReturn);
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(request, async () => {
    const viewer = await requireViewerFromRequest(request);

    if (viewer.roleKey !== "member") {
      throw new AppError("Deze route is alleen voor member self-service.", {
        code: "FORBIDDEN",
      });
    }

    const services = await getGymPlatformServices();
    await requireRateLimitedMutationSecurity(request, {
      rateLimit: {
        scope: "member.mobile-self-service",
        maxRequests: 6,
        windowMs: 10 * 60_000,
      },
    });
    const payload = memberMobileSelfServiceSchema.parse(await request.json());

    switch (payload.operation) {
      case "request_payment_method_update":
        return services.requestMobilePaymentMethodUpdate(
          viewer.actor,
          viewer.tenantContext,
          payload,
        );
      case "request_pause":
        return services.requestMembershipPause(viewer.actor, viewer.tenantContext, payload);
      case "request_account_deletion":
        return services.requestMemberAccountDeletion(
          viewer.actor,
          viewer.tenantContext,
          payload,
        );
      case "register_push_token":
        return services.registerMemberPushToken(
          viewer.actor,
          viewer.tenantContext,
          payload,
        );
    }
  });
}
