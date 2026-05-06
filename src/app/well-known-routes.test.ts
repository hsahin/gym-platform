import { afterEach, describe, expect, it } from "vitest";
import { GET as appleAppSiteAssociationRoute } from "@/app/.well-known/apple-app-site-association/route";
import { GET as assetLinksRoute } from "@/app/.well-known/assetlinks.json/route";

const originalAppleTeamId = process.env.APPLE_TEAM_ID;
const originalAndroidFingerprints =
  process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS;

afterEach(() => {
  if (originalAppleTeamId === undefined) {
    delete process.env.APPLE_TEAM_ID;
  } else {
    process.env.APPLE_TEAM_ID = originalAppleTeamId;
  }

  if (originalAndroidFingerprints === undefined) {
    delete process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS;
  } else {
    process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS =
      originalAndroidFingerprints;
  }
});

describe("well-known mobile association routes", () => {
  it("serves Apple universal links only with a configured production team id", async () => {
    process.env.APPLE_TEAM_ID = "ABCDE12345";

    const response = appleAppSiteAssociationRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.applinks.details[0].appIDs).toEqual([
      "ABCDE12345.nl.gymos.members",
    ]);
    expect(payload.webcredentials.apps).toEqual([
      "ABCDE12345.nl.gymos.members",
    ]);
    expect(JSON.stringify(payload)).not.toContain("TEAMID");
  });

  it("fails closed for Apple universal links when the team id is missing", async () => {
    delete process.env.APPLE_TEAM_ID;

    const response = appleAppSiteAssociationRoute();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.missing).toEqual(["APPLE_TEAM_ID"]);
    expect(JSON.stringify(payload)).not.toContain("TEAMID");
  });

  it("fails closed for Apple universal links when the team id is invalid", async () => {
    process.env.APPLE_TEAM_ID = "TEAM";

    const response = appleAppSiteAssociationRoute();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.missing).toEqual(["APPLE_TEAM_ID"]);
  });

  it("serves Android app links only with configured release fingerprints", async () => {
    const fingerprints = [
      "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
      "11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00",
    ];
    process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS =
      fingerprints.join(",");

    const response = assetLinksRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload[0].target.package_name).toBe("nl.gymos.members");
    expect(payload[0].target.sha256_cert_fingerprints).toEqual(fingerprints);
    expect(JSON.stringify(payload)).not.toContain("REPLACE_WITH");
  });

  it("fails closed for Android app links when release fingerprints are missing", async () => {
    delete process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS;

    const response = assetLinksRoute();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.missing).toEqual(["ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS"]);
    expect(JSON.stringify(payload)).not.toContain("REPLACE_WITH");
  });

  it("fails closed for Android app links when a release fingerprint is invalid", async () => {
    const validFingerprint =
      "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";
    process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS =
      `${validFingerprint},not-a-release-fingerprint`;

    const response = assetLinksRoute();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.missing).toEqual(["ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS"]);
  });
});
