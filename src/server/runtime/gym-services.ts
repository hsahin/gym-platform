import {
  createAuthActor,
  getTenantMembership,
  listActorTenants,
  type AuthActor,
} from "@claimtech/auth";
import {
  PrefixedCacheKeyFactory,
  TenantCache,
  createValkeyClient,
  type KeyValueCacheClient,
} from "@claimtech/cache";
import {
  AppError,
  createPrefixedIdGenerator,
  toCorrelationId,
} from "@claimtech/core";
import {
  MongoDatabaseClient,
  createMongoClient,
} from "@claimtech/database";
import { FeatureFlagEvaluator } from "@claimtech/feature-flags";
import {
  formatCurrencyValue,
  getLanguageOptions,
  normalizePhoneForStorage,
} from "@claimtech/i18n";
import {
  getBillingConnectionStatus,
  getBillingHelpText,
  getBillingPaymentMethodLabel,
  getBillingProviderLabel,
  getBillingStatusLabel,
  isBillingReady,
} from "@/lib/billing";
import { getMembershipBillingCycleLabel } from "@/lib/memberships";
import {
  getRemoteAccessConnectionStatus,
  getRemoteAccessHelpText,
  getRemoteAccessProviderLabel,
  getRemoteAccessStatusLabel,
  isRemoteAccessReady,
} from "@/lib/remote-access";
import {
  TextTemplateRenderer,
  WahaWhatsAppProvider,
  WhatsAppCloudProvider,
  type MessageReceipt,
  type MessagingProvider,
} from "@claimtech/messaging";
import {
  HealthRegistry,
  InMemoryAuditLogger,
  InMemoryRateLimiter,
  buildRateLimitKey,
  type AuditEntry,
  type AuditLogger,
} from "@claimtech/ops";
import { PermissionRegistry } from "@claimtech/permissions";
import { TenantStoragePathFactory } from "@claimtech/storage";
import {
  createTenantContext,
  toTenantId,
  type TenantContext,
} from "@claimtech/tenant";
import {
  InMemoryUserDirectory,
  createPlatformUser,
  type UserDirectory,
} from "@claimtech/users";
import type {
  CancelBookingInput,
  CreateBookingInput,
  CreateClassSessionInput,
  CreateLocationInput,
  CreateMemberInput,
  CreateMembershipPlanInput,
  CreateTrainerInput,
  GymStore,
  RecordAttendanceInput,
  UpdateClassSessionInput,
  UpdateLocationInput,
  UpdateMemberInput,
  UpdateMembershipPlanInput,
  UpdateTrainerInput,
} from "@/server/persistence/gym-contracts";
import {
  createEmptyGymStoreState,
  createMemoryGymStore,
} from "@/server/persistence/memory-gym-store";
import { MongoGymStore } from "@/server/persistence/mongo-gym-store";
import {
  createLocalPlatformAccount,
  deleteLocalPlatformAccount,
  getLocalTenantProfileBySlug,
  getLocalTenantProfile,
  listLocalPlatformAccounts,
  listLocalTenants,
  markLocalTenantBillingAction,
  markLocalTenantRemoteAccessAction,
  readLocalPlatformState,
  updateLocalTenantBillingSettings,
  updateLocalTenantLegalSettings,
  updateLocalTenantRemoteAccess,
  updateLocalPlatformAccount,
  updateLocalPlatformData,
} from "@/server/persistence/platform-state";
import { toClientPlain } from "@/server/lib/to-client-plain";
import {
  getMembershipRole,
} from "@/server/runtime/platform-roles";
import {
  assertLiveInfrastructureConfiguration,
  assertProductionEnvironmentReady,
  getProductionReadinessChecks,
} from "@/server/runtime/production-readiness";
import type {
  BillingActionReceipt,
  ClassBooking,
  FeatureState,
  GymDashboardSnapshot,
  PublicReservationSnapshot,
  RemoteAccessActionReceipt,
  RuntimeState,
  StaffSummary,
} from "@/server/types";

const PRODUCT_NAME = "gym-platform";
const ENVIRONMENT = process.env.NODE_ENV ?? "development";
const requestIdGenerator = createPrefixedIdGenerator({ prefix: "req" });

type MessagingMode = RuntimeState["messagingMode"];
type StoreMode = RuntimeState["storeMode"];
type CacheMode = RuntimeState["cacheMode"];
type StorageMode = RuntimeState["storageMode"];

const roleDefinitions = [
  {
    key: "platform.admin",
    scope: "global" as const,
    grants: ["dashboard.read", "reports.read", "settings.manage"],
  },
  {
    key: "gym.owner",
    scope: "tenant" as const,
    grants: [
      "dashboard.read",
      "operations.manage",
      "members.read",
      "classes.read",
      "classes.book",
      "attendance.write",
      "waivers.read",
      "waivers.manage",
      "reports.read",
      "settings.manage",
    ],
  },
  {
    key: "gym.manager",
    scope: "tenant" as const,
    grants: [
      "dashboard.read",
      "operations.manage",
      "members.read",
      "classes.read",
      "classes.book",
      "attendance.write",
      "waivers.read",
      "reports.read",
    ],
  },
  {
    key: "gym.trainer",
    scope: "tenant" as const,
    grants: ["dashboard.read", "members.read", "classes.read", "attendance.write"],
  },
  {
    key: "gym.frontdesk",
    scope: "tenant" as const,
    grants: ["dashboard.read", "members.read", "classes.read", "classes.book", "waivers.read"],
  },
] as const;

const featureDefinitions = [
  {
    key: "bookings.waitlist",
    defaultValue: true,
    description: "Leden kunnen op een waitlist landen wanneer een les vol zit.",
  },
  {
    key: "attendance.self_check_in",
    defaultValue: true,
    description: "QR/self check-in voor lessen staat aan.",
  },
  {
    key: "waivers.digital_upload",
    defaultValue: true,
    description: "Digitale waivers en uploadmomenten staan klaar voor leden.",
  },
  {
    key: "marketing.automations",
    defaultValue: false,
    description: "Marketing automation voor reactivatie wordt nog niet uitgerold.",
  },
  {
    key: "analytics.multi_location",
    defaultValue: true,
    description: "Multi-locatie rapportages zijn beschikbaar voor deze gymgroep.",
  },
] as const;

function shouldUseTestFallbacks() {
  return process.env.NODE_ENV === "test";
}

class MemoryCacheClient implements KeyValueCacheClient {
  private readonly entries = new Map<
    string,
    {
      value: string;
      expiresAt?: number;
    }
  >();

