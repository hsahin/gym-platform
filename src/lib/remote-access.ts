import type { PlatformRoleKey } from "@/server/runtime/platform-roles";
import type {
  RemoteAccessBridgeType,
  RemoteAccessConnectionStatus,
  RemoteAccessProvider,
} from "@/server/types";

export interface StoredRemoteAccessSettings {
  readonly enabled: boolean;
  readonly provider: RemoteAccessProvider;
  readonly bridgeType: RemoteAccessBridgeType;
  readonly locationId: string | null;
  readonly deviceLabel: string;
  readonly externalDeviceId: string;
  readonly allowedRoleKeys: ReadonlyArray<PlatformRoleKey>;
  readonly notes?: string;
  readonly lastValidatedAt?: string;
  readonly lastRemoteActionAt?: string;
  readonly lastRemoteActionBy?: string;
}

export const REMOTE_ACCESS_PROVIDER_OPTIONS: ReadonlyArray<{
  key: RemoteAccessProvider;
  label: string;
  helper: string;
}> = [
  {
    key: "nuki",
    label: "Nuki Smart Lock",
    helper: "Sterke eerste koppeling voor slimme cilinders en remote open via bridge of cloud.",
  },
  {
    key: "salto_ks",
    label: "Salto KS",
    helper: "Gangbaar voor clubs met toegangsbeheer via cloudgestuurde deurbeslag of controllers.",
  },
  {
    key: "tedee",
    label: "Tedee",
    helper: "Compact slim slot voor boutique studio's met app-first toegang.",
  },
  {
    key: "yale_smart",
    label: "Yale Smart Lock",
    helper: "Bekende consumenten- en small-business optie voor voordeur en side entrance.",
  },
] as const;

export const REMOTE_ACCESS_BRIDGE_OPTIONS: ReadonlyArray<{
  key: RemoteAccessBridgeType;
  label: string;
}> = [
  { key: "cloud_api", label: "Cloud API" },
  { key: "bridge", label: "Bridge" },
  { key: "hub", label: "Hub of controller" },
] as const;

export function createDefaultRemoteAccessSettings(): StoredRemoteAccessSettings {
  return {
    enabled: false,
    provider: "nuki",
    bridgeType: "cloud_api",
    locationId: null,
    deviceLabel: "",
    externalDeviceId: "",
    allowedRoleKeys: ["owner"],
  };
}

export function getRemoteAccessProviderLabel(provider: RemoteAccessProvider) {
  return (
    REMOTE_ACCESS_PROVIDER_OPTIONS.find((option) => option.key === provider)?.label ??
    provider
  );
}

export function getRemoteAccessBridgeLabel(bridgeType: RemoteAccessBridgeType) {
  return (
    REMOTE_ACCESS_BRIDGE_OPTIONS.find((option) => option.key === bridgeType)?.label ??
    bridgeType
  );
}

export function normalizeStoredRemoteAccessSettings(
  input?: Partial<StoredRemoteAccessSettings> | null,
): StoredRemoteAccessSettings {
  const base = createDefaultRemoteAccessSettings();

  return {
    ...base,
    ...input,
    locationId: input?.locationId ?? null,
    deviceLabel: input?.deviceLabel?.trim() ?? base.deviceLabel,
    externalDeviceId: input?.externalDeviceId?.trim() ?? base.externalDeviceId,
    notes: input?.notes?.trim() ? input.notes.trim() : undefined,
    allowedRoleKeys:
      input?.allowedRoleKeys && input.allowedRoleKeys.length > 0
        ? Array.from(new Set(input.allowedRoleKeys))
        : base.allowedRoleKeys,
  };
}

export function getRemoteAccessConnectionStatus(
  settings: StoredRemoteAccessSettings,
): RemoteAccessConnectionStatus {
  const hasAnyConfiguration = Boolean(
    settings.deviceLabel || settings.externalDeviceId || settings.locationId,
  );
  const hasFullConfiguration = Boolean(
    settings.deviceLabel && settings.externalDeviceId && settings.locationId,
  );

  if (!hasAnyConfiguration) {
    return "not_configured";
  }

  if (hasFullConfiguration) {
    return "configured";
  }

  return "attention";
}

export function isRemoteAccessReady(settings: StoredRemoteAccessSettings) {
  return settings.enabled && getRemoteAccessConnectionStatus(settings) === "configured";
}

export function getRemoteAccessStatusLabel(settings: StoredRemoteAccessSettings) {
  const status = getRemoteAccessConnectionStatus(settings);

  if (status === "configured" && settings.enabled) {
    return "Live preview";
  }

  if (status === "configured") {
    return "Klaar om te activeren";
  }

  if (status === "attention") {
    return "Aandacht nodig";
  }

  return "Niet gekoppeld";
}

export function getRemoteAccessHelpText(settings: StoredRemoteAccessSettings) {
  const providerLabel = getRemoteAccessProviderLabel(settings.provider);
  const bridgeLabel = getRemoteAccessBridgeLabel(settings.bridgeType);
  const status = getRemoteAccessConnectionStatus(settings);

  if (status === "configured" && settings.enabled) {
    return `${providerLabel} staat klaar in ${bridgeLabel}-modus. Remote openen draait nu in preview totdat live credentials worden aangesloten.`;
  }

  if (status === "configured") {
    return `${providerLabel} is ingevuld in ${bridgeLabel}-modus. Activeer remote toegang zodra je de gym op afstand wilt kunnen openen.`;
  }

  if (status === "attention") {
    return `Vul locatie, slotnaam en device-id aan om ${providerLabel} betrouwbaar te kunnen gebruiken.`;
  }

  return "Koppel een slim slot zoals Nuki en bewaar per gym welke deur op afstand geopend mag worden.";
}
