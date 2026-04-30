import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertLiveInfrastructureConfiguration,
  assertProductionEnvironmentReady,
  getLiveInfrastructureConfigurationIssues,
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

  it("treats a production start without extra app markers as live runtime", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "");
    delete process.env.DIGITALOCEAN_APP_ID;

    expect(isProductionRuntime()).toBe(true);
    expect(() => assertLiveInfrastructureConfiguration()).toThrow(
      "Live infrastructuurconfiguratie mist onderdelen",
    );
  });

  it("requires Mongo and a strong session secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DB_NAME;
    delete process.env.REDIS_URL;
    vi.stubEnv("CLAIMTECH_SESSION_SECRET", "replace-me");

    expect(() => assertProductionEnvironmentReady()).toThrow(
      "Productieconfiguratie mist verplichte onderdelen",
    );

    vi.stubEnv("MONGODB_URI", "mongodb://localhost:27017");
    vi.stubEnv("MONGODB_DB_NAME", "gym-platform");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("CLAIMTECH_SESSION_SECRET", "super-secret-production-value");

    expect(() => assertProductionEnvironmentReady()).not.toThrow();
  });

  it("marks backups and monitoring as recommended readiness checks", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("MONGODB_URI", "mongodb://localhost:27017");
    vi.stubEnv("MONGODB_DB_NAME", "gym-platform");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("CLAIMTECH_SESSION_SECRET", "super-secret-production-value");

    const checks = getProductionReadinessChecks();

    expect(checks.find((check) => check.key === "cache")).toMatchObject({
      ready: true,
      severity: "required",
    });
    expect(checks.find((check) => check.key === "backups")).toMatchObject({
      ready: false,
      severity: "recommended",
    });
    expect(checks.find((check) => check.key === "monitoring")).toMatchObject({
      ready: false,
      severity: "recommended",
    });
  });

  it("keeps local fallback readiness neutral while production env is absent", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ENV", "");
    delete process.env.DIGITALOCEAN_APP_ID;
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DB_NAME;
    delete process.env.REDIS_URL;
    delete process.env.CLAIMTECH_SESSION_SECRET;

    const checks = getProductionReadinessChecks();

    expect(checks.find((check) => check.key === "mongo")).toMatchObject({
      ready: true,
      helpText: expect.stringContaining("Lokale fallback"),
    });
    expect(checks.find((check) => check.key === "session-secret")).toMatchObject({
      ready: true,
      helpText: expect.stringContaining("Lokale fallback"),
    });
    expect(checks.find((check) => check.key === "cache")).toMatchObject({
      ready: true,
      helpText: expect.stringContaining("Lokale fallback"),
    });
  });

  it("fails fast on incomplete live messaging configuration", () => {
    vi.stubEnv("ENABLE_REAL_MESSAGES", "true");
    vi.stubEnv("WAHA_BASE_URL", "https://waha.example");

    expect(() => assertLiveInfrastructureConfiguration()).toThrow(
      "Live infrastructuurconfiguratie mist onderdelen: Live berichten.",
    );

    expect(getLiveInfrastructureConfigurationIssues()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "messaging",
          missingEnv: ["WAHA_API_KEY"],
        }),
      ]),
    );
  });

  it("fails fast on partially configured messaging even without the legacy enable flag", () => {
    vi.stubEnv("WAHA_BASE_URL", "https://waha.example");

    expect(() => assertLiveInfrastructureConfiguration()).toThrow(
      "Live infrastructuurconfiguratie mist onderdelen: Live berichten.",
    );
  });

  it("fails fast on incomplete live uploads configuration", () => {
    vi.stubEnv("ENABLE_REAL_UPLOADS", "true");
    vi.stubEnv("SPACES_BUCKET", "gym-files");

    expect(() => assertLiveInfrastructureConfiguration()).toThrow(
      "Live infrastructuurconfiguratie mist onderdelen: Cloudopslag.",
    );

    expect(getLiveInfrastructureConfigurationIssues()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "storage",
          missingEnv: expect.arrayContaining([
            "SPACES_ENDPOINT",
            "SPACES_REGION",
            "SPACES_ACCESS_KEY_ID",
            "SPACES_SECRET_ACCESS_KEY",
          ]),
        }),
      ]),
    );
  });

  it("accepts DigitalOcean Spaces access key aliases for live uploads", () => {
    vi.stubEnv("ENABLE_REAL_UPLOADS", "true");
    vi.stubEnv("SPACES_BUCKET", "gym-files");
    vi.stubEnv("SPACES_ENDPOINT", "ams3.digitaloceanspaces.com");
    vi.stubEnv("SPACES_REGION", "ams3");
    vi.stubEnv("SPACES_ACCESS_KEY", "spaces-key");
    vi.stubEnv("SPACES_SECRET_KEY", "spaces-secret");

    expect(() => assertLiveInfrastructureConfiguration()).not.toThrow();
    expect(
      getLiveInfrastructureConfigurationIssues().some((issue) => issue.key === "storage"),
    ).toBe(false);
  });

  it("does not block live runtime on partial Spaces env unless uploads are explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("MONGODB_URI", "mongodb://localhost:27017");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("SPACES_BUCKET", "gym-files");

    expect(() => assertLiveInfrastructureConfiguration()).not.toThrow();
    expect(
      getLiveInfrastructureConfigurationIssues().some((issue) => issue.key === "storage"),
    ).toBe(false);
  });

  it("fails fast when runtime datastores are not configured", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(() => assertLiveInfrastructureConfiguration()).not.toThrow();
    expect(
      getLiveInfrastructureConfigurationIssues().some(
        (issue) => issue.key === "runtime-datastores",
      ),
    ).toBe(false);
  });

  it("still requires runtime datastores in a live production runtime", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    delete process.env.MONGODB_URI;
    delete process.env.REDIS_URL;

    expect(() => assertLiveInfrastructureConfiguration()).toThrow(
      "Live infrastructuurconfiguratie mist onderdelen: MongoDB en Redis.",
    );

    expect(getLiveInfrastructureConfigurationIssues()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "runtime-datastores",
          missingEnv: expect.arrayContaining(["MONGODB_URI", "REDIS_URL"]),
        }),
      ]),
    );
  });
});
