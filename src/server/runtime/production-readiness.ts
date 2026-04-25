import { AppError } from "@claimtech/core";

const productionMarkers = ["production", "prod", "live"] as const;
const runtimeDataStoreEnvNames = ["MONGODB_URI", "REDIS_URL"] as const;
const wahaEnvNames = ["WAHA_BASE_URL", "WAHA_API_KEY"] as const;
const whatsappCloudEnvNames = [
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
] as const;
const spacesEnvNames = [
  "SPACES_BUCKET",
  "SPACES_ENDPOINT",
  "SPACES_REGION",
  "SPACES_ACCESS_KEY_ID",
  "SPACES_SECRET_ACCESS_KEY",
] as const;

export interface ProductionReadinessCheck {
  readonly key: string;
  readonly label: string;
  readonly ready: boolean;
  readonly severity: "required" | "recommended";
  readonly helpText: string;
}

export interface LiveInfrastructureConfigurationIssue {
  readonly key: string;
  readonly label: string;
  readonly helpText: string;
  readonly missingEnv: ReadonlyArray<string>;
}

function isPresent(value: string | undefined) {
  return Boolean(value?.trim());
}

function getMissingEnvNames(names: ReadonlyArray<string>) {
  return names.filter((name) => !isPresent(process.env[name]));
}

function hasConfiguredEnv(names: ReadonlyArray<string>) {
  return names.some((name) => isPresent(process.env[name]));
}

export function allowsRuntimeFallbacks() {
  if (process.env.NODE_ENV === "test") {
    return true;
  }

  return !isProductionRuntime() && process.env.CLAIMTECH_DISABLE_RUNTIME_FALLBACKS !== "true";
}

function getRuntimeDataStoresConfigurationIssue(): LiveInfrastructureConfigurationIssue | null {
  if (allowsRuntimeFallbacks()) {
    return null;
  }

  const missingEnv = getMissingEnvNames(runtimeDataStoreEnvNames);

  if (missingEnv.length === 0) {
    return null;
  }

  return {
    key: "runtime-datastores",
    label: "MongoDB en Redis",
    helpText:
      "De app draait zonder lokale fallback. Zet MONGODB_URI en REDIS_URL zodat runtime state, auth en cache op echte backends landen.",
    missingEnv,
  };
}

function getMessagingConfigurationIssue(): LiveInfrastructureConfigurationIssue | null {
  if (process.env.ENABLE_REAL_MESSAGES !== "true") {
    return null;
  }

  const wahaConfigured = hasConfiguredEnv(wahaEnvNames);
  const whatsappCloudConfigured = hasConfiguredEnv(whatsappCloudEnvNames);
  const wahaMissingEnv = getMissingEnvNames(wahaEnvNames);
  const whatsappCloudMissingEnv = getMissingEnvNames(whatsappCloudEnvNames);
  const wahaReady = wahaMissingEnv.length === 0;
  const whatsappCloudReady = whatsappCloudMissingEnv.length === 0;

  if (wahaReady || whatsappCloudReady) {
    return null;
  }

  return {
    key: "messaging",
    label: "Live berichten",
    helpText:
      wahaConfigured || whatsappCloudConfigured
        ? "ENABLE_REAL_MESSAGES=true staat aan, maar de gekozen providerconfiguratie is niet compleet."
        : "ENABLE_REAL_MESSAGES=true vereist WAHA_BASE_URL + WAHA_API_KEY of WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN.",
    missingEnv:
      wahaConfigured || whatsappCloudConfigured
        ? [...(wahaConfigured ? wahaMissingEnv : []), ...(whatsappCloudConfigured ? whatsappCloudMissingEnv : [])]
        : [...wahaEnvNames, ...whatsappCloudEnvNames],
  };
}

