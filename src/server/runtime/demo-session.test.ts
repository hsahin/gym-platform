import { afterEach, describe, expect, it, vi } from "vitest";
import {
  JwtTokenService,
  createAuthActor,
  listActorTenants,
  toSessionClaims,
} from "@claimtech/auth";
import { toTenantId } from "@claimtech/tenant";
import {
  DEMO_ROLE_OPTIONS,
  buildActorForAccounts,
  buildPlatformActor,
  issueSessionForAccount,
  issueSessionForAuthenticatedAccount,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";

const account = {
  userId: "staff_owner",
  email: "owner@northside.test",
  displayName: "Amina Hassan",
  roleKey: "owner" as const,
};

function createTestTokenForActor(actor: ReturnType<typeof createAuthActor>) {
  const tokenService = new JwtTokenService({
    secret: process.env.CLAIMTECH_SESSION_SECRET ?? "claimtech-gym-platform-local-secret",
    issuer: "gym-platform",
    audience: "gym-platform-web",
    defaultExpiresInSeconds: 60 * 60 * 8,
  });

  return tokenService.sign(toSessionClaims(actor));
}

describe("demo session runtime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds actors with tenant memberships and dashboard role metadata", async () => {
    const actor = buildPlatformActor(account, "northside-athletics");
    const memberships = listActorTenants(actor);

    expect(actor.subjectId).toBe("staff_owner");
    expect(memberships[0]).toMatchObject({
      tenantId: "northside-athletics",
      roles: ["gym.owner"],
    });
    expect(DEMO_ROLE_OPTIONS).toHaveLength(4);
  });

  it("issues and resolves a signed viewer token", async () => {
    const token = await issueSessionForAccount(account, "northside-athletics");
    const viewer = await resolveViewerFromToken(token);

    expect(viewer).toMatchObject({
      roleKey: "owner",
      roleLabel: "Eigenaar",
    });
    expect(viewer?.tenantContext.tenantId).toBe("northside-athletics");
  });

  it("issues one session for multi-club member accounts", async () => {
    const token = await issueSessionForAuthenticatedAccount({
      account: {
        userId: "member_nina_northside",
        tenantId: toTenantId("northside-athletics"),
        email: "nina@northside.test",
        displayName: "Nina de Boer",
        roleKey: "member",
        passwordHash: "irrelevant",
        status: "active",
        createdAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
        linkedMemberId: "member_nina_northside",
      },
      tenant: {
        id: toTenantId("northside-athletics"),
        name: "Northside Athletics",
        billing: {} as never,
        legal: {} as never,
        remoteAccess: {} as never,
        createdAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
      },
      accounts: [
        {
          userId: "member_nina_northside",
          tenantId: toTenantId("northside-athletics"),
          email: "nina@northside.test",
          displayName: "Nina de Boer",
          roleKey: "member",
          passwordHash: "irrelevant",
          status: "active",
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
          linkedMemberId: "member_nina_northside",
        },
        {
          userId: "member_nina_atlas",
          tenantId: toTenantId("atlas-forge-club"),
          email: "nina@northside.test",
          displayName: "Nina de Boer",
          roleKey: "member",
          passwordHash: "irrelevant",
          status: "active",
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
          linkedMemberId: "member_nina_atlas",
        },
      ],
      tenants: [
        {
          id: toTenantId("northside-athletics"),
          name: "Northside Athletics",
          billing: {} as never,
          legal: {} as never,
          remoteAccess: {} as never,
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
        {
          id: toTenantId("atlas-forge-club"),
          name: "Atlas Forge Club",
          billing: {} as never,
          legal: {} as never,
          remoteAccess: {} as never,
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
      ],
    });
    const viewer = await resolveViewerFromToken(token);

    expect(viewer).toMatchObject({
      roleKey: "member",
      roleLabel: "Lid",
    });
    expect(listActorTenants(viewer!.actor)).toHaveLength(2);
  });

  it("uses development tenant context when NODE_ENV is not set", async () => {
    vi.stubEnv("NODE_ENV", undefined);

    const token = await issueSessionForAccount(account, "northside-athletics");
    const viewer = await resolveViewerFromToken(token);

    expect(viewer?.tenantContext.environment).toBe("development");
  });

  it("requires a real session secret before issuing production tokens", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLAIMTECH_SESSION_SECRET", "replace-me");

    await expect(
      issueSessionForAccount(account, "northside-athletics"),
    ).rejects.toThrow("CLAIMTECH_SESSION_SECRET is verplicht in productie.");
  });

  it("returns null for missing or invalid tokens", async () => {
    await expect(resolveViewerFromToken()).resolves.toBeNull();
    await expect(resolveViewerFromToken("not-a-token")).resolves.toBeNull();
  });

  it("falls back to manager role for unknown memberships", async () => {
    const token = await createTestTokenForActor(
      createAuthActor({
        subjectId: "staff_custom",
        email: "custom@northside.test",
        displayName: "Custom Role",
        tenantMemberships: [
          {
            tenantId: "northside-athletics",
            roles: ["gym.custom"],
          },
        ],
      }),
    );

    await expect(resolveViewerFromToken(token)).resolves.toMatchObject({
      roleKey: "manager",
      roleLabel: "Operations manager",
    });
  });

  it("rejects otherwise valid tokens without a tenant membership", async () => {
    const token = await createTestTokenForActor(
      createAuthActor({
        subjectId: "staff_orphan",
        email: "orphan@northside.test",
        displayName: "No Tenant",
        tenantMemberships: [],
      }),
    );

    await expect(resolveViewerFromToken(token)).resolves.toBeNull();
  });

  it("builds a combined actor for linked member accounts", async () => {
    const actor = buildActorForAccounts([
      {
        userId: "member_nina_northside",
        tenantId: toTenantId("northside-athletics"),
        email: "nina@northside.test",
        displayName: "Nina de Boer",
        roleKey: "member",
      },
      {
        userId: "member_nina_atlas",
        tenantId: toTenantId("atlas-forge-club"),
        email: "nina@northside.test",
        displayName: "Nina de Boer",
        roleKey: "member",
      },
    ]);

    expect(actor.subjectId).toBe("member:nina@northside.test");
    expect(listActorTenants(actor)).toHaveLength(2);
  });

  it("keeps the primary user id when combined accounts are not all members", () => {
    const actor = buildActorForAccounts([
      {
        userId: "owner_northside",
        tenantId: toTenantId("northside-athletics"),
        email: "owner@northside.test",
        displayName: "Amina Hassan",
        roleKey: "owner",
      },
      {
        userId: "manager_atlas",
        tenantId: toTenantId("atlas-forge-club"),
        email: "owner@northside.test",
        displayName: "Amina Hassan",
        roleKey: "manager",
      },
    ]);

    expect(actor.subjectId).toBe("owner_northside");
    expect(listActorTenants(actor)).toHaveLength(2);
  });

  it("requires at least one account to build a combined actor", () => {
    expect(() => buildActorForAccounts([])).toThrow(
      "Er is minstens één account nodig om een sessie te maken.",
    );
  });
});
