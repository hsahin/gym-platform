interface SpacesEnvGroup {
  readonly canonicalName: string;
  readonly aliases?: ReadonlyArray<string>;
}

const spacesEnvGroups: ReadonlyArray<SpacesEnvGroup> = [
  { canonicalName: "SPACES_BUCKET" },
  { canonicalName: "SPACES_ENDPOINT" },
  { canonicalName: "SPACES_REGION" },
  { canonicalName: "SPACES_ACCESS_KEY_ID", aliases: ["SPACES_ACCESS_KEY"] },
  { canonicalName: "SPACES_SECRET_ACCESS_KEY", aliases: ["SPACES_SECRET_KEY"] },
];

export interface SpacesStorageConfiguration {
  readonly bucket: string;
  readonly endpoint: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export interface SpacesStorageConfigurationStatus {
  readonly configured: boolean;
  readonly missingEnv: ReadonlyArray<string>;
}

function isPresent(value: string | undefined) {
  return Boolean(value?.trim());
}

function readFirstPresentEnv(group: SpacesEnvGroup) {
  const names = [group.canonicalName, ...(group.aliases ?? [])];

  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}

export function normalizeSpacesEndpoint(endpoint: string) {
  const trimmed = endpoint.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getSpacesStorageConfigurationStatus(): SpacesStorageConfigurationStatus {
  const missingEnv = spacesEnvGroups
    .filter((group) => !readFirstPresentEnv(group))
    .map((group) => group.canonicalName);

  return {
    configured: missingEnv.length === 0,
    missingEnv,
  };
}

export function hasAnySpacesStorageEnv() {
  return spacesEnvGroups.some((group) =>
    [group.canonicalName, ...(group.aliases ?? [])].some((name) =>
      isPresent(process.env[name]),
    ),
  );
}

export function resolveSpacesStorageConfiguration(): SpacesStorageConfiguration | null {
  const status = getSpacesStorageConfigurationStatus();

  if (!status.configured) {
    return null;
  }

  return {
    bucket: readFirstPresentEnv(spacesEnvGroups[0]!),
    endpoint: normalizeSpacesEndpoint(readFirstPresentEnv(spacesEnvGroups[1]!)),
    region: readFirstPresentEnv(spacesEnvGroups[2]!),
    accessKeyId: readFirstPresentEnv(spacesEnvGroups[3]!),
    secretAccessKey: readFirstPresentEnv(spacesEnvGroups[4]!),
  };
}
