import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertProductionEnvironmentReady,
  getProductionReadinessChecks,
  isProductionRuntime,
} from "@/server/runtime/production-readiness";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production readiness", () => {
  it("treats DigitalOcean or production env as live runtime", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ENV", "");
    delete process.env.DIGITALOCEAN_APP_ID;
    expect(isProductionRuntime()).toBe(false);

    vi.stubEnv("DIGITALOCEAN_APP_ID", "app-123");
    expect(isProductionRuntime()).toBe(true);
  });

  it("does not enforce runtime-only env during the Next build phase", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");

    expect(isProductionRuntime()).toBe(false);
    expect(() => assertProductionEnvironmentReady()).not.toThrow();
  });

  it("requires Mongo and a strong session secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DB_NAME;
    vi.stubEnv("CLAIMTECH_SESSION_SECRET", "replace-me");

    expect(() => assertProductionEnvironmentReady()).toThrow(
      "Productieconfiguratie mist verplichte onderdelen",
    );

    vi.stubEnv("MONGODB_URI", "mongodb://localhost:27017");
    vi.stubEnv("MONGODB_DB_NAME", "gym-platform");
    vi.stubEnv("CLAIMTECH_SESSION_SECRET", "super-secret-production-value");

    expect(() => assertProductionEnvironmentReady()).not.toThrow();
  });

  it("marks backups and monitoring as recommended readiness checks", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONGODB_URI", "mongodb://localhost:27017");
    vi.stubEnv("MONGODB_DB_NAME", "gym-platform");
    vi.stubEnv("CLAIMTECH_SESSION_SECRET", "super-secret-production-value");

    const checks = getProductionReadinessChecks();

    expect(checks.find((check) => check.key === "backups")).toMatchObject({
      ready: false,
      severity: "recommended",
    });
    expect(checks.find((check) => check.key === "monitoring")).toMatchObject({
      ready: false,
      severity: "recommended",
    });
  });
});
