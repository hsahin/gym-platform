import { afterEach, describe, expect, it } from "vitest";
import {
  getSpacesStorageConfigurationStatus,
  hasAnySpacesStorageEnv,
  normalizeSpacesEndpoint,
  resolveSpacesStorageConfiguration,
} from "@/server/runtime/spaces-config";

const trackedEnv = [
  "SPACES_BUCKET",
  "SPACES_ENDPOINT",
  "SPACES_REGION",
  "SPACES_ACCESS_KEY_ID",
  "SPACES_ACCESS_KEY",
  "SPACES_SECRET_ACCESS_KEY",
  "SPACES_SECRET_KEY",
] as const;

const originalEnv = Object.fromEntries(
  trackedEnv.map((key) => [key, process.env[key]]),
) as Record<(typeof trackedEnv)[number], string | undefined>;

function restoreEnv() {
  for (const key of trackedEnv) {
    const value = originalEnv[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearSpacesEnv() {
  for (const key of trackedEnv) {
    delete process.env[key];
  }
}

afterEach(() => {
  restoreEnv();
});

describe("spaces storage configuration", () => {
  it("normalizes endpoint and supports legacy access key aliases", () => {
    clearSpacesEnv();
    process.env.SPACES_BUCKET = "gymos-contracts";
    process.env.SPACES_ENDPOINT = "ams3.digitaloceanspaces.com";
    process.env.SPACES_REGION = "ams3";
    process.env.SPACES_ACCESS_KEY = "spaces-access";
    process.env.SPACES_SECRET_KEY = "spaces-secret";

    expect(hasAnySpacesStorageEnv()).toBe(true);
    expect(getSpacesStorageConfigurationStatus()).toEqual({
      configured: true,
      missingEnv: [],
    });
    expect(resolveSpacesStorageConfiguration()).toEqual({
      bucket: "gymos-contracts",
      endpoint: "https://ams3.digitaloceanspaces.com",
      region: "ams3",
      accessKeyId: "spaces-access",
      secretAccessKey: "spaces-secret",
    });
    expect(normalizeSpacesEndpoint("https://ams3.digitaloceanspaces.com")).toBe(
      "https://ams3.digitaloceanspaces.com",
    );
  });

  it("reports missing cloud storage env without treating whitespace as configured", () => {
    clearSpacesEnv();
    process.env.SPACES_BUCKET = " ";

    expect(hasAnySpacesStorageEnv()).toBe(false);
    expect(resolveSpacesStorageConfiguration()).toBeNull();
    expect(getSpacesStorageConfigurationStatus().missingEnv).toEqual([
      "SPACES_BUCKET",
      "SPACES_ENDPOINT",
      "SPACES_REGION",
      "SPACES_ACCESS_KEY_ID",
      "SPACES_SECRET_ACCESS_KEY",
    ]);
  });
});
