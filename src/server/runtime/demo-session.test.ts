import { describe, expect, it, vi } from "vitest";
import {
  JwtTokenService,
  createAuthActor,
  listActorTenants,
  toSessionClaims,
} from "@claimtech/auth";
import {
  DEMO_ROLE_OPTIONS,
  buildPlatformActor,
  issueSessionForAccount,
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

  it("uses development tenant context when NODE_ENV is not set", async () => {
    vi.stubEnv("NODE_ENV", undefined);

    try {
      const token = await issueSessionForAccount(account, "northside-athletics");
      const viewer = await resolveViewerFromToken(token);

      expect(viewer?.tenantContext.environment).toBe("development");
    } finally {
      vi.unstubAllEnvs();
    }
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
});
