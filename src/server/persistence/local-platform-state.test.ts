import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyGymStoreState } from "@/server/persistence/memory-gym-store";
import {
  authenticateLocalAccount,
  bootstrapLocalPlatform,
  createLocalPlatformAccount,
  getLocalTenantProfile,
  getLocalTenantProfileBySlug,
  hasLocalPlatformSetup,
  listLocalPlatformAccounts,
  listLocalTenants,
  markLocalTenantBillingAction,
  markLocalTenantRemoteAccessAction,
  readLocalPlatformState,
  slugifyTenantName,
  updateLocalTenantBillingSettings,
  updateLocalPlatformData,
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
  it("starts empty and derives stable tenant slugs", async () => {
    await expect(readLocalPlatformState()).resolves.toBeNull();
    await expect(hasLocalPlatformSetup()).resolves.toBe(false);
    await expect(listLocalTenants()).resolves.toEqual([]);
    await expect(listLocalPlatformAccounts()).resolves.toEqual([]);
    await expect(getLocalTenantProfile()).resolves.toBeNull();
    await expect(getLocalTenantProfileBySlug("missing")).resolves.toBeNull();
    await expect(authenticateLocalAccount("missing@example.test", "password")).resolves.toBeNull();
    expect(slugifyTenantName(" Atlas Forge Club! ")).toBe("atlas-forge-club");
    expect(slugifyTenantName("!!!")).toBe("gym-platform");
  });

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
    await expect(hasLocalPlatformSetup()).resolves.toBe(true);
    await expect(getLocalTenantProfile()).resolves.toMatchObject({
      id: firstTenant.tenant.id,
    });
    await expect(getLocalTenantProfileBySlug("ATLAS-FORGE-CLUB")).resolves.toMatchObject({
      id: secondTenant.tenant.id,
    });
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
    await expect(
      authenticateLocalAccount("owner@northside.test", "wrong-pass", firstTenant.tenant.id),
    ).resolves.toBeNull();
    await expect(
      authenticateLocalAccount("unknown@northside.test", "strong-pass-123", firstTenant.tenant.id),
    ).resolves.toBeNull();
    await expect(
      authenticateLocalAccount("owner@northside.test", "strong-pass-123"),
    ).resolves.toBeNull();
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

  it("rejects duplicate setup and invalid team account mutations", async () => {
    await expect(
      createLocalPlatformAccount("missing", {
        displayName: "Niels Ops",
        email: "ops@northside.test",
        password: "ops-pass-123",
        roleKey: "manager",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await expect(
      bootstrapLocalPlatform({
        tenantName: "Northside Athletics",
        ownerName: "Other Owner",
        ownerEmail: "other@northside.test",
        password: "strong-pass-123",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      createLocalPlatformAccount("missing", {
        displayName: "Niels Ops",
        email: "ops@northside.test",
        password: "ops-pass-123",
        roleKey: "manager",
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    await createLocalPlatformAccount(tenant.tenant.id, {
      displayName: "Niels Ops",
      email: " Ops@Northside.Test ",
      password: "ops-pass-123",
      roleKey: "manager",
    });
    await expect(
      createLocalPlatformAccount(tenant.tenant.id, {
        displayName: "Niels Duplicate",
        email: "ops@northside.test",
        password: "ops-pass-123",
        roleKey: "manager",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
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
    expect(updatedTenant?.remoteAccess.lastValidatedAt).toEqual(expect.any(String));
  });

  it("rejects remote access updates before setup or for unknown gyms", async () => {
    await expect(
      updateLocalTenantRemoteAccess("missing", {
        enabled: true,
        provider: "nuki",
        bridgeType: "cloud_api",
        locationId: null,
        deviceLabel: "Hoofdingang",
        externalDeviceId: "nuki-lock-01",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await expect(
      updateLocalTenantRemoteAccess("missing", {
        enabled: true,
        provider: "nuki",
        bridgeType: "cloud_api",
        locationId: null,
        deviceLabel: "Hoofdingang",
        externalDeviceId: "nuki-lock-01",
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
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
    expect(updatedTenant?.billing.lastValidatedAt).toEqual(expect.any(String));
  });

  it("rejects billing updates before setup or for unknown gyms", async () => {
    await expect(
      updateLocalTenantBillingSettings("missing", {
        enabled: true,
        provider: "mollie",
        profileLabel: "Northside Payments",
        profileId: "pfl_test_123",
        settlementLabel: "Northside",
        supportEmail: "billing@northside.test",
        paymentMethods: ["one_time"],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await expect(
      updateLocalTenantBillingSettings("missing", {
        enabled: true,
        provider: "mollie",
        profileLabel: "Northside Payments",
        profileId: "pfl_test_123",
        settlementLabel: "Northside",
        supportEmail: "billing@northside.test",
        paymentMethods: ["one_time"],
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("marks remote and billing actions and stores gym data changes", async () => {
    await expect(markLocalTenantRemoteAccessAction("missing", "Owner")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(markLocalTenantBillingAction("missing", "Owner")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(updateLocalPlatformData((data) => data)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const tenant = await bootstrapLocalPlatform({
      tenantName: "Northside Athletics",
      ownerName: "Amina Hassan",
      ownerEmail: "owner@northside.test",
      password: "strong-pass-123",
    });

    await expect(
      markLocalTenantRemoteAccessAction("missing", "Owner"),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    await expect(markLocalTenantBillingAction("missing", "Owner")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });

    await markLocalTenantRemoteAccessAction(tenant.tenant.id, "Amina");
    await markLocalTenantBillingAction(tenant.tenant.id, "Amina");
    const updated = await updateLocalPlatformData((data) => ({
      ...data,
      locations: [
        {
          tenantId: tenant.tenant.id,
          id: "loc_manual",
          version: 1,
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
          name: "Manual Location",
          city: "Amsterdam",
          neighborhood: "Oost",
          capacity: 10,
          managerName: "Amina",
          amenities: [],
          status: "active",
        },
      ],
    }));

    expect(updated.tenants[0]?.remoteAccess.lastRemoteActionBy).toBe("Amina");
    expect(updated.tenants[0]?.billing.lastPaymentActionBy).toBe("Amina");
    expect(updated.data.locations).toHaveLength(1);
  });

  it("normalizes persisted state and migrates legacy single-gym state", async () => {
    const stateFile = process.env.LOCAL_PLATFORM_STATE_FILE!;
    const data = createEmptyGymStoreState();
    await writeFile(
      stateFile,
      JSON.stringify({
        version: 2,
        tenants: [
          {
            id: "legacy-gym",
            name: "Legacy Gym",
            createdAt: "2026-04-21T00:00:00.000Z",
            updatedAt: "2026-04-21T00:00:00.000Z",
          },
        ],
        accounts: [],
        data,
      }),
      "utf8",
    );

    const normalized = await readLocalPlatformState();
    const normalizedRaw = await readFile(stateFile, "utf8");

    expect(normalized?.tenants[0]?.billing.provider).toBe("mollie");
    expect(normalized?.tenants[0]?.remoteAccess.provider).toBe("nuki");
    expect(normalizedRaw).toContain("remoteAccess");

    await writeFile(
      stateFile,
      JSON.stringify({
        version: 1,
        tenant: {
          id: "single-gym",
          name: "Single Gym",
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
        accounts: [
          {
            userId: "staff_legacy",
            email: "owner@single.test",
            displayName: "Legacy Owner",
            roleKey: "owner",
            passwordHash: "invalid",
            status: "active",
            createdAt: "2026-04-21T00:00:00.000Z",
            updatedAt: "2026-04-21T00:00:00.000Z",
          },
        ],
        data,
      }),
      "utf8",
    );

    const migrated = await readLocalPlatformState();

    expect(migrated).toMatchObject({
      version: 2,
      tenants: [expect.objectContaining({ id: "single-gym" })],
      accounts: [expect.objectContaining({ tenantId: "single-gym" })],
    });
  });

  it("rejects persisted state with an unexpected version", async () => {
    await writeFile(
      process.env.LOCAL_PLATFORM_STATE_FILE!,
      JSON.stringify({
        version: 999,
        tenants: [],
        accounts: [],
        data: createEmptyGymStoreState(),
      }),
      "utf8",
    );

    await expect(readLocalPlatformState()).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});
