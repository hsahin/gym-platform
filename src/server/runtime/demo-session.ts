import {
  createAuthActor,
  fromSessionClaims,
  JwtTokenService,
  listActorTenants,
  toSessionClaims,
  type AuthActor,
} from "@claimtech/auth";
import { createTenantContext, type TenantContext } from "@claimtech/tenant";
import type {
  AuthenticatedLocalAccount,
  LocalPlatformAccount,
} from "@/server/persistence/platform-state";
import { isProductionRuntime } from "@/server/runtime/production-readiness";
import {
  PLATFORM_ROLE_OPTIONS,
  getMembershipRole,
  getRoleKeyFromMembershipRole,
  getRoleLabel,
  type AccountRoleKey,
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
  const membershipRole = getMembershipRole(account.roleKey);

  return createAuthActor({
    subjectId: account.userId,
    email: account.email,
    displayName: account.displayName,
    globalRoles: account.roleKey === "superadmin" ? [membershipRole] : [],
    tenantMemberships: [
      {
        tenantId,
        roles: [membershipRole],
      },
    ],
  });
}

export function buildActorForAccounts(
  accounts: ReadonlyArray<
    Pick<LocalPlatformAccount, "userId" | "tenantId" | "email" | "displayName" | "roleKey">
  >,
) {
  const primaryAccount = accounts[0];

  if (!primaryAccount) {
    throw new Error("Er is minstens één account nodig om een sessie te maken.");
  }

  const subjectId =
    accounts.length > 1 && accounts.every((account) => account.roleKey === "member")
      ? `member:${primaryAccount.email}`
      : primaryAccount.userId;
  const globalRoles = accounts
    .filter((account) => account.roleKey === "superadmin")
    .map((account) => getMembershipRole(account.roleKey));

  return createAuthActor({
    subjectId,
    email: primaryAccount.email,
    displayName: primaryAccount.displayName,
    globalRoles,
    tenantMemberships: accounts.map((account) => ({
      tenantId: account.tenantId,
      roles: [getMembershipRole(account.roleKey)],
    })),
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

export async function issueSessionForAuthenticatedAccount(
  authenticated: AuthenticatedLocalAccount,
) {
  const tokenService = getTokenService();
  const claims = toSessionClaims(buildActorForAccounts(authenticated.accounts));
  return tokenService.sign(claims);
}

function resolveRoleKey(actor: AuthActor): AccountRoleKey {
  if (actor.globalRoles.includes(getMembershipRole("superadmin"))) {
    return "superadmin";
  }

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
  readonly roleKey: AccountRoleKey;
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

export type DemoRoleKey = AccountRoleKey;
export const DEMO_ROLE_OPTIONS = PLATFORM_ROLE_OPTIONS;
export const resolveDemoViewerFromToken = resolveViewerFromToken;