  private purgeIfExpired(key: string) {
    const entry = this.entries.get(key);

    if (!entry) {
      return;
    }

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
    }
  }

  async get(key: string) {
    this.purgeIfExpired(key);
    return this.entries.get(key)?.value ?? null;
  }

  async set(
    key: string,
    value: string,
    options?: { ttlSeconds?: number; ttlMilliseconds?: number; onlyIfAbsent?: boolean },
  ) {
    this.purgeIfExpired(key);

    if (options?.onlyIfAbsent && this.entries.has(key)) {
      return false;
    }

    const ttlMilliseconds =
      options?.ttlMilliseconds ??
      (options?.ttlSeconds ? options.ttlSeconds * 1000 : undefined);

    this.entries.set(key, {
      value,
      expiresAt: ttlMilliseconds ? Date.now() + ttlMilliseconds : undefined,
    });

    return true;
  }

  async del(key: string) {
    return this.entries.delete(key) ? 1 : 0;
  }

  async incrBy(key: string, amount: number) {
    this.purgeIfExpired(key);
    const current = Number(this.entries.get(key)?.value ?? "0");
    const nextValue = String(current + amount);
    this.entries.set(key, { value: nextValue });
    return Number(nextValue);
  }

  async expire(key: string, ttlSeconds: number) {
    this.purgeIfExpired(key);
    const entry = this.entries.get(key);

    if (!entry) {
      return false;
    }

    this.entries.set(key, {
      ...entry,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  async eval(_script: string, keys: string[], args: string[]) {
    const key = keys[0];
    const token = args[0];
    this.purgeIfExpired(key);
    const entry = this.entries.get(key);

    if (!entry || entry.value !== token) {
      return 0;
    }

    this.entries.delete(key);
    return 1;
  }

  async quit() {
    this.entries.clear();
  }
}

class PreviewMessagingProvider implements MessagingProvider {
  async send(): Promise<MessageReceipt> {
    return {
      accepted: true,
      status: "queued",
      providerMessageId: "preview-message",
      raw: { mode: "preview" },
    };
  }
}

interface GymPlatformRuntime {
  readonly store: GymStore;
  readonly storeMode: StoreMode;
  readonly cacheClient: KeyValueCacheClient;
  readonly cacheMode: CacheMode;
  readonly messagingProvider: MessagingProvider;
  readonly messagingMode: MessagingMode;
  readonly storageMode: StorageMode;
  readonly permissionRegistry: PermissionRegistry;
  readonly featureEvaluator: FeatureFlagEvaluator;
  readonly userDirectory: UserDirectory;
  readonly auditLogger: AuditLogger;
  readonly rateLimiter: InMemoryRateLimiter;
  readonly healthRegistry: HealthRegistry;
  readonly storagePathFactory: TenantStoragePathFactory;
  readonly templateRenderer: TextTemplateRenderer;
  readonly cacheKeyFactory: PrefixedCacheKeyFactory;
}

function assertAccess(
  runtime: GymPlatformRuntime,
  actor: AuthActor,
  tenantContext: TenantContext,
  requiredPermissions: ReadonlyArray<string>,
) {
  const membership = getTenantMembership(actor, tenantContext.tenantId);

  if (!membership) {
    throw new AppError("Er is geen actieve sessie voor deze tenant.", {
      code: "AUTH_REQUIRED",
      details: { tenantId: tenantContext.tenantId },
    });
  }

  if (!runtime.permissionRegistry.hasPermissions(actor, requiredPermissions, tenantContext)) {
    throw new AppError("De huidige rol mist permissies voor deze actie.", {
      code: "FORBIDDEN",
      details: {
        tenantId: tenantContext.tenantId,
        requiredPermissions,
      },
    });
  }
}

async function buildUserDirectory() {
  const directory = new InMemoryUserDirectory();
  const accounts = await listLocalPlatformAccounts();

  if (accounts.length === 0) {
    return directory;
  }

  await Promise.all(
    accounts.map((account) =>
      directory.upsert(
        createPlatformUser({
          userId: account.userId,
          email: account.email,
          displayName: account.displayName,
          status: account.status === "archived" ? "disabled" : "active",
          memberships: [
            {
              tenantId: account.tenantId,
              roleKeys: [getMembershipRole(account.roleKey)],
            },
          ],
        }),
      ),
    ),
  );

  return directory;
}

async function resolveStore(): Promise<Pick<GymPlatformRuntime, "store" | "storeMode">> {
  assertProductionEnvironmentReady();

  if (!process.env.MONGODB_URI) {
    if (shouldUseTestFallbacks()) {
      const localState = await readLocalPlatformState();

      return {
        store: createMemoryGymStore({
          initialState: localState?.data ?? createEmptyGymStoreState(),
          onChange: async (nextState) => {
            await updateLocalPlatformData(() => nextState);
          },
        }),
        storeMode: "memory" as StoreMode,
      };
    }

    throw new AppError("MONGODB_URI is verplicht. De app gebruikt geen memory store meer.", {
      code: "INVALID_INPUT",
    });
  }

  try {
    const client = createMongoClient({
      uri: process.env.MONGODB_URI,
      appName: PRODUCT_NAME,
    });
    await client.connect();

    const dbName = process.env.MONGODB_DB_NAME ?? PRODUCT_NAME;
    const databaseClient = new MongoDatabaseClient(client.db(dbName));

    return {
      store: new MongoGymStore(databaseClient),
      storeMode: "mongo",
    };
  } catch (error) {
    throw new AppError("MongoDB-verbinding mislukt. Controleer MONGODB_URI en netwerktoegang.", {
      code: "INVALID_INPUT",
      cause: error,
      details: {
        storeMode: "mongo",
      },
    });
  }
}

async function resolveCacheClient(): Promise<
  Pick<GymPlatformRuntime, "cacheClient" | "cacheMode">
> {
  if (!process.env.REDIS_URL) {
    if (shouldUseTestFallbacks()) {
      return {
        cacheClient: new MemoryCacheClient(),
        cacheMode: "memory" as CacheMode,
      };
    }

    throw new AppError("REDIS_URL is verplicht. De app gebruikt geen memory cache meer.", {
      code: "INVALID_INPUT",
    });
  }

  try {
    return {
      cacheClient: await createValkeyClient({ url: process.env.REDIS_URL }),
      cacheMode: "redis",
    };
  } catch (error) {
    throw new AppError("Redis-verbinding mislukt. Controleer REDIS_URL en netwerktoegang.", {
      code: "INVALID_INPUT",
      cause: error,
      details: {
        cacheMode: "redis",
      },
    });
  }
}

function resolveMessagingProvider(): Pick<
  GymPlatformRuntime,
  "messagingProvider" | "messagingMode"
> {
  if (
    process.env.ENABLE_REAL_MESSAGES === "true" &&
    process.env.WAHA_BASE_URL &&
    process.env.WAHA_API_KEY
  ) {
    return {
      messagingProvider: new WahaWhatsAppProvider({
        baseUrl: process.env.WAHA_BASE_URL,
        apiKey: process.env.WAHA_API_KEY,
      }),
      messagingMode: "waha",
    };
  }

  if (
    process.env.ENABLE_REAL_MESSAGES === "true" &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_ACCESS_TOKEN
  ) {
    return {
      messagingProvider: new WhatsAppCloudProvider({
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      }),
      messagingMode: "whatsapp-cloud",
    };
  }

  return {
    messagingProvider: new PreviewMessagingProvider(),
    messagingMode: "preview",
  };
}

function resolveStorageMode(): StorageMode {
  if (
    process.env.ENABLE_REAL_UPLOADS === "true" &&
    process.env.SPACES_BUCKET &&
    process.env.SPACES_ENDPOINT &&
    process.env.SPACES_REGION &&
    process.env.SPACES_ACCESS_KEY_ID &&
    process.env.SPACES_SECRET_ACCESS_KEY
  ) {
    return "spaces";
  }

  return "preview";
}

async function createRuntime(): Promise<GymPlatformRuntime> {
  assertLiveInfrastructureConfiguration();

  const [storeConfig, cacheConfig, userDirectory] = await Promise.all([
    resolveStore(),
    resolveCacheClient(),
    buildUserDirectory(),
  ]);
  const tenantProfile = (await listLocalTenants())[0] ?? null;

  const auditLogger = new InMemoryAuditLogger();
  await auditLogger.write({
    action: "platform.runtime_ready",
    category: "system",
    actorId: "system",
    tenantId:
      tenantProfile?.id ??
      createTenantContext({
        tenantId: toTenantId("platform-setup-pending"),
        product: PRODUCT_NAME,
        environment: ENVIRONMENT,
      }).tenantId,
    metadata: {
      storeMode: storeConfig.storeMode,
    },
  });

  const { messagingProvider, messagingMode } = resolveMessagingProvider();
  const storageMode = resolveStorageMode();
  const healthRegistry = new HealthRegistry()
    .register({
      name: "Data",
      run: () => ({
        status: "healthy",
        summary: "Je clubdata draait op de vaste databaseconfiguratie.",
      }),
    })
    .register({
      name: "Snelheid",
      run: () => ({
        status: "healthy",
        summary: "De app draait op de snelle live cachelaag.",
      }),
    })
    .register({
      name: "Berichten",
      run: () => ({
        status: messagingMode === "preview" ? "degraded" : "healthy",
        summary:
          messagingMode === "preview"
            ? "Berichten staan nog in preview totdat je live notificaties activeert."
            : "Live berichtflow staat klaar voor bevestigingen en reminders.",
      }),
    })
    .register({
      name: "Documenten",
      run: () => ({
        status: storageMode === "spaces" ? "healthy" : "degraded",
        summary:
          storageMode === "spaces"
            ? "Bestanden en waivers staan klaar op de cloudopslag."
            : "Bestanden werken in preview; cloudopslag koppel je zodra je productie draait.",
      }),
    })
    .register({
      name: "Remote toegang",
      run: async (context) => {
        const tenantContext = context?.tenantContext;

        if (!tenantContext) {
          return {
            status: "healthy",
            summary: "Remote toegang verschijnt zodra je een gym opent.",
          };
        }

        const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
        const remoteAccess = tenantProfile?.remoteAccess;

        if (!remoteAccess) {
          return {
            status: "healthy",
            summary: "Remote toegang is nog niet gekoppeld.",
          };
        }

        const connectionStatus = getRemoteAccessConnectionStatus(remoteAccess);

        if (isRemoteAccessReady(remoteAccess)) {
          return {
            status: "healthy",
            summary: `${getRemoteAccessProviderLabel(remoteAccess.provider)} staat klaar om je gym op afstand te openen.`,
          };
        }

        if (connectionStatus === "attention") {
          return {
            status: "degraded",
            summary: "Remote toegang mist nog locatie-, slot- of devicegegevens.",
          };
        }

        return {
          status: "healthy",
          summary: "Remote toegang is nog niet actief; de owner kan dit later activeren.",
        };
      },
    })
    .register({
      name: "Betalingen",
      run: async (context) => {
        const tenantContext = context?.tenantContext;

        if (!tenantContext) {
          return {
            status: "healthy",
            summary: "Betalingen verschijnen zodra je een gym opent.",
          };
        }

        const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
        const billing = tenantProfile?.billing;

        if (!billing) {
          return {
            status: "healthy",
            summary: "Betalingen zijn nog niet gekoppeld.",
          };
        }

        const connectionStatus = getBillingConnectionStatus(billing);

        if (isBillingReady(billing)) {
          return {
            status: "healthy",
            summary: `${getBillingProviderLabel(billing.provider)} staat klaar voor ${billing.paymentMethods
              .map(getBillingPaymentMethodLabel)
              .join(", ")}.`,
          };
        }

        if (connectionStatus === "attention") {
          return {
            status: "degraded",
            summary: "Betalingen missen nog profielgegevens of contactinformatie.",
          };
        }

        return {
          status: "healthy",
          summary: "Betalingen zijn nog niet actief; de owner kan dit later koppelen.",
        };
      },
    })
    .register({
      name: "Productie-readiness",
      run: () => {
        const checks = getProductionReadinessChecks();
        const missingRequired = checks.filter(
          (check) => check.severity === "required" && !check.ready,
        );
        const missingRecommended = checks.filter(
          (check) => check.severity === "recommended" && !check.ready,
        );

        if (missingRequired.length > 0) {
          return {
            status: "degraded",
            summary: `Nog verplicht: ${missingRequired
              .map((check) => check.label)
              .join(", ")}.`,
          };
        }

        if (missingRecommended.length > 0) {
          return {
            status: "degraded",
            summary: `Live basis staat, maar versterk nog: ${missingRecommended
              .map((check) => check.label)
              .join(", ")}.`,
          };
        }

        return {
          status: "healthy",
          summary: "Mongo, sessiesleutel, cache, backups en monitoring zijn ingevuld.",
        };
      },
    })
    .register({
      name: "Juridisch",
      run: async (context) => {
        const tenantContext = context?.tenantContext;

        if (!tenantContext) {
          return {
            status: "healthy",
            summary: "Juridische checks verschijnen zodra je een gym opent.",
          };
        }

        const legal = await buildLegalComplianceSummary(tenantContext);

        return {
          status: legal.statusLabel === "Juridisch klaar" ? "healthy" : "degraded",
          summary: legal.helpText,
        };
      },
    })
    .register({
      name: "Migraties",
      run: () => ({
        status: process.env.MIGRATIONS_LOCKED === "true" ? "healthy" : "degraded",
        summary:
          process.env.MIGRATIONS_LOCKED === "true"
            ? "Migraties zijn als release-stap geborgd."
            : "Leg vast dat database-migraties als release-stap draaien voordat productie live gaat.",
      }),
    })
    .register({
      name: "Security",
      run: () => ({
        status:
          process.env.SECURITY_HEADERS_ENABLED !== "false" &&
          process.env.CLAIMTECH_SESSION_SECRET &&
          process.env.CLAIMTECH_SESSION_SECRET !== "replace-me"
            ? "healthy"
            : "degraded",
        summary:
          process.env.SECURITY_HEADERS_ENABLED !== "false"
            ? "Security headers en sessieconfiguratie zijn expliciet geactiveerd."
            : "Activeer security headers, sterke sessiesleutel en productie-cookiebeleid.",
      }),
    });

  return {
    store: storeConfig.store,
    storeMode: storeConfig.storeMode,
    cacheClient: cacheConfig.cacheClient,
    cacheMode: cacheConfig.cacheMode,
    messagingProvider,
    messagingMode,
    storageMode,
    permissionRegistry: new PermissionRegistry(roleDefinitions),
    featureEvaluator: new FeatureFlagEvaluator(featureDefinitions),
    userDirectory,
    auditLogger,
    rateLimiter: new InMemoryRateLimiter(),
    healthRegistry,
    storagePathFactory: new TenantStoragePathFactory({
      environment: ENVIRONMENT,
      product: PRODUCT_NAME,
    }),
    templateRenderer: new TextTemplateRenderer(),
    cacheKeyFactory: new PrefixedCacheKeyFactory({
      environment: ENVIRONMENT,
      product: PRODUCT_NAME,
    }),
  };
}

function formatClassSlot(startsAt: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(startsAt));
}

function describeBookingStatusForMemberMessage(
  status: ClassBooking["status"],
  alreadyExisted: boolean,
) {
  switch (status) {
    case "waitlisted":
      return alreadyExisted ? "al op de wachtlijst gezet" : "op de wachtlijst gezet";
    case "checked_in":
      return alreadyExisted ? "al ingecheckt" : "ingecheckt";
    case "cancelled":
      return alreadyExisted ? "al geannuleerd" : "geannuleerd";
    case "confirmed":
    default:
      return alreadyExisted ? "al bevestigd" : "bevestigd";
  }
}

function createTenantAwareCache(runtime: GymPlatformRuntime, tenantContext: TenantContext) {
  return new TenantCache(runtime.cacheClient, runtime.cacheKeyFactory, tenantContext);
}

async function buildStaffSummaries(
  runtime: GymPlatformRuntime,
  tenantContext: TenantContext,
): Promise<ReadonlyArray<StaffSummary>> {
  const [users, accounts] = await Promise.all([
    runtime.userDirectory.listByTenant(tenantContext.tenantId),
    listLocalPlatformAccounts(tenantContext.tenantId),
  ]);
  const accountByUserId = new Map(accounts.map((account) => [account.userId, account]));

  return users.map((user) => {
    const membership = user.memberships.find(
      (entry) => entry.tenantId === tenantContext.tenantId,
    );
    const account = accountByUserId.get(user.userId);

    return {
      id: user.userId,
      displayName: user.displayName,
      email: user.email,
      status: account?.status ?? user.status,
      roles: membership?.roleKeys ?? [],
      roleKey: account?.roleKey,
      updatedAt: account?.updatedAt,
    };
  });
}

async function buildRemoteAccessSummary(
  tenantContext: TenantContext,
  locations: GymDashboardSnapshot["locations"],
): Promise<GymDashboardSnapshot["remoteAccess"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  const remoteAccess = tenantProfile?.remoteAccess;
  const location = remoteAccess?.locationId
    ? locations.find((entry) => entry.id === remoteAccess.locationId) ?? null
    : null;

  if (!remoteAccess) {
    return {
      enabled: false,
      provider: "nuki",
      providerLabel: getRemoteAccessProviderLabel("nuki"),
      bridgeType: "cloud_api",
      locationId: null,
      locationName: null,
      deviceLabel: "",
      externalDeviceId: "",
      connectionStatus: "not_configured",
      statusLabel: "Niet gekoppeld",
      helpText:
        "Koppel een slim slot zoals Nuki om de gymdeur later op afstand te beheren.",
      previewMode: true,
    };
  }

  return {
    enabled: remoteAccess.enabled,
    provider: remoteAccess.provider,
    providerLabel: getRemoteAccessProviderLabel(remoteAccess.provider),
    bridgeType: remoteAccess.bridgeType,
    locationId: remoteAccess.locationId,
    locationName: location?.name ?? null,
    deviceLabel: remoteAccess.deviceLabel,
    externalDeviceId: remoteAccess.externalDeviceId,
    connectionStatus: getRemoteAccessConnectionStatus(remoteAccess),
    statusLabel: getRemoteAccessStatusLabel(remoteAccess),
    helpText: getRemoteAccessHelpText(remoteAccess),
    previewMode: true,
    notes: remoteAccess.notes,
    lastValidatedAt: remoteAccess.lastValidatedAt,
    lastRemoteActionAt: remoteAccess.lastRemoteActionAt,
    lastRemoteActionBy: remoteAccess.lastRemoteActionBy,
  };
}

async function buildBillingSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["payments"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  const billing = tenantProfile?.billing;

  if (!billing) {
    return {
      enabled: false,
      provider: "mollie",
      providerLabel: getBillingProviderLabel("mollie"),
      profileLabel: "",
      profileId: "",
      settlementLabel: "",
      supportEmail: "",
      paymentMethods: ["one_time"],
      connectionStatus: "not_configured",
      statusLabel: "Niet gekoppeld",
      helpText:
        "Koppel Mollie per gym om automatische incasso, eenmalige betalingen en deelbare betaalverzoeken voor te bereiden.",
      previewMode: true,
    };
  }

  return {
    enabled: billing.enabled,
    provider: billing.provider,
    providerLabel: getBillingProviderLabel(billing.provider),
    profileLabel: billing.profileLabel,
    profileId: billing.profileId,
    settlementLabel: billing.settlementLabel,
    supportEmail: billing.supportEmail,
    paymentMethods: billing.paymentMethods,
    connectionStatus: getBillingConnectionStatus(billing),
    statusLabel: getBillingStatusLabel(billing),
    helpText: getBillingHelpText(billing),
    previewMode: true,
    notes: billing.notes,
    lastValidatedAt: billing.lastValidatedAt,
    lastPaymentActionAt: billing.lastPaymentActionAt,
    lastPaymentActionBy: billing.lastPaymentActionBy,
  };
}

async function buildLegalComplianceSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["legal"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  const legal = tenantProfile?.legal;

  if (!legal) {
    return {
      termsUrl: "",
      privacyUrl: "",
      sepaCreditorId: "",
      sepaMandateText: "",
      contractPdfTemplateKey: "",
      waiverStorageKey: "",
      waiverRetentionMonths: 84,
      statusLabel: "Niet ingericht",
      helpText:
        "Voeg voorwaarden, privacy, SEPA-toestemming, contract-PDF en waiver-opslag toe voordat je live gaat.",
    };
  }

  const missing = [
    legal.termsUrl ? null : "voorwaarden",
    legal.privacyUrl ? null : "privacy",
    legal.sepaCreditorId ? null : "SEPA creditor ID",
    legal.sepaMandateText ? null : "SEPA machtigingstekst",
    legal.contractPdfTemplateKey ? null : "contract-PDF template",
    legal.waiverStorageKey ? null : "waiver-opslag",
  ].filter(Boolean);

  return {
    ...legal,
    statusLabel: missing.length === 0 ? "Juridisch klaar" : `${missing.length} check${missing.length === 1 ? "" : "s"}`,
    helpText:
      missing.length === 0
        ? "Voorwaarden, privacy, SEPA-toestemming, contract-PDF en waiver-opslag zijn vastgelegd."
        : `Nog nodig: ${missing.join(", ")}.`,
  };
}

function featureStates(runtime: GymPlatformRuntime, actor: AuthActor, tenantContext: TenantContext) {
  return runtime.featureEvaluator
    .list({ actor, tenantContext })
    .map<FeatureState>((evaluation) => ({
      key: evaluation.key,
      enabled: evaluation.enabled,
      reason: evaluation.reason,
      description:
        featureDefinitions.find((definition) => definition.key === evaluation.key)
          ?.description ?? "Geen omschrijving beschikbaar.",
    }));
}

function normalizeEmailValue(email: string) {
  return email.trim().toLowerCase();
}

function createPublicTenantContext(tenantId: string) {
  return createTenantContext({
    tenantId,
    product: PRODUCT_NAME,
    environment: ENVIRONMENT,
    requestId: toCorrelationId(requestIdGenerator.next()),
    actorId: "public-portal",
  });
}

function createPublicBookingActor(
  tenantId: string,
  member: {
    readonly id: string;
    readonly email: string;
    readonly fullName: string;
  },
) {
  return createAuthActor({
    subjectId: `public-${member.id}`,
    email: member.email,
    displayName: member.fullName,
    tenantMemberships: [
      {
        tenantId,
        roles: ["gym.frontdesk"],
      },
    ],
  });
}

export interface GymPlatformServices {
  createRequestTenantContext(actor: AuthActor, tenantId?: string): TenantContext;
  getDashboardSnapshot(
    actor: AuthActor,
    tenantContext: TenantContext,
  ): Promise<GymDashboardSnapshot>;
  getPublicReservationSnapshot(input?: {
    readonly tenantSlug?: string;
  }): Promise<PublicReservationSnapshot>;
  listMembers(actor: AuthActor, tenantContext: TenantContext): Promise<GymDashboardSnapshot["members"]>;
  listLocations(
    actor: AuthActor,
    tenantContext: TenantContext,
  ): Promise<GymDashboardSnapshot["locations"]>;
  listClassSessions(
    actor: AuthActor,
    tenantContext: TenantContext,
  ): Promise<GymDashboardSnapshot["classSessions"]>;
  listBookings(
    actor: AuthActor,
    tenantContext: TenantContext,
  ): Promise<GymDashboardSnapshot["bookings"]>;
  createLocation(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: CreateLocationInput,
  ): Promise<GymDashboardSnapshot["locations"][number]>;
  updateLocation(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: UpdateLocationInput,
  ): Promise<GymDashboardSnapshot["locations"][number]>;
  archiveLocation(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ): Promise<GymDashboardSnapshot["locations"][number]>;
  deleteLocation(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ): Promise<void>;
  createMembershipPlan(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: CreateMembershipPlanInput,
  ): Promise<GymDashboardSnapshot["membershipPlans"][number]>;
  updateMembershipPlan(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: UpdateMembershipPlanInput,
  ): Promise<GymDashboardSnapshot["membershipPlans"][number]>;
  archiveMembershipPlan(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ): Promise<GymDashboardSnapshot["membershipPlans"][number]>;
  deleteMembershipPlan(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ): Promise<void>;
  createTrainer(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: CreateTrainerInput,
  ): Promise<GymDashboardSnapshot["trainers"][number]>;
  updateTrainer(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: UpdateTrainerInput,
  ): Promise<GymDashboardSnapshot["trainers"][number]>;
  archiveTrainer(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ): Promise<GymDashboardSnapshot["trainers"][number]>;
  deleteTrainer(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ): Promise<void>;
  createMember(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: CreateMemberInput,
  ): Promise<GymDashboardSnapshot["members"][number]>;
  updateMember(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: UpdateMemberInput,
  ): Promise<GymDashboardSnapshot["members"][number]>;
  archiveMember(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ): Promise<GymDashboardSnapshot["members"][number]>;
  deleteMember(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ): Promise<void>;
  importContractsAndMembers(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly defaultLocationId: string;
      readonly rows: ReadonlyArray<{
        readonly fullName: string;
        readonly email: string;
        readonly phone: string;
        readonly phoneCountry: CreateMemberInput["phoneCountry"];
        readonly membershipName: string;
        readonly billingCycle: CreateMembershipPlanInput["billingCycle"];
        readonly priceMonthly: number;
        readonly homeLocationName?: string;
        readonly status: CreateMemberInput["status"];
        readonly waiverStatus: CreateMemberInput["waiverStatus"];
        readonly tags: ReadonlyArray<string>;
      }>;
    },
  ): Promise<{
    readonly createdMembershipPlans: number;
    readonly importedMembers: number;
    readonly skippedMembers: number;
    readonly skippedEmails: ReadonlyArray<string>;
  }>;
  createClassSession(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: CreateClassSessionInput,
  ): Promise<GymDashboardSnapshot["classSessions"][number]>;
  updateClassSession(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: UpdateClassSessionInput,
  ): Promise<GymDashboardSnapshot["classSessions"][number]>;
  archiveClassSession(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ): Promise<GymDashboardSnapshot["classSessions"][number]>;
  deleteClassSession(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: { readonly id: string; readonly expectedVersion: number },
  ): Promise<void>;
  createStaffAccount(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly displayName: string;
      readonly email: string;
      readonly password: string;
      readonly roleKey: "owner" | "manager" | "trainer" | "frontdesk";
    },
  ): Promise<StaffSummary>;
  updateStaffAccount(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly userId: string;
      readonly expectedUpdatedAt: string;
      readonly displayName: string;
      readonly email: string;
      readonly roleKey: "owner" | "manager" | "trainer" | "frontdesk";
      readonly status: "active" | "archived";
    },
  ): Promise<StaffSummary>;
  deleteStaffAccount(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: { readonly userId: string; readonly expectedUpdatedAt: string },
  ): Promise<void>;
  updateRemoteAccessSettings(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly enabled: boolean;
      readonly provider: GymDashboardSnapshot["remoteAccess"]["provider"];
      readonly bridgeType: GymDashboardSnapshot["remoteAccess"]["bridgeType"];
      readonly locationId: string | null;
      readonly deviceLabel: string;
      readonly externalDeviceId: string;
      readonly notes?: string;
    },
  ): Promise<GymDashboardSnapshot["remoteAccess"]>;
  updateBillingSettings(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly enabled: boolean;
      readonly provider: GymDashboardSnapshot["payments"]["provider"];
      readonly profileLabel: string;
      readonly profileId: string;
      readonly settlementLabel: string;
      readonly supportEmail: string;
      readonly paymentMethods: ReadonlyArray<
        GymDashboardSnapshot["payments"]["paymentMethods"][number]
      >;
      readonly notes?: string;
    },
  ): Promise<GymDashboardSnapshot["payments"]>;
  updateLegalSettings(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: Omit<GymDashboardSnapshot["legal"], "statusLabel" | "helpText" | "lastValidatedAt">,
  ): Promise<GymDashboardSnapshot["legal"]>;
  requestRemoteAccessUnlock(
    actor: AuthActor,
    tenantContext: TenantContext,
  ): Promise<RemoteAccessActionReceipt>;
  requestBillingPreview(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly paymentMethod: GymDashboardSnapshot["payments"]["paymentMethods"][number];
      readonly amountCents: number;
      readonly currency: string;
      readonly description: string;
      readonly memberName?: string;
    },
  ): Promise<BillingActionReceipt>;
  createBooking(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: CreateBookingInput,
  ): Promise<{
    booking: ClassBooking;
    alreadyExisted: boolean;
    messagePreview: string;
    messageReceipt: MessageReceipt;
  }>;
  createPublicReservation(input: {
    readonly tenantSlug?: string;
    readonly classSessionId: string;
    readonly fullName?: string;
    readonly email: string;
    readonly phone: string;
    readonly phoneCountry: CreateBookingInput["phoneCountry"];
    readonly notes?: string;
  }): Promise<{
    booking: ClassBooking;
    alreadyExisted: boolean;
    messagePreview: string;
    messageReceipt: MessageReceipt;
  }>;
  cancelBooking(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: CancelBookingInput,
  ): Promise<{
    booking: ClassBooking;
    promotedBooking?: ClassBooking;
    promotedMessagePreview?: string;
  }>;
  recordAttendance(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: RecordAttendanceInput,
  ): Promise<ClassBooking>;
  getHealthReport(actor: AuthActor, tenantContext: TenantContext): Promise<GymDashboardSnapshot["healthReport"]>;
}

