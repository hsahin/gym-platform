import {
  createAuthActor,
  fromSessionClaims,
  JwtTokenService,
  listActorTenants,
  toSessionClaims,
  type AuthActor,
} from "@claimtech/auth";
import { createTenantContext, type TenantContext } from "@claimtech/tenant";
import type { LocalPlatformAccount } from "@/server/persistence/platform-state";
import { isProductionRuntime } from "@/server/runtime/production-readiness";
import {
  PLATFORM_ROLE_OPTIONS,
  getMembershipRole,
  getRoleKeyFromMembershipRole,
  getRoleLabel,
  type PlatformRoleKey,
} from "@/server/runtime/platform-roles";

export const SESSION_COOKIE_NAME = "claimtech-gym-session";
const PRODUCT_NAME = "gym-platform";
const AUDIENCE = "gym-platform-web";

function getTokenService() {
  if (
    isProductionRuntime() &&
    (!process.env.CLAIMTECH_SESSION_SECRET ||
      process.env.CLAIMTECH_SESSION_SECRET === "replace-me")
  ) {
    throw new Error("CLAIMTECH_SESSION_SECRET is verplicht in productie.");
  }

  return new JwtTokenService({
    secret:
      process.env.CLAIMTECH_SESSION_SECRET ?? "claimtech-gym-platform-local-secret",
    issuer: PRODUCT_NAME,
    audience: AUDIENCE,
    defaultExpiresInSeconds: 60 * 60 * 8,
  });
}

export function buildPlatformActor(
  account: Pick<LocalPlatformAccount, "userId" | "email" | "displayName" | "roleKey">,
  tenantId: string,
): AuthActor {
  return createAuthActor({
    subjectId: account.userId,
    email: account.email,
    displayName: account.displayName,
    tenantMemberships: [
      {
        tenantId,
        roles: [getMembershipRole(account.roleKey)],
      },
    ],
  });
}

export async function issueSessionForAccount(
  account: Pick<LocalPlatformAccount, "userId" | "email" | "displayName" | "roleKey">,
  tenantId: string,
) {
  const tokenService = getTokenService();
  const claims = toSessionClaims(buildPlatformActor(account, tenantId));
  return tokenService.sign(claims);
}

function resolveRoleKey(actor: AuthActor): PlatformRoleKey {
  const membership = listActorTenants(actor)[0];
  const membershipRole = membership?.roles.find((role) =>
    Boolean(getRoleKeyFromMembershipRole(role)),
  );

  return (
    (membershipRole ? getRoleKeyFromMembershipRole(membershipRole) : null) ?? "manager"
  );
}

function createViewerTenantContext(actor: AuthActor, tenantContext?: TenantContext) {
  const membership = listActorTenants(actor)[0];

  if (!membership) {
    return tenantContext ?? null;
  }

  return (
    tenantContext ??
    createTenantContext({
      tenantId: membership.tenantId,
      product: PRODUCT_NAME,
      environment: process.env.NODE_ENV ?? "development",
      actorId: actor.subjectId,
    })
  );
}

export interface ViewerSession {
  readonly actor: AuthActor;
  readonly roleKey: PlatformRoleKey;
  readonly roleLabel: string;
  readonly tenantContext: TenantContext;
}

export async function resolveViewerFromToken(token?: string | null) {
  if (!token) {
    return null;
  }

  try {
    const tokenService = getTokenService();
    const verified = await tokenService.verify(token);
    const actor = fromSessionClaims(verified.claims);
    const roleKey = resolveRoleKey(actor);
    const tenantContext = createViewerTenantContext(actor);

    if (!tenantContext) {
      return null;
    }

    return {
      actor,
      roleKey,
      roleLabel: getRoleLabel(roleKey),
      tenantContext,
    } satisfies ViewerSession;
  } catch {
    return null;
  }
}

export type DemoRoleKey = PlatformRoleKey;
export const DEMO_ROLE_OPTIONS = PLATFORM_ROLE_OPTIONS;
export const resolveDemoViewerFromToken = resolveViewerFromToken;
