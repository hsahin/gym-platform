import { describe, expect, it } from "vitest";
import {
  createDefaultRemoteAccessSettings,
  getRemoteAccessBridgeLabel,
  getRemoteAccessConnectionStatus,
  getRemoteAccessHelpText,
  getRemoteAccessProviderLabel,
  getRemoteAccessStatusLabel,
  isRemoteAccessReady,
  normalizeStoredRemoteAccessSettings,
  type StoredRemoteAccessSettings,
} from "@/lib/remote-access";

describe("remote access helpers", () => {
  it("starts with a locked-down Nuki default", () => {
    expect(createDefaultRemoteAccessSettings()).toEqual({
      enabled: false,
      provider: "nuki",
      bridgeType: "cloud_api",
      locationId: null,
      deviceLabel: "",
      externalDeviceId: "",
      allowedRoleKeys: ["owner"],
    });
  });

  it("normalizes stored access settings for display and duplicate roles", () => {
    expect(
      normalizeStoredRemoteAccessSettings({
        locationId: "loc_front",
        deviceLabel: "  Hoofdingang  ",
        externalDeviceId: "  nuki-01  ",
        notes: "  Alleen owners  ",
        allowedRoleKeys: ["owner", "manager", "owner"],
      }),
    ).toMatchObject({
      locationId: "loc_front",
      deviceLabel: "Hoofdingang",
      externalDeviceId: "nuki-01",
      notes: "Alleen owners",
      allowedRoleKeys: ["owner", "manager"],
    });

    expect(
      normalizeStoredRemoteAccessSettings({
        allowedRoleKeys: [],
        notes: "   ",
      }),
    ).toMatchObject({
      locationId: null,
      allowedRoleKeys: ["owner"],
      notes: undefined,
    });
  });

  it("reports not configured, attention and configured states", () => {
    const blank = createDefaultRemoteAccessSettings();
    const partial = normalizeStoredRemoteAccessSettings({
      deviceLabel: "Hoofdingang",
    });
    const configured = normalizeStoredRemoteAccessSettings({
      enabled: true,
      locationId: "loc_front",
      deviceLabel: "Hoofdingang",
      externalDeviceId: "nuki-01",
    });

    expect(getRemoteAccessConnectionStatus(blank)).toBe("not_configured");
    expect(getRemoteAccessConnectionStatus(partial)).toBe("attention");
    expect(getRemoteAccessConnectionStatus(configured)).toBe("configured");
    expect(isRemoteAccessReady(configured)).toBe(true);
  });

  it("builds owner-facing labels and help text for every smart-door state", () => {
    const configuredDisabled = normalizeStoredRemoteAccessSettings({
      enabled: false,
      locationId: "loc_front",
      deviceLabel: "Hoofdingang",
      externalDeviceId: "nuki-01",
    });
    const configuredEnabled = {
      ...configuredDisabled,
      enabled: true,
    } satisfies StoredRemoteAccessSettings;
    const attention = normalizeStoredRemoteAccessSettings({ externalDeviceId: "nuki-01" });

    expect(getRemoteAccessProviderLabel("nuki")).toBe("Nuki Smart Lock");
    expect(getRemoteAccessProviderLabel("custom" as never)).toBe("custom");
    expect(getRemoteAccessBridgeLabel("bridge")).toBe("Bridge");
    expect(getRemoteAccessBridgeLabel("custom" as never)).toBe("custom");
    expect(getRemoteAccessStatusLabel(createDefaultRemoteAccessSettings())).toBe(
      "Niet gekoppeld",
    );
    expect(getRemoteAccessStatusLabel(attention)).toBe("Aandacht nodig");
    expect(getRemoteAccessStatusLabel(configuredDisabled)).toBe("Klaar om te activeren");
    expect(getRemoteAccessStatusLabel(configuredEnabled)).toBe("Live credentials nodig");
    expect(getRemoteAccessStatusLabel(configuredEnabled, { liveProviderConfigured: true })).toBe(
      "Live",
    );
    expect(getRemoteAccessHelpText(createDefaultRemoteAccessSettings())).toContain(
      "Koppel een slim slot",
    );
    expect(getRemoteAccessHelpText(attention)).toContain("Vul locatie");
    expect(getRemoteAccessHelpText(configuredDisabled)).toContain("is ingevuld");
    expect(getRemoteAccessHelpText(configuredEnabled)).toContain("live API-token");
    expect(getRemoteAccessHelpText(configuredEnabled, { liveProviderConfigured: true })).toContain(
      "opent live",
    );
  });
});
