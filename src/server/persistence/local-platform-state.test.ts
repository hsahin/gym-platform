import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authenticateLocalAccount,
  bootstrapLocalPlatform,
  createLocalPlatformAccount,
  getLocalTenantProfile,
  listLocalPlatformAccounts,
  listLocalTenants,
  updateLocalTenantBillingSettings,
  updateLocalTenantRemoteAccess,
} from "@/server/persistence/local-platform-state";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "gym-platform-state-"));
  process.env.LOCAL_PLATFORM_STATE_FILE = path.join(tempDir, "platform-state.json");
  process.env.PLATFORM_STATE_BACKEND = "file";
});

afterEach(async () => {
  delete process.env.LOCAL_PLATFORM_STATE_FILE;
  delete process.env.PLATFORM_STATE_BACKEND;
  await rm(tempDir, { recursive: true, force: true });
});

describe("local platform state", () => {
  it("can store multiple gyms next to each other", async () => {
    const firstTenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });
    const secondTenant = await bootstrapLocalPlatform({
      tenantName: "Atlas Forge Club",
      ownerName: "Mustafa Ali",
      ownerEmail: "owner@atlasforge.test",
      password: "AtlasPass123!",
    });

    const tenants = await listLocalTenants();

    expect(tenants.map((tenant) => tenant.id)).toEqual([
      firstTenant.tenant.id,
      secondTenant.tenant.id,
    ]);
  });

  it("authenticates accounts against the selected gym slug", async () => {
    const firstTenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await bootstrapLocalPlatform({
      tenantName: "Atlas Forge Club",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "second-pass-123",
    });

    const authenticated = await authenticateLocalAccount(
      "owner@northside.test",
      "strong-pass-123",
      firstTenant.tenant.id,
    );

    expect(authenticated?.tenant.id).toBe(firstTenant.tenant.id);
    expect(authenticated?.account.displayName).toBe("Amina Hassan");
  });

  it("keeps team accounts scoped to their own gym", async () => {
    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await createLocalPlatformAccount(tenant.tenant.id, {
      displayName: "Niels Ops",
      email: "ops@northside.test",
      password: "ops-pass-123",
      roleKey: "manager",
    });

    const northsideAccounts = await listLocalPlatformAccounts(tenant.tenant.id);

    expect(northsideAccounts).toHaveLength(2);
    expect(northsideAccounts.every((account) => account.tenantId === tenant.tenant.id)).toBe(
      true,
    );
  });

  it("stores remote access settings per gym", async () => {
    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await updateLocalTenantRemoteAccess(tenant.tenant.id, {
      enabled: true,
      provider: "nuki",
      bridgeType: "cloud_api",
      locationId: "loc_frontdoor",
      deviceLabel: "Hoofdingang",
      externalDeviceId: "nuki-lock-01",
      notes: "Owner-only remote open",
    });

    const updatedTenant = await getLocalTenantProfile(tenant.tenant.id);

    expect(updatedTenant?.remoteAccess).toMatchObject({
      enabled: true,
      provider: "nuki",
      bridgeType: "cloud_api",
      locationId: "loc_frontdoor",
      deviceLabel: "Hoofdingang",
      externalDeviceId: "nuki-lock-01",
      notes: "Owner-only remote open",
    });
  });

  it("stores billing settings per gym", async () => {
    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await updateLocalTenantBillingSettings(tenant.tenant.id, {
      enabled: true,
      provider: "mollie",
      profileLabel: "Northside Athletics Payments",
      profileId: "pfl_test_123456",
      settlementLabel: "Northside Club",
      supportEmail: "billing@northside.test",
      paymentMethods: ["direct_debit", "one_time", "payment_request"],
      notes: "Preview routing for launch week",
    });

    const updatedTenant = await getLocalTenantProfile(tenant.tenant.id);

    expect(updatedTenant?.billing).toMatchObject({
      enabled: true,
      provider: "mollie",
      profileLabel: "Northside Athletics Payments",
      profileId: "pfl_test_123456",
      settlementLabel: "Northside Club",
      supportEmail: "billing@northside.test",
      paymentMethods: ["direct_debit", "one_time", "payment_request"],
      notes: "Preview routing for launch week",
    });
  });
});