function getStorageConfigurationIssue(): LiveInfrastructureConfigurationIssue | null {
  if (process.env.ENABLE_REAL_UPLOADS !== "true") {
    return null;
  }

  const missingEnv = getMissingEnvNames(spacesEnvNames);

  if (missingEnv.length === 0) {
    return null;
  }

  return {
    key: "storage",
    label: "Cloudopslag",
    helpText:
      "ENABLE_REAL_UPLOADS=true vereist een complete Spaces-configuratie voor waivers en uploads.",
    missingEnv,
  };
}

export function isProductionRuntime() {
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  ) {
    return false;
  }

  const appEnvironment = (process.env.APP_ENV ?? "").toLowerCase();

  return (
    process.env.CLAIMTECH_FORCE_PRODUCTION_RUNTIME === "true" ||
    productionMarkers.includes(appEnvironment as never) ||
    isPresent(process.env.DIGITALOCEAN_APP_ID)
  );
}

export function getProductionReadinessChecks(): ReadonlyArray<ProductionReadinessCheck> {
  return [
    {
      key: "mongo",
      label: "MongoDB",
      ready: isPresent(process.env.MONGODB_URI) && isPresent(process.env.MONGODB_DB_NAME),
      severity: "required",
      helpText: "Productie gebruikt uitsluitend MongoDB voor tenants, accounts en gymdata.",
    },
    {
      key: "session-secret",
      label: "Sessiesleutel",
      ready:
        isPresent(process.env.CLAIMTECH_SESSION_SECRET) &&
        process.env.CLAIMTECH_SESSION_SECRET !== "replace-me" &&
        process.env.CLAIMTECH_SESSION_SECRET !== "claimtech-gym-platform-local-secret",
      severity: "required",
      helpText: "Gebruik een lange unieke CLAIMTECH_SESSION_SECRET voor veilige cookies.",
    },
    {
      key: "cache",
      label: "Redis cache",
      ready: isPresent(process.env.REDIS_URL),
      severity: "required",
      helpText: "Redis is verplicht omdat de app niet meer terugvalt naar memory cache.",
    },
    {
      key: "backups",
      label: "Backups",
      ready: process.env.MONGODB_BACKUP_POLICY === "enabled",
      severity: "recommended",
      helpText: "Zet automatische Mongo backups of point-in-time recovery aan.",
    },
    {
      key: "monitoring",
      label: "Monitoring",
      ready: isPresent(process.env.MONITORING_WEBHOOK_URL) || isPresent(process.env.SENTRY_DSN),
      severity: "recommended",
      helpText: "Koppel Sentry of een webhook voor foutmeldingen en uptime signalen.",
    },
  ];
}

export function getLiveInfrastructureConfigurationIssues(): ReadonlyArray<LiveInfrastructureConfigurationIssue> {
  return [
    getRuntimeDataStoresConfigurationIssue(),
    getMessagingConfigurationIssue(),
    getStorageConfigurationIssue(),
  ].filter((issue): issue is LiveInfrastructureConfigurationIssue => issue !== null);
}

export function assertLiveInfrastructureConfiguration() {
  const issues = getLiveInfrastructureConfigurationIssues();

  if (issues.length === 0) {
    return;
  }

  throw new AppError(
    `Live infrastructuurconfiguratie mist onderdelen: ${issues
      .map((issue) => issue.label)
      .join(", ")}.`,
    {
      code: "INVALID_INPUT",
      details: {
        issues,
      },
    },
  );
}

export function assertProductionEnvironmentReady() {
  if (!isProductionRuntime()) {
    return;
  }

  const missingRequired = getProductionReadinessChecks().filter(
    (check) => check.severity === "required" && !check.ready,
  );

  if (missingRequired.length === 0) {
    return;
  }

  throw new AppError(
    `Productieconfiguratie mist verplichte onderdelen: ${missingRequired
      .map((check) => check.label)
      .join(", ")}.`,
    {
      code: "INVALID_INPUT",
      details: {
        missing: missingRequired.map((check) => check.key),
      },
    },
  );
}
