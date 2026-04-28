import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { KeyValueCacheClient } from "@claimtech/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hangingCacheClient: KeyValueCacheClient = {
  get: () => new Promise<string | null>(() => {}),
  set: () => new Promise<boolean>(() => {}),
  del: () => new Promise<number>(() => {}),
  incrBy: () => new Promise<number>(() => {}),
  expire: () => new Promise<boolean>(() => {}),
  eval: () => new Promise<number>(() => {}),
  quit: async () => {},
};

vi.mock("@claimtech/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@claimtech/cache")>();

  return {
    ...actual,
    createValkeyClient: vi.fn(async () => hangingCacheClient),
  };
});

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "gym-platform-cache-"));
  process.env.LOCAL_PLATFORM_STATE_FILE = path.join(tempDir, "platform-state.json");
  process.env.REDIS_URL = "redis://cache.example.test:6379";
  process.env.CLAIMTECH_CACHE_OPERATION_TIMEOUT_MS = "20";
  globalThis.__gymPlatformServices = undefined;
});

afterEach(async () => {
  delete process.env.LOCAL_PLATFORM_STATE_FILE;
  delete process.env.REDIS_URL;
  delete process.env.CLAIMTECH_CACHE_OPERATION_TIMEOUT_MS;
  globalThis.__gymPlatformServices = undefined;
  await rm(tempDir, { recursive: true, force: true });
});

describe("gym platform cache resilience", () => {
  it("does not block dashboard rendering when Redis operations hang after connect", async () => {
    const { bootstrapLocalPlatform } = await import("@/server/persistence/platform-state");
    const { buildPlatformActor } = await import("@/server/runtime/demo-session");
    const { createGymPlatformServices } = await import("@/server/runtime/gym-services");
    const state = await bootstrapLocalPlatform({
      tenantName: "Cache Resilience Gym",
      ownerName: "Cache Owner",
      ownerEmail: "owner@cache-resilience.test",
      password: "StrongPass123!",
    });
    const ownerAccount = state.accounts[0]!;
    const actor = buildPlatformActor(ownerAccount, state.tenant.id);
    const services = await createGymPlatformServices();
    const tenantContext = services.createRequestTenantContext(actor, state.tenant.id);

    const result = await Promise.race([
      services
        .getDashboardSnapshot(actor, tenantContext, { page: "overview" })
        .then((snapshot) => snapshot.tenantName),
      new Promise<"dashboard-timeout">((resolve) =>
        setTimeout(() => resolve("dashboard-timeout"), 250),
      ),
    ]);

    expect(result).toBe("Cache Resilience Gym");
  });
});
