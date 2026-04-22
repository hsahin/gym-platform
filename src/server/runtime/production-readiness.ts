import { AppError } from "@claimtech/core";

const productionMarkers = ["production", "prod", "live"] as const;

export interface ProductionReadinessCheck {
  readonly key: string;
  readonly label: string;
  readonly ready: boolean;
  readonly severity: "required" | "recommended";
  readonly helpText: string;
}

function isPresent(value: string | undefined) {
  return Boolean(value?.trim());
}

export function isProductionRuntime() {
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  ) {
    return false;
  }

  const environment = (process.env.NODE_ENV ?? "").toLowerCase();
  const appEnvironment = (process.env.APP_ENV ?? "").toLowerCase();

  return (
    productionMarkers.includes(environment as never) ||
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
      severity: "recommended",
      helpText: "Redis voorkomt memory cache per instance en maakt opschalen voorspelbaar.",
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
