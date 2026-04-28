import { describe, expect, it } from "vitest";
import {
  PLATFORM_ROLE_OPTIONS,
  getMembershipRole,
  getRoleKeyFromMembershipRole,
  getRoleLabel,
} from "@/server/runtime/platform-roles";

describe("platform roles", () => {
  it("maps owner-facing role keys to claimtech tenant roles", () => {
    expect(PLATFORM_ROLE_OPTIONS.map((role) => role.key)).toEqual([
      "owner",
      "manager",
      "trainer",
      "frontdesk",
    ]);
    expect(getMembershipRole("owner")).toBe("gym.owner");
    expect(getMembershipRole("manager")).toBe("gym.manager");
    expect(getMembershipRole("trainer")).toBe("gym.trainer");
    expect(getMembershipRole("frontdesk")).toBe("gym.frontdesk");
    expect(getMembershipRole("superadmin")).toBe("platform.admin");
  });

  it("maps claimtech tenant roles back to dashboard role keys", () => {
    expect(getRoleKeyFromMembershipRole("gym.owner")).toBe("owner");
    expect(getRoleKeyFromMembershipRole("gym.manager")).toBe("manager");
    expect(getRoleKeyFromMembershipRole("gym.trainer")).toBe("trainer");
    expect(getRoleKeyFromMembershipRole("gym.frontdesk")).toBe("frontdesk");
    expect(getRoleKeyFromMembershipRole("platform.admin")).toBe("superadmin");
    expect(getRoleKeyFromMembershipRole("unknown")).toBeNull();
    expect(getRoleLabel("owner")).toBe("Eigenaar");
    expect(getRoleLabel("superadmin")).toBe("Superadmin");
    expect(getRoleLabel("unknown" as never)).toBe("unknown");
  });
});