export async function createGymPlatformServices(): Promise<GymPlatformServices> {
  const runtime = await createRuntime();

  async function createBookingFlow(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: CreateBookingInput,
    member: Awaited<ReturnType<GymStore["getMember"]>> extends infer T ? T : never,
    classSession: Awaited<ReturnType<GymStore["getClassSession"]>> extends infer T ? T : never,
  ) {
    const rateLimitResult = runtime.rateLimiter.consume({
      key: buildRateLimitKey({
        scope: "bookings.create",
        identifier: actor.subjectId,
        fallbackIdentifier: tenantContext.tenantId,
      }),
      windowMs: 60_000,
      maxRequests: 6,
    });

    if (!rateLimitResult.allowed) {
      throw new AppError("Te veel booking requests in korte tijd.", {
        code: "RATE_LIMIT_EXCEEDED",
        details: rateLimitResult,
      });
    }

    if (!member || !classSession) {
      throw new AppError("Lid of les kon niet gevonden worden.", {
        code: "RESOURCE_NOT_FOUND",
      });
    }

    const waitlistFeature = runtime.featureEvaluator.evaluate("bookings.waitlist", {
      actor,
      tenantContext,
    });

    if (
      classSession.bookedCount >= classSession.capacity &&
      !waitlistFeature.enabled
    ) {
      throw new AppError("Waitlist is uitgeschakeld voor deze tenant.", {
        code: "FORBIDDEN",
        details: { feature: waitlistFeature.key },
      });
    }

    const bookingResult = await runtime.store.createBooking(tenantContext, {
      ...input,
      phone: input.phone
        ? normalizePhoneForStorage(input.phone, input.phoneCountry ?? member.phoneCountry)
        : member.phone,
      phoneCountry: input.phoneCountry ?? member.phoneCountry,
    });

    await runtime.auditLogger.write({
      action: bookingResult.alreadyExisted ? "booking.reused" : "booking.created",
      category: "bookings",
      actorId: actor.subjectId,
      tenantId: tenantContext.tenantId,
      metadata: {
        bookingId: bookingResult.booking.id,
        classSessionId: bookingResult.booking.classSessionId,
        memberId: bookingResult.booking.memberId,
        source: bookingResult.booking.source,
      },
    });

    const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
    const location = (await runtime.store.listLocations(tenantContext)).find(
      (entry) => entry.id === classSession.locationId,
    );
    const messagePreview = runtime.templateRenderer.render(
      "Hoi {{memberName}}, je boeking voor {{className}} op {{slot}} bij {{location}} is {{status}}.",
      {
        memberName: member.fullName,
        className: classSession.title,
        slot: formatClassSlot(classSession.startsAt),
        location: location?.name ?? tenantProfile?.name ?? "je sportschool",
        status: describeBookingStatusForMemberMessage(
          bookingResult.booking.status,
          bookingResult.alreadyExisted,
        ),
      },
    );

    const messageReceipt = await runtime.messagingProvider.send({
      channel: "whatsapp",
      recipient: bookingResult.booking.phone,
      body: messagePreview,
      tenantContext,
      actor,
      metadata: {
        bookingId: bookingResult.booking.id,
      },
    });

    return {
      booking: bookingResult.booking,
      alreadyExisted: bookingResult.alreadyExisted,
      messagePreview,
      messageReceipt,
    };
  }

  return {
    createRequestTenantContext(actor, tenantId) {
      const membership = listActorTenants(actor)[0];
      return createTenantContext({
        tenantId: tenantId ?? membership?.tenantId ?? "platform-setup-pending",
        product: PRODUCT_NAME,
        environment: ENVIRONMENT,
        requestId: toCorrelationId(requestIdGenerator.next()),
        actorId: actor.subjectId,
      });
    },
    async getDashboardSnapshot(actor, tenantContext) {
      assertAccess(runtime, actor, tenantContext, ["dashboard.read"]);
      const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);

      const cache = createTenantAwareCache(runtime, tenantContext);
      const cached = await cache.getJson<GymDashboardSnapshot>(
        "dashboard",
        actor.subjectId,
      );

      if (cached) {
        return cached;
      }

      const [
        locations,
        membershipPlans,
        members,
        trainers,
        classSessions,
        bookings,
        attendance,
        waivers,
        auditEntries,
        healthReport,
        staff,
      ] = await Promise.all([
        runtime.store.listLocations(tenantContext),
        runtime.store.listMembershipPlans(tenantContext),
        runtime.store.listMembers(tenantContext),
        runtime.store.listTrainers(tenantContext),
        runtime.store.listClassSessions(tenantContext),
        runtime.store.listBookings(tenantContext),
        runtime.store.listAttendance(tenantContext),
        runtime.store.listWaivers(tenantContext),
        runtime.auditLogger.list({ tenantId: tenantContext.tenantId }),
        runtime.healthRegistry.run({ tenantContext }),
        buildStaffSummaries(runtime, tenantContext),
      ]);
      const remoteAccess = await buildRemoteAccessSummary(tenantContext, locations);
      const payments = await buildBillingSummary(tenantContext);
      const legal = await buildLegalComplianceSummary(tenantContext);

      const activeMemberCount = members.filter((member) => member.status === "active").length;
      const occupancyRate =
        classSessions.reduce((total, session) => total + session.bookedCount / session.capacity, 0) /
        Math.max(classSessions.length, 1);
      const projectedRevenue = membershipPlans.reduce(
        (total, plan) => total + plan.priceMonthly * plan.activeMembers,
        0,
      );
      const nextClass = [...classSessions].sort((left, right) =>
        left.startsAt.localeCompare(right.startsAt),
      )[0];
      const nextClassLocation = locations.find(
        (location) => location.id === nextClass?.locationId,
      );
      const notificationPreview = nextClass
        ? runtime.templateRenderer.render(
            "Hoi {{memberName}}, je plek voor {{className}} op {{slot}} bij {{location}} staat klaar.",
            {
              memberName: members[0]?.fullName ?? "atleet",
              className: nextClass.title,
              slot: formatClassSlot(nextClass.startsAt),
              location: nextClassLocation?.name ?? tenantProfile?.name ?? "je sportschool",
            },
          )
        : "Geen aankomende lessen gevonden.";

      const waiverUploadPath = runtime.storagePathFactory.createTenantPath(
        tenantContext,
        {
          domain: "waivers",
          entityId: members[0]?.id ?? "member",
          fileName: "signed-liability-waiver.pdf",
        },
      );

      const snapshot: GymDashboardSnapshot = {
        tenantName: tenantProfile?.name ?? "Jouw sportschool",
        actorName: actor.displayName ?? actor.subjectId,
        actorEmail: actor.email,
        runtime: {
          storeMode: runtime.storeMode,
          cacheMode: runtime.cacheMode,
          messagingMode: runtime.messagingMode,
          storageMode: runtime.storageMode,
        },
        uiCapabilities: {
          canCreateBooking: runtime.permissionRegistry.hasPermissions(
            actor,
            ["classes.book"],
            tenantContext,
          ),
          canRecordAttendance: runtime.permissionRegistry.hasPermissions(
            actor,
            ["attendance.write"],
            tenantContext,
          ),
          canManagePlatform: runtime.permissionRegistry.hasPermissions(
            actor,
            ["operations.manage"],
            tenantContext,
          ),
          canManageStaff: runtime.permissionRegistry.hasPermissions(
            actor,
            ["settings.manage"],
            tenantContext,
          ),
          canManageRemoteAccess: runtime.permissionRegistry.hasPermissions(
            actor,
            ["settings.manage"],
            tenantContext,
          ),
          canManagePayments: runtime.permissionRegistry.hasPermissions(
            actor,
            ["settings.manage"],
            tenantContext,
          ),
        },
        remoteAccess,
        payments,
        legal,
        metrics: [
          {
            label: "Actieve leden",
            value: String(activeMemberCount),
            helper: `${members.length} ledenprofielen in deze gym`,
            tone: "success",
          },
          {
            label: "Gem. bezetting",
            value: `${Math.round(occupancyRate * 100)}%`,
            helper: "Op basis van de eerstvolgende klassen",
            tone: "info",
          },
          {
            label: "Openstaande waivers",
            value: String(members.filter((member) => member.waiverStatus === "pending").length),
            helper: "Digitale intake nog niet afgerond",
            tone: "warning",
          },
          {
            label: "Check-ins vandaag",
            value: String(attendance.length),
            helper: "Via coachdesk of QR flow",
            tone: "default",
          },
        ],
        featureFlags: featureStates(runtime, actor, tenantContext),
        locations,
        membershipPlans,
        members,
        trainers,
        classSessions,
        bookings,
        attendance,
        waivers,
        staff,
        auditEntries: auditEntries.slice(0, 6) as ReadonlyArray<AuditEntry>,
        healthReport,
        projectedRevenueLabel: formatCurrencyValue(projectedRevenue, "EUR", "nl"),
        notificationPreview,
        waiverUploadPath,
        supportedLanguages: getLanguageOptions()
          .slice(0, 6)
          .map((language) => language.nativeName),
      };

      const serializedSnapshot = toClientPlain(snapshot);

      await cache.setJson("dashboard", actor.subjectId, serializedSnapshot, {
        ttlSeconds: 30,
      });

      return serializedSnapshot;
    },
    async getPublicReservationSnapshot(input) {
      const [tenants, requestedTenant] = await Promise.all([
        listLocalTenants(),
        input?.tenantSlug ? getLocalTenantProfileBySlug(input.tenantSlug) : Promise.resolve(null),
      ]);
      const tenantProfile =
        requestedTenant ?? (tenants.length === 1 ? tenants[0] ?? null : null);

      if (!tenantProfile) {
        return toClientPlain({
          tenantName: tenants.length > 1 ? "Kies je sportschool" : "Jouw sportschool",
          tenantSlug: null,
          availableGyms: tenants.map((tenant) => ({
            id: tenant.id,
            slug: tenant.id,
            name: tenant.name,
          })),
          classSessions: [],
        });
      }

      const tenantContext = createPublicTenantContext(tenantProfile.id);
      const [locations, trainers, classSessions] = await Promise.all([
        runtime.store.listLocations(tenantContext),
        runtime.store.listTrainers(tenantContext),
        runtime.store.listClassSessions(tenantContext),
      ]);

      const locationById = new Map(
        locations.map((location) => [location.id, location] as const),
      );
      const trainerById = new Map(
        trainers.map((trainer) => [trainer.id, trainer] as const),
      );

      return toClientPlain({
        tenantName: tenantProfile.name,
        tenantSlug: tenantProfile.id,
        availableGyms: tenants.map((tenant) => ({
          id: tenant.id,
          slug: tenant.id,
          name: tenant.name,
        })),
        classSessions: [...classSessions]
          .filter((classSession) => classSession.status === "active")
          .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
          .map((classSession) => ({
            id: classSession.id,
            title: classSession.title,
            startsAt: classSession.startsAt,
            durationMinutes: classSession.durationMinutes,
            locationName:
              locationById.get(classSession.locationId)?.name ?? "Onbekende locatie",
            trainerName:
              trainerById.get(classSession.trainerId)?.fullName ?? "Onbekende trainer",
            capacity: classSession.capacity,
            bookedCount: classSession.bookedCount,
            waitlistCount: classSession.waitlistCount,
            level: classSession.level,
            focus: classSession.focus,
          })),
      });
    },
    async listMembers(actor, tenantContext) {
      assertAccess(runtime, actor, tenantContext, ["members.read"]);
      return runtime.store.listMembers(tenantContext);
    },
    async listLocations(actor, tenantContext) {
      assertAccess(runtime, actor, tenantContext, ["dashboard.read"]);
      return runtime.store.listLocations(tenantContext);
    },
    async listClassSessions(actor, tenantContext) {
      assertAccess(runtime, actor, tenantContext, ["classes.read"]);
      return runtime.store.listClassSessions(tenantContext);
    },
    async listBookings(actor, tenantContext) {
      assertAccess(runtime, actor, tenantContext, ["classes.read"]);
      return runtime.store.listBookings(tenantContext);
    },
    async createLocation(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const location = await runtime.store.createLocation(tenantContext, input);
      await runtime.auditLogger.write({
        action: "location.created",
        category: "locations",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { locationId: location.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return location;
    },
    async updateLocation(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const location = await runtime.store.updateLocation(tenantContext, input);
      await runtime.auditLogger.write({
        action: "location.updated",
        category: "locations",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { locationId: location.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return location;
    },
    async archiveLocation(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const location = await runtime.store.archiveLocation(tenantContext, input);
      await runtime.auditLogger.write({
        action: "location.archived",
        category: "locations",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { locationId: location.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return location;
    },
    async deleteLocation(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await runtime.store.deleteLocation(tenantContext, input);
      await runtime.auditLogger.write({
        action: "location.deleted",
        category: "locations",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { locationId: input.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
    },
    async createMembershipPlan(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const membershipPlan = await runtime.store.createMembershipPlan(
        tenantContext,
        input,
      );
      await runtime.auditLogger.write({
        action: "membership.created",
        category: "memberships",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { membershipPlanId: membershipPlan.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return membershipPlan;
    },
    async updateMembershipPlan(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const membershipPlan = await runtime.store.updateMembershipPlan(
        tenantContext,
        input,
      );
      await runtime.auditLogger.write({
        action: "membership.updated",
        category: "memberships",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { membershipPlanId: membershipPlan.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return membershipPlan;
    },
    async archiveMembershipPlan(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const membershipPlan = await runtime.store.archiveMembershipPlan(
        tenantContext,
        input,
      );
      await runtime.auditLogger.write({
        action: "membership.archived",
        category: "memberships",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { membershipPlanId: membershipPlan.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return membershipPlan;
    },
    async deleteMembershipPlan(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await runtime.store.deleteMembershipPlan(tenantContext, input);
      await runtime.auditLogger.write({
        action: "membership.deleted",
        category: "memberships",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { membershipPlanId: input.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
    },
    async createTrainer(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const trainer = await runtime.store.createTrainer(tenantContext, input);
      await runtime.auditLogger.write({
        action: "trainer.created",
        category: "trainers",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { trainerId: trainer.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return trainer;
    },
    async updateTrainer(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const trainer = await runtime.store.updateTrainer(tenantContext, input);
      await runtime.auditLogger.write({
        action: "trainer.updated",
        category: "trainers",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { trainerId: trainer.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return trainer;
    },
    async archiveTrainer(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const trainer = await runtime.store.archiveTrainer(tenantContext, input);
      await runtime.auditLogger.write({
        action: "trainer.archived",
        category: "trainers",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { trainerId: trainer.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return trainer;
    },
    async deleteTrainer(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await runtime.store.deleteTrainer(tenantContext, input);
      await runtime.auditLogger.write({
        action: "trainer.deleted",
        category: "trainers",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { trainerId: input.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
    },
    async createMember(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const member = await runtime.store.createMember(tenantContext, {
        ...input,
        phone: normalizePhoneForStorage(input.phone, input.phoneCountry),
      });
      await runtime.auditLogger.write({
        action: "member.created",
        category: "members",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { memberId: member.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return member;
    },
    async updateMember(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const member = await runtime.store.updateMember(tenantContext, {
        ...input,
        phone: normalizePhoneForStorage(input.phone, input.phoneCountry),
      });
      await runtime.auditLogger.write({
        action: "member.updated",
        category: "members",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { memberId: member.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return member;
    },
    async archiveMember(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const member = await runtime.store.archiveMember(tenantContext, input);
      await runtime.auditLogger.write({
        action: "member.archived",
        category: "members",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { memberId: member.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return member;
    },
    async deleteMember(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await runtime.store.deleteMember(tenantContext, input);
      await runtime.auditLogger.write({
        action: "member.deleted",
        category: "members",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { memberId: input.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
    },
    async importContractsAndMembers(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);

      const [locations, existingPlans, existingMembers] = await Promise.all([
        runtime.store.listLocations(tenantContext),
        runtime.store.listMembershipPlans(tenantContext),
        runtime.store.listMembers(tenantContext),
      ]);

      const defaultLocation = locations.find((location) => location.id === input.defaultLocationId);

      if (!defaultLocation) {
        throw new AppError("Kies eerst een geldige vestiging voor de import.", {
          code: "RESOURCE_NOT_FOUND",
          details: { defaultLocationId: input.defaultLocationId },
        });
      }

      const planMap = new Map<string, GymDashboardSnapshot["membershipPlans"][number]>(
        existingPlans.map((plan) => [
          `${plan.name.trim().toLowerCase()}::${plan.billingCycle}::${plan.priceMonthly}`,
          plan,
        ] as const),
      );
      const knownEmails = new Set(
        existingMembers.map((member) => normalizeEmailValue(member.email)),
      );
      const skippedEmails: string[] = [];
      let createdMembershipPlans = 0;
      let importedMembers = 0;

      for (const row of input.rows) {
        const normalizedEmail = normalizeEmailValue(row.email);

        if (knownEmails.has(normalizedEmail)) {
          skippedEmails.push(normalizedEmail);
          continue;
        }

        const targetLocation =
          row.homeLocationName?.trim()
            ? locations.find(
                (location) =>
                  location.name.trim().toLowerCase() ===
                  row.homeLocationName?.trim().toLowerCase(),
              ) ?? null
            : defaultLocation;

        if (!targetLocation) {
          throw new AppError("Vestiging voor importregel niet gevonden.", {
            code: "RESOURCE_NOT_FOUND",
            details: {
              email: normalizedEmail,
              homeLocationName: row.homeLocationName,
            },
          });
        }

        const planKey = `${row.membershipName.trim().toLowerCase()}::${row.billingCycle}::${row.priceMonthly}`;
        let membershipPlan = planMap.get(planKey) ?? null;

        if (!membershipPlan) {
          membershipPlan = await runtime.store.createMembershipPlan(tenantContext, {
            name: row.membershipName.trim(),
            priceMonthly: row.priceMonthly,
            billingCycle: row.billingCycle,
            perks: [`Contractduur ${getMembershipBillingCycleLabel(row.billingCycle).toLowerCase()}`],
          });
          planMap.set(planKey, membershipPlan);
          createdMembershipPlans += 1;
        }

        await runtime.store.createMember(tenantContext, {
          fullName: row.fullName.trim(),
          email: normalizedEmail,
          phone: normalizePhoneForStorage(row.phone, row.phoneCountry),
          phoneCountry: row.phoneCountry,
          membershipPlanId: membershipPlan.id,
          homeLocationId: targetLocation.id,
          status: row.status,
          tags: [...row.tags],
          waiverStatus: row.waiverStatus,
        });

        knownEmails.add(normalizedEmail);
        importedMembers += 1;
      }

      await runtime.auditLogger.write({
        action: "members.imported",
        category: "members",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          createdMembershipPlans,
          importedMembers,
          skippedMembers: skippedEmails.length,
        },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);

      return {
        createdMembershipPlans,
        importedMembers,
        skippedMembers: skippedEmails.length,
        skippedEmails,
      };
    },
    async createClassSession(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const classSession = await runtime.store.createClassSession(tenantContext, input);
      await runtime.auditLogger.write({
        action: "class.created",
        category: "classes",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { classSessionId: classSession.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return classSession;
    },
    async updateClassSession(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const classSession = await runtime.store.updateClassSession(
        tenantContext,
        input,
      );
      await runtime.auditLogger.write({
        action: "class.updated",
        category: "classes",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { classSessionId: classSession.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return classSession;
    },
    async archiveClassSession(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      const classSession = await runtime.store.archiveClassSession(
        tenantContext,
        input,
      );
      await runtime.auditLogger.write({
        action: "class.archived",
        category: "classes",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { classSessionId: classSession.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return classSession;
    },
    async deleteClassSession(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await runtime.store.deleteClassSession(tenantContext, input);
      await runtime.auditLogger.write({
        action: "class.deleted",
        category: "classes",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { classSessionId: input.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
    },
    async createStaffAccount(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      const nextState = await createLocalPlatformAccount(tenantContext.tenantId, input);
      const createdAccount = nextState.accounts[nextState.accounts.length - 1];

      await runtime.userDirectory.upsert(
        createPlatformUser({
          userId: createdAccount!.userId,
          email: createdAccount!.email,
          displayName: createdAccount!.displayName,
          memberships: [
            {
              tenantId: tenantContext.tenantId,
              roleKeys: [getMembershipRole(createdAccount!.roleKey)],
            },
          ],
        }),
      );

      await runtime.auditLogger.write({
        action: "staff.created",
        category: "staff",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          userId: createdAccount!.userId,
          role: createdAccount!.roleKey,
        },
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);

      return {
        id: createdAccount!.userId,
        displayName: createdAccount!.displayName,
        email: createdAccount!.email,
        status: createdAccount!.status,
        roles: [getMembershipRole(createdAccount!.roleKey)],
        roleKey: createdAccount!.roleKey,
        updatedAt: createdAccount!.updatedAt,
      };
    },
    async updateStaffAccount(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      const nextState = await updateLocalPlatformAccount(tenantContext.tenantId, input);
      const updatedAccount = nextState.accounts.find(
        (account) => account.userId === input.userId,
      );

      if (!updatedAccount) {
        throw new AppError("Teamaccount kon niet worden teruggelezen.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      await runtime.userDirectory.upsert(
        createPlatformUser({
          userId: updatedAccount.userId,
          email: updatedAccount.email,
          displayName: updatedAccount.displayName,
          status: updatedAccount.status === "archived" ? "disabled" : "active",
          memberships: [
            {
              tenantId: tenantContext.tenantId,
              roleKeys: [getMembershipRole(updatedAccount.roleKey)],
            },
          ],
        }),
      );

      await runtime.auditLogger.write({
        action: "staff.updated",
        category: "staff",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          userId: updatedAccount.userId,
          role: updatedAccount.roleKey,
          status: updatedAccount.status,
        },
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);

      return {
        id: updatedAccount.userId,
        displayName: updatedAccount.displayName,
        email: updatedAccount.email,
        status: updatedAccount.status,
        roles: [getMembershipRole(updatedAccount.roleKey)],
        roleKey: updatedAccount.roleKey,
        updatedAt: updatedAccount.updatedAt,
      };
    },
    async deleteStaffAccount(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      await deleteLocalPlatformAccount(tenantContext.tenantId, input);

      await runtime.auditLogger.write({
        action: "staff.deleted",
        category: "staff",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { userId: input.userId },
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
    },
    async updateRemoteAccessSettings(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);

      if (input.locationId) {
        const locations = await runtime.store.listLocations(tenantContext);

        if (!locations.some((entry) => entry.id === input.locationId)) {
          throw new AppError("Vestiging voor remote toegang niet gevonden.", {
            code: "RESOURCE_NOT_FOUND",
            details: { locationId: input.locationId },
          });
        }
      }

      await updateLocalTenantRemoteAccess(tenantContext.tenantId, input);

      await runtime.auditLogger.write({
        action: "remote_access.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          provider: input.provider,
          locationId: input.locationId,
          enabled: input.enabled,
        },
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return buildRemoteAccessSummary(
        tenantContext,
        await runtime.store.listLocations(tenantContext),
      );
    },
    async updateBillingSettings(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);

      await updateLocalTenantBillingSettings(tenantContext.tenantId, input);

      await runtime.auditLogger.write({
        action: "billing.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          provider: input.provider,
          enabled: input.enabled,
          paymentMethods: input.paymentMethods,
        },
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return buildBillingSummary(tenantContext);
    },
    async updateLegalSettings(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);

      await updateLocalTenantLegalSettings(tenantContext.tenantId, input);

      await runtime.auditLogger.write({
        action: "legal.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          hasTerms: Boolean(input.termsUrl),
          hasPrivacy: Boolean(input.privacyUrl),
          hasSepa: Boolean(input.sepaCreditorId && input.sepaMandateText),
          hasContractPdf: Boolean(input.contractPdfTemplateKey),
          hasWaiverStorage: Boolean(input.waiverStorageKey),
        },
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return buildLegalComplianceSummary(tenantContext);
    },
    async requestRemoteAccessUnlock(actor, tenantContext) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);

      const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
      const remoteAccess = tenantProfile?.remoteAccess;

      if (!remoteAccess || !isRemoteAccessReady(remoteAccess)) {
        throw new AppError(
          "Koppel en activeer eerst een slim slot voordat je remote opent.",
          {
            code: "FORBIDDEN",
          },
        );
      }

      const locations = await runtime.store.listLocations(tenantContext);
      const locationName =
        (remoteAccess.locationId
          ? locations.find((entry) => entry.id === remoteAccess.locationId)?.name
          : null) ?? null;
      const providerLabel = getRemoteAccessProviderLabel(remoteAccess.provider);
      const requestedAt = new Date().toISOString();

      await markLocalTenantRemoteAccessAction(
        tenantContext.tenantId,
        actor.displayName ?? actor.subjectId,
      );

      await runtime.auditLogger.write({
        action: "remote_access.unlock_requested",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          provider: remoteAccess.provider,
          deviceLabel: remoteAccess.deviceLabel,
          locationId: remoteAccess.locationId,
          mode: "preview",
        },
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);

      return {
        provider: remoteAccess.provider,
        providerLabel,
        deviceLabel: remoteAccess.deviceLabel,
        locationName,
        requestedAt,
        mode: "preview",
        summary: `Preview remote open verstuurd naar ${remoteAccess.deviceLabel} via ${providerLabel}${locationName ? ` voor ${locationName}` : ""}.`,
      };
    },
    async requestBillingPreview(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);

      const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
      const billing = tenantProfile?.billing;

      if (!billing || !isBillingReady(billing)) {
        throw new AppError(
          "Koppel en activeer eerst Mollie voordat je een betaalflow previewt.",
          {
            code: "FORBIDDEN",
          },
        );
      }

      if (!billing.paymentMethods.includes(input.paymentMethod)) {
        throw new AppError("Deze betaalflow is nog niet geactiveerd voor deze gym.", {
          code: "FORBIDDEN",
          details: { paymentMethod: input.paymentMethod },
        });
      }

      const requestedAt = new Date().toISOString();
      const paymentMethodLabel = getBillingPaymentMethodLabel(input.paymentMethod);
      const amountLabel = formatCurrencyValue(input.amountCents / 100, input.currency, "nl");
      const summary = runtime.templateRenderer.render(
        "Preview {{paymentMethod}} van {{amountLabel}} klaar via {{provider}} voor {{description}}{{memberSuffix}}.",
        {
          paymentMethod: paymentMethodLabel.toLowerCase(),
          amountLabel,
          provider: getBillingProviderLabel(billing.provider),
          description: input.description.trim(),
          memberSuffix: input.memberName?.trim()
            ? ` voor ${input.memberName.trim()}`
            : "",
        },
      );

      await markLocalTenantBillingAction(
        tenantContext.tenantId,
        actor.displayName ?? actor.subjectId,
      );

      await runtime.auditLogger.write({
        action: "billing.preview_requested",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          provider: billing.provider,
          paymentMethod: input.paymentMethod,
          amountCents: input.amountCents,
          currency: input.currency,
        },
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);

      return {
        provider: billing.provider,
        providerLabel: getBillingProviderLabel(billing.provider),
        paymentMethod: input.paymentMethod,
        paymentMethodLabel,
        amountLabel,
        description: input.description.trim(),
        memberName: input.memberName?.trim() || undefined,
        requestedAt,
        mode: "preview",
        summary,
      };
    },
    async createBooking(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["classes.book"]);

      const member = await runtime.store.getMember(tenantContext, input.memberId);
      const classSession = await runtime.store.getClassSession(
        tenantContext,
        input.classSessionId,
      );

      const bookingResult = await createBookingFlow(
        actor,
        tenantContext,
        input,
        member,
        classSession,
      );

      await createTenantAwareCache(runtime, tenantContext).delete(
        "dashboard",
        actor.subjectId,
      );

      return bookingResult;
    },
    async createPublicReservation(input) {
      const [tenants, requestedTenant] = await Promise.all([
        listLocalTenants(),
        input.tenantSlug ? getLocalTenantProfileBySlug(input.tenantSlug) : Promise.resolve(null),
      ]);
      const tenantProfile =
        requestedTenant ?? (tenants.length === 1 ? tenants[0] ?? null : null);

      if (!tenantProfile) {
        throw new AppError(
          tenants.length > 1
            ? "Kies eerst voor welke gym je wilt reserveren."
            : "Het platform is nog niet ingericht.",
          {
            code: "FORBIDDEN",
          },
        );
      }

      const tenantContext = createPublicTenantContext(tenantProfile.id);
      const normalizedEmail = normalizeEmailValue(input.email);
      const normalizedPhone = normalizePhoneForStorage(
        input.phone,
        input.phoneCountry ?? "NL",
      );
      const [members, classSession] = await Promise.all([
        runtime.store.listMembers(tenantContext),
        runtime.store.getClassSession(tenantContext, input.classSessionId),
      ]);

      if (!classSession) {
        throw new AppError("Les kon niet gevonden worden.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      if (classSession.status !== "active") {
        throw new AppError("Deze les is niet beschikbaar voor reserveringen.", {
          code: "FORBIDDEN",
        });
      }

      let member = members.find(
        (entry) =>
          normalizeEmailValue(entry.email) === normalizedEmail &&
          entry.phone === normalizedPhone,
      );

      if (!member) {
        const membershipPlans = await runtime.store.listMembershipPlans(
          tenantContext,
        );
        const membershipPlan = membershipPlans[0];

        if (!membershipPlan) {
          throw new AppError(
            "Deze gym heeft nog geen contracttype voor nieuwe reserveringen.",
            {
              code: "RESOURCE_NOT_FOUND",
            },
          );
        }

        const fallbackName = normalizedEmail
          .split("@")[0]
          ?.replace(/[._-]+/g, " ")
          .trim();

        member = await runtime.store.createMember(tenantContext, {
          fullName: input.fullName?.trim() || fallbackName || "Nieuw lid",
          email: normalizedEmail,
          phone: normalizedPhone,
          phoneCountry: input.phoneCountry ?? "NL",
          membershipPlanId: membershipPlan.id,
          homeLocationId: classSession.locationId,
          status: "trial",
          tags: ["public-reservation"],
          waiverStatus: "pending",
        });

        await runtime.auditLogger.write({
          action: "member.created",
          category: "members",
          actorId: "public-portal",
          tenantId: tenantContext.tenantId,
          metadata: {
            memberId: member.id,
            source: "public-reservation",
          },
        });
      }

      if (!member) {
        throw new AppError("Lid kon niet worden aangemaakt.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      if (member.status === "paused") {
        throw new AppError("Dit lidmaatschap staat op pauze en kan nu niet reserveren.", {
          code: "FORBIDDEN",
        });
      }

      const actor = createPublicBookingActor(tenantProfile.id, member);

      return createBookingFlow(
        actor,
        tenantContext,
        {
          classSessionId: input.classSessionId,
          memberId: member.id,
          idempotencyKey: `member-app:${member.id}:${input.classSessionId}`,
          phone: normalizedPhone,
          phoneCountry: input.phoneCountry ?? member.phoneCountry,
          notes: input.notes,
          source: "member_app",
        },
        member,
        classSession,
      );
    },
    async cancelBooking(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["classes.book"]);

      const result = await runtime.store.cancelBooking(tenantContext, input);
      const classSession = await runtime.store.getClassSession(
        tenantContext,
        result.booking.classSessionId,
      );
      const location = classSession
        ? (await runtime.store.listLocations(tenantContext)).find(
            (entry) => entry.id === classSession.locationId,
          )
        : null;

      await runtime.auditLogger.write({
        action: "booking.cancelled",
        category: "bookings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          bookingId: result.booking.id,
          classSessionId: result.booking.classSessionId,
          memberId: result.booking.memberId,
        },
      });

      let promotedMessagePreview: string | undefined;

      if (result.promotedBooking && classSession) {
        promotedMessagePreview = runtime.templateRenderer.render(
          "Hoi {{memberName}}, er is een plek vrijgekomen voor {{className}} op {{slot}} bij {{location}}. Je booking is nu bevestigd.",
          {
            memberName: result.promotedBooking.memberName,
            className: classSession.title,
            slot: formatClassSlot(classSession.startsAt),
            location: location?.name ?? "je sportschool",
          },
        );

        await runtime.auditLogger.write({
          action: "booking.promoted_from_waitlist",
          category: "bookings",
          actorId: actor.subjectId,
          tenantId: tenantContext.tenantId,
          metadata: {
            bookingId: result.promotedBooking.id,
            classSessionId: result.promotedBooking.classSessionId,
            memberId: result.promotedBooking.memberId,
          },
        });

        await runtime.messagingProvider.send({
          channel: "whatsapp",
          recipient: result.promotedBooking.phone,
          body: promotedMessagePreview,
          tenantContext,
          actor,
          metadata: {
            bookingId: result.promotedBooking.id,
            source: "waitlist-promotion",
          },
        });
      }

      await createTenantAwareCache(runtime, tenantContext).delete(
        "dashboard",
        actor.subjectId,
      );

      return {
        booking: result.booking,
        promotedBooking: result.promotedBooking,
        promotedMessagePreview,
      };
    },
    async recordAttendance(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["attendance.write"]);

      const checkInFeature = runtime.featureEvaluator.evaluate(
        "attendance.self_check_in",
        {
          actor,
          tenantContext,
        },
      );

      if (input.channel === "qr" && !checkInFeature.enabled) {
        throw new AppError("Self check-in is uitgeschakeld voor deze tenant.", {
          code: "FORBIDDEN",
        });
      }

      const booking = await runtime.store.recordAttendance(tenantContext, input);

      await runtime.auditLogger.write({
        action: "attendance.recorded",
        category: "attendance",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          bookingId: booking.id,
          channel: input.channel,
        },
      });

      await createTenantAwareCache(runtime, tenantContext).delete(
        "dashboard",
        actor.subjectId,
      );

      return booking;
    },
    async getHealthReport(actor, tenantContext) {
      assertAccess(runtime, actor, tenantContext, ["dashboard.read"]);
      return runtime.healthRegistry.run({ tenantContext });
    },
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __gymPlatformServices: Promise<GymPlatformServices> | undefined;
}

export function getGymPlatformServices() {
  globalThis.__gymPlatformServices ??= createGymPlatformServices();
  return globalThis.__gymPlatformServices;
}
