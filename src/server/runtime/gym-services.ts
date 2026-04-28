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
import type { FeatureFlagOverride } from "@claimtech/feature-flags";
import {
  DASHBOARD_FEATURE_CATALOG,
} from "@/features/dashboard-feature-catalog";
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
  type StoredBillingSettings,
} from "@/lib/billing";
import {
  getMembershipBillingCycleLabel,
  getMembershipBillingCycleMonths,
} from "@/lib/memberships";
import {
  createMolliePaymentProvider,
  isMolliePaymentConfigured,
  type MolliePaymentStatus,
} from "@/server/runtime/mollie-payments";
import {
  getRemoteAccessConnectionStatus,
  getRemoteAccessHelpText,
  getRemoteAccessProviderLabel,
  getRemoteAccessStatusLabel,
  isRemoteAccessReady,
  type StoredRemoteAccessSettings,
} from "@/lib/remote-access";
import {
  createNukiRemoteAccessProvider,
  isNukiRemoteAccessConfigured,
} from "@/server/runtime/nuki-remote-access";
import {
  createDirectWahaWhatsAppProvider,
  validateWahaConfig,
} from "@/server/runtime/waha-direct-messaging";
import {
  TextTemplateRenderer,
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
  createLocalTenantAppointmentPack,
  createLocalTenantBillingInvoice,
  createLocalTenantBillingReconciliationRun,
  createLocalTenantBillingRefund,
  createLocalTenantBillingWebhook,
  createLocalTenantChallenge,
  createLocalTenantCollectionCase,
  createLocalTenantCommunityGroup,
  createLocalTenantContractRecord,
  createLocalTenantLead,
  createLocalTenantLeadAttribution,
  createLocalTenantLeadAutomationRun,
  createLocalTenantLeadTask,
  createLocalTenantCoachAppointments,
  createLocalTenantMemberSignup,
  createLocalTenantPauseRequest,
  createLocalTenantPaymentMethodRequest,
  createLocalTenantQuestionnaire,
  createLocalTenantQuestionnaireResponse,
  createLocalPlatformAccount,
  deleteLocalMemberPortalAccountByMemberId,
  deleteLocalPlatformAccount,
  getLocalTenantProfileBySlug,
  getLocalTenantProfile,
  listLocalMemberPortalAccountsByEmail,
  listLocalPlatformAccounts,
  listLocalTenants,
  markLocalTenantBillingAction,
  markLocalTenantRemoteAccessAction,
  readLocalPlatformState,
  updateLocalTenantBookingSettings,
  syncLocalMemberPortalAccount,
  upsertLocalMemberPortalAccount,
  updateLocalTenantCoachingSettings,
  updateLocalTenantBillingSettings,
  updateLocalTenantBookingPolicy,
  updateLocalTenantFeatureFlag,
  updateLocalTenantIntegrationSettings,
  updateLocalTenantLegalSettings,
  updateLocalTenantLead,
  updateLocalTenantMarketingSettings,
  updateLocalTenantMobileSettings,
  updateLocalTenantRemoteAccess,
  updateLocalTenantRevenueSettings,
  updateLocalTenantRetentionSettings,
  updateLocalTenantCollectionCase,
  updateLocalPlatformAccount,
  updateLocalPlatformData,
  reviewLocalTenantMemberSignup,
  reviewLocalTenantPauseRequest,
  reviewLocalTenantPaymentMethodRequest,
  updateLocalTenantAppointmentPack,
  updateLocalTenantBillingInvoice,
} from "@/server/persistence/platform-state";
import { toClientPlain } from "@/server/lib/to-client-plain";
import {
  getMembershipRole,
} from "@/server/runtime/platform-roles";
import {
  assertLiveInfrastructureConfiguration,
  assertProductionEnvironmentReady,
  allowsRuntimeFallbacks,
  getProductionReadinessChecks,
} from "@/server/runtime/production-readiness";
import type { DashboardPageKey } from "@/lib/dashboard-pages";
import type {
  BillingActionReceipt,
  BillingPaymentMethod,
  ClassBooking,
  CollectionCasePaymentMethod,
  FeatureState,
  GymDashboardSnapshot,
  GymMember,
  MemberReservationSnapshot,
  PublicMembershipSignupResult,
  PublicMembershipSignupSnapshot,
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
  {
    key: "gym.member",
    scope: "tenant" as const,
    grants: ["classes.read", "classes.book"],
  },
] as const;

const featureDefinitions = DASHBOARD_FEATURE_CATALOG.map((feature) => ({
  key: feature.key,
  defaultValue: feature.defaultValue,
  description: feature.description,
}));

const dashboardFeatureDefinitionMap = new Map(
  DASHBOARD_FEATURE_CATALOG.map((feature) => [feature.key, feature]),
);

function shouldUseRuntimeFallbacks() {
  return allowsRuntimeFallbacks();
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

class NotConfiguredMessagingProvider implements MessagingProvider {
  async send(): Promise<MessageReceipt> {
    return {
      accepted: false,
      status: "failed",
      raw: {
        mode: "not_configured",
        reason:
          "Live WhatsApp/notificatieprovider ontbreekt. Zet WAHA_BASE_URL + WAHA_API_KEY of WhatsApp Cloud credentials.",
      },
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
  const accounts = (await listLocalPlatformAccounts()).filter(
    (account) => account.roleKey !== "member",
  );

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
    if (shouldUseRuntimeFallbacks()) {
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
    if (shouldUseRuntimeFallbacks()) {
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
  const wahaConfig = validateWahaConfig();

  if (wahaConfig.configured && process.env.WAHA_BASE_URL && process.env.WAHA_API_KEY) {
    return {
      messagingProvider: createDirectWahaWhatsAppProvider({
        baseUrl: process.env.WAHA_BASE_URL,
        apiKey: process.env.WAHA_API_KEY,
        session: wahaConfig.session,
      }),
      messagingMode: "waha",
    };
  }

  if (
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
    messagingProvider: new NotConfiguredMessagingProvider(),
    messagingMode: "not_configured",
  };
}

function resolveStorageMode(): StorageMode {
  if (
    process.env.SPACES_BUCKET &&
    process.env.SPACES_ENDPOINT &&
    process.env.SPACES_REGION &&
    process.env.SPACES_ACCESS_KEY_ID &&
    process.env.SPACES_SECRET_ACCESS_KEY
  ) {
    return "spaces";
  }

  return "not_configured";
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
  const localFallbackMode = allowsRuntimeFallbacks();
  const healthRegistry = new HealthRegistry()
    .register({
      name: "Data",
      run: () => ({
        status:
          storeConfig.storeMode === "memory" && !localFallbackMode ? "degraded" : "healthy",
        summary:
          storeConfig.storeMode === "mongo"
            ? "Je clubdata draait op MongoDB voor tenants, accounts en gymdata."
            : localFallbackMode
              ? "De lokale memory store is actief voor ontwikkeling; productie gebruikt MongoDB."
              : "Memory store actief terwijl live runtime MongoDB vereist.",
      }),
    })
    .register({
      name: "Snelheid",
      run: () => ({
        status:
          cacheConfig.cacheMode === "memory" && !localFallbackMode ? "degraded" : "healthy",
        summary:
          cacheConfig.cacheMode === "redis"
            ? "De app gebruikt Redis voor tenant-cache en snelle runtime state."
            : localFallbackMode
              ? "De lokale memory cache is actief voor ontwikkeling; productie gebruikt Redis."
              : "Memory cache actief terwijl live runtime Redis vereist.",
      }),
    })
    .register({
      name: "Berichten",
      run: () => ({
        status: "healthy",
        summary:
          messagingMode === "not_configured"
            ? "WhatsApp/notificaties zijn niet gekoppeld; berichten worden niet als verzonden geaccepteerd."
            : "Live berichtflow staat klaar voor bevestigingen en reminders.",
      }),
    })
    .register({
      name: "Documenten",
      run: () => ({
        status: "healthy",
        summary:
          storageMode === "spaces"
            ? "Bestanden en waivers staan klaar op de cloudopslag."
            : "Cloudopslag is niet gekoppeld; waiver- en uploadpaden blijven verborgen totdat Spaces is ingesteld.",
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

        if (isRemoteAccessReady(remoteAccess) && isLiveRemoteAccessProviderConfigured(remoteAccess)) {
          return {
            status: "healthy",
            summary: `${getRemoteAccessProviderLabel(remoteAccess.provider)} opent live via de gekoppelde smartdoor-provider.`,
          };
        }

        if (isRemoteAccessReady(remoteAccess)) {
          return {
            status: "degraded",
            summary: "Smartdeur is ingericht, maar NUKI_API_TOKEN ontbreekt voor live openen.",
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

        if (isBillingReady(billing) && isLiveBillingProviderConfigured()) {
          return {
            status: "healthy",
            summary: `${getBillingProviderLabel(billing.provider)} verwerkt live ${billing.paymentMethods
              .map(getBillingPaymentMethodLabel)
              .join(", ")}.`,
          };
        }

        if (isBillingReady(billing)) {
          return {
            status: "degraded",
            summary: "Mollie is ingericht, maar MOLLIE_API_KEY of APP_BASE_URL ontbreekt voor live betaalverwerking.",
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
        if (localFallbackMode) {
          return {
            status: "healthy",
            summary:
              "Lokale ontwikkelmodus gebruikt fallback-runtime; live checks worden afgedwongen zodra productie actief is.",
          };
        }

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
        status:
          localFallbackMode || process.env.MIGRATIONS_LOCKED === "true"
            ? "healthy"
            : "degraded",
        summary:
          localFallbackMode
            ? "Migraties zijn niet als lokale blocker actief; borg dit als release-stap voor productie."
            : process.env.MIGRATIONS_LOCKED === "true"
            ? "Migraties zijn als release-stap geborgd."
            : "Leg vast dat database-migraties als release-stap draaien voordat productie live gaat.",
      }),
    })
    .register({
      name: "Security",
      run: () => ({
        status:
          localFallbackMode ||
          (process.env.SECURITY_HEADERS_ENABLED !== "false" &&
            process.env.CLAIMTECH_SESSION_SECRET &&
            process.env.CLAIMTECH_SESSION_SECRET !== "replace-me")
            ? "healthy"
            : "degraded",
        summary:
          localFallbackMode
            ? "Lokale sessieconfiguratie is toegestaan; sterke sessiesleutel en cookiebeleid worden in productie afgedwongen."
            : process.env.SECURITY_HEADERS_ENABLED !== "false"
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

async function createFeatureEvaluatorForTenant(tenantId: string) {
  const tenantProfile = await getLocalTenantProfile(tenantId);
  const overrides: FeatureFlagOverride[] = (tenantProfile?.featureFlags ?? []).map(
    (feature) => ({
      key: feature.key,
      value: feature.value,
      tenantId: toTenantId(tenantId),
    }),
  );

  return new FeatureFlagEvaluator(featureDefinitions, overrides);
}

async function evaluateFeatureFlag(
  actor: AuthActor,
  tenantContext: TenantContext,
  key: string,
) {
  const evaluator = await createFeatureEvaluatorForTenant(tenantContext.tenantId);
  return evaluator.evaluate(key, {
    actor,
    tenantContext,
  });
}

function createFeatureGateActor(tenantId: string, subjectId = "system:feature-gate") {
  return createAuthActor({
    subjectId,
    displayName: "Feature gate",
    tenantMemberships: [
      {
        tenantId,
        roles: ["gym.owner"],
      },
    ],
  });
}

function getFeatureGateMessage(key: string) {
  const definition = dashboardFeatureDefinitionMap.get(key);
  const title = definition?.title ?? key;

  return `${title} is uitgeschakeld voor deze gym. Zet deze feature eerst aan via Superadmin.`;
}

async function assertFeatureEnabled(
  actor: AuthActor,
  tenantContext: TenantContext,
  key: string,
  options?: { readonly message?: string },
) {
  const evaluation = await evaluateFeatureFlag(actor, tenantContext, key);

  if (!evaluation.enabled) {
    throw new AppError(options?.message ?? getFeatureGateMessage(key), {
      code: "FORBIDDEN",
      details: {
        feature: key,
        reason: evaluation.reason,
      },
    });
  }

  return evaluation;
}

function hasSettingChanged<TValue>(current: TValue, next: TValue) {
  return JSON.stringify(current ?? null) !== JSON.stringify(next ?? null);
}

async function assertFeatureSettingChangesEnabled(
  actor: AuthActor,
  tenantContext: TenantContext,
  changes: ReadonlyArray<{
    readonly key: string;
    readonly changed: boolean;
  }>,
) {
  const featureKeys = Array.from(
    new Set(changes.filter((change) => change.changed).map((change) => change.key)),
  );

  for (const key of featureKeys) {
    await assertFeatureEnabled(actor, tenantContext, key);
  }
}

async function assertTenantFeatureEnabled(
  tenantContext: TenantContext,
  key: string,
  options?: { readonly message?: string; readonly subjectId?: string },
) {
  return assertFeatureEnabled(
    createFeatureGateActor(tenantContext.tenantId, options?.subjectId),
    tenantContext,
    key,
    options,
  );
}

function getBillingFeatureForPaymentMethod(paymentMethod: BillingPaymentMethod) {
  switch (paymentMethod) {
    case "direct_debit":
      return "billing.direct_debit";
    case "one_time":
    case "payment_request":
    default:
      return "billing.credit_cards";
  }
}

async function assertBillingPaymentMethodEnabled(
  actor: AuthActor,
  tenantContext: TenantContext,
  paymentMethod: BillingPaymentMethod,
) {
  return assertFeatureEnabled(
    actor,
    tenantContext,
    getBillingFeatureForPaymentMethod(paymentMethod),
  );
}

async function assertBillingPaymentMethodsEnabled(
  actor: AuthActor,
  tenantContext: TenantContext,
  paymentMethods: ReadonlyArray<BillingPaymentMethod>,
) {
  const featureKeys = Array.from(new Set(paymentMethods.map(getBillingFeatureForPaymentMethod)));

  await Promise.all(
    featureKeys.map((featureKey) => assertFeatureEnabled(actor, tenantContext, featureKey)),
  );
}

function isBillingPaymentMethod(paymentMethod: CollectionCasePaymentMethod): paymentMethod is BillingPaymentMethod {
  return (
    paymentMethod === "direct_debit" ||
    paymentMethod === "one_time" ||
    paymentMethod === "payment_request"
  );
}

async function assertCollectionCasePaymentMethodEnabled(
  actor: AuthActor,
  tenantContext: TenantContext,
  paymentMethod: CollectionCasePaymentMethod,
) {
  if (isBillingPaymentMethod(paymentMethod)) {
    await assertBillingPaymentMethodEnabled(actor, tenantContext, paymentMethod);
  }
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
  const accountByUserId = new Map(
    accounts
      .filter((account) => account.roleKey !== "member")
      .map((account) => [account.userId, account]),
  );

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
  }).filter((staff) => staff.roleKey !== "member");
}

async function buildRemoteAccessSummary(
  tenantContext: TenantContext,
  locations: GymDashboardSnapshot["locations"],
): Promise<GymDashboardSnapshot["remoteAccess"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  const remoteAccess = tenantProfile?.remoteAccess;
  const liveProviderConfigured = isLiveRemoteAccessProviderConfigured(remoteAccess);
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
    statusLabel: getRemoteAccessStatusLabel(remoteAccess, { liveProviderConfigured }),
    helpText: getRemoteAccessHelpText(remoteAccess, { liveProviderConfigured }),
    previewMode: !liveProviderConfigured,
    notes: remoteAccess.notes,
    lastValidatedAt: remoteAccess.lastValidatedAt,
    lastRemoteActionAt: remoteAccess.lastRemoteActionAt,
    lastRemoteActionBy: remoteAccess.lastRemoteActionBy,
  };
}

function isLiveRemoteAccessProviderConfigured(
  remoteAccess: StoredRemoteAccessSettings | null | undefined,
) {
  return Boolean(
    remoteAccess &&
      isRemoteAccessReady(remoteAccess) &&
      remoteAccess.provider === "nuki" &&
      isNukiRemoteAccessConfigured(),
  );
}

function getLiveRemoteAccessProvider(
  remoteAccess: StoredRemoteAccessSettings | null | undefined,
) {
  if (!remoteAccess || !remoteAccess.enabled) {
    return null;
  }

  if (getRemoteAccessConnectionStatus(remoteAccess) !== "configured") {
    throw new AppError("Smartdeur instellingen zijn nog niet compleet.", {
      code: "INVALID_INPUT",
      details: {
        provider: remoteAccess.provider,
      },
    });
  }

  if (remoteAccess.provider !== "nuki") {
    throw new AppError("Deze smartdoor-provider heeft nog geen live open-koppeling.", {
      code: "INVALID_INPUT",
      details: {
        provider: remoteAccess.provider,
      },
    });
  }

  if (!isNukiRemoteAccessConfigured()) {
    throw new AppError(
      "Nuki live credentials ontbreken. Vul NUKI_API_TOKEN in voordat je de deur op afstand opent.",
      {
        code: "INVALID_INPUT",
        details: {
          provider: "nuki",
          env: "NUKI_API_TOKEN",
        },
      },
    );
  }

  return createNukiRemoteAccessProvider();
}

function resolveAppBaseUrl() {
  return (resolveConfiguredAppBaseUrl() || "http://localhost:3004").replace(/\/+$/, "");
}

function resolveConfiguredAppBaseUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  ).trim();
}

function isLiveBillingProviderConfigured() {
  return isMolliePaymentConfigured() && Boolean(resolveConfiguredAppBaseUrl());
}

function buildMollieWebhookUrl(tenantContext: TenantContext) {
  const params = new URLSearchParams({
    tenantId: tenantContext.tenantId,
  });
  const webhookSecret = process.env.MOLLIE_WEBHOOK_SECRET?.trim();

  if (webhookSecret) {
    params.set("secret", webhookSecret);
  }

  return `${resolveAppBaseUrl()}/api/platform/billing/mollie/webhook?${params.toString()}`;
}

function buildBillingRedirectUrl(invoiceId: string) {
  const params = new URLSearchParams({
    invoice: invoiceId,
  });

  return `${resolveAppBaseUrl()}/dashboard/payments?${params.toString()}`;
}

function getMissingLegalCheckoutFields(legal: GymDashboardSnapshot["legal"]) {
  return [
    legal.termsUrl ? null : "voorwaarden",
    legal.privacyUrl ? null : "privacyverklaring",
    legal.sepaCreditorId ? null : "SEPA creditor ID",
    legal.sepaMandateText ? null : "SEPA machtigingstekst",
    legal.contractPdfTemplateKey ? null : "contract-PDF template",
    legal.waiverStorageKey ? null : "waiver-opslag",
  ].filter((field): field is string => Boolean(field));
}

function isLegalCheckoutReady(legal: GymDashboardSnapshot["legal"]) {
  return getMissingLegalCheckoutFields(legal).length === 0;
}

function slugifyDocumentPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";
}

function buildSignedContractDocumentUrl(
  templateKey: string,
  member: GymDashboardSnapshot["members"][number],
  membershipPlan: GymDashboardSnapshot["membershipPlans"][number],
) {
  const normalizedTemplateKey = templateKey.trim().replace(/\/+$/g, "");
  const templateDirectory = normalizedTemplateKey.includes("/")
    ? normalizedTemplateKey.split("/").slice(0, -1).join("/")
    : "contracts";
  const signedDirectory = templateDirectory.replace(/\/templates?$/i, "/signed");

  return `${signedDirectory}/${slugifyDocumentPart(member.fullName)}-${member.id}-${slugifyDocumentPart(membershipPlan.name)}.pdf`;
}

function getMembershipCheckoutAmountCents(
  membershipPlan: GymDashboardSnapshot["membershipPlans"][number],
) {
  return Math.round(
    membershipPlan.priceMonthly * getMembershipBillingCycleMonths(membershipPlan.billingCycle) * 100,
  );
}

function getLiveBillingProvider(
  billing: StoredBillingSettings | null | undefined,
) {
  if (!billing || !billing.enabled) {
    return null;
  }

  if (getBillingConnectionStatus(billing) !== "configured") {
    throw new AppError("Mollie instellingen zijn nog niet compleet.", {
      code: "INVALID_INPUT",
      details: {
        provider: "mollie",
      },
    });
  }

  if (!isMolliePaymentConfigured()) {
    throw new AppError(
      "Mollie live credentials ontbreken. Vul MOLLIE_API_KEY in voordat je betalingen verwerkt.",
      {
        code: "INVALID_INPUT",
        details: {
          provider: "mollie",
          env: "MOLLIE_API_KEY",
        },
      },
    );
  }

  if (!resolveConfiguredAppBaseUrl()) {
    throw new AppError(
      "Mollie webhook-url ontbreekt. Vul APP_BASE_URL met de publieke app-url in voordat je betalingen verwerkt.",
      {
        code: "INVALID_INPUT",
        details: {
          provider: "mollie",
          env: "APP_BASE_URL",
        },
      },
    );
  }

  return createMolliePaymentProvider();
}

function selectBillingPaymentMethod(
  billing: StoredBillingSettings,
  invoiceSource: GymDashboardSnapshot["billingBackoffice"]["invoices"][number]["source"],
) {
  if (invoiceSource === "membership" && billing.paymentMethods.includes("direct_debit")) {
    return "direct_debit" as const;
  }

  if (billing.paymentMethods.includes("payment_request")) {
    return "payment_request" as const;
  }

  return billing.paymentMethods[0] ?? "one_time";
}

async function attachMolliePaymentToInvoice(
  tenantContext: TenantContext,
  billing: StoredBillingSettings,
  invoice: GymDashboardSnapshot["billingBackoffice"]["invoices"][number],
  options?: {
    readonly paymentMethod?: GymDashboardSnapshot["payments"]["paymentMethods"][number];
    readonly description?: string;
    readonly eventLabel?: string;
  },
) {
  const provider = getLiveBillingProvider(billing);

  if (!provider) {
    return {
      invoice,
      intent: null,
    };
  }

  const intent = await provider.createPaymentIntent({
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    description: options?.description ?? invoice.description,
    paymentMethod: options?.paymentMethod ?? selectBillingPaymentMethod(billing, invoice.source),
    redirectUrl: buildBillingRedirectUrl(invoice.id),
    webhookUrl: buildMollieWebhookUrl(tenantContext),
    metadata: {
      tenantId: tenantContext.tenantId,
      invoiceId: invoice.id,
      memberId: invoice.memberId,
      source: invoice.source,
    },
  });
  const updatedInvoice = await updateLocalTenantBillingInvoice(tenantContext.tenantId, {
    id: invoice.id,
    status: "open",
    externalReference: intent.providerPaymentId,
    lastWebhookEventType: options?.eventLabel ?? "payment.created",
  });

  return {
    invoice: updatedInvoice,
    intent,
  };
}

function mapMollieStatusToInvoiceStatus(
  status: string,
): GymDashboardSnapshot["billingBackoffice"]["invoices"][number]["status"] | null {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
    case "canceled":
    case "expired":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      return null;
  }
}

function mapMollieStatusToWebhookStatus(
  status: string,
): GymDashboardSnapshot["billingBackoffice"]["webhooks"][number]["status"] {
  return status === "paid" || status === "refunded" ? "processed" : "received";
}

function mapMollieStatusToEventType(status: string) {
  switch (status) {
    case "paid":
      return "payment.paid";
    case "failed":
    case "canceled":
    case "expired":
      return "payment.failed";
    case "refunded":
      return "payment.refunded";
    default:
      return `payment.${status}`;
  }
}

async function findInvoiceForMolliePayment(
  payment: MolliePaymentStatus,
  tenantId?: string,
) {
  const candidateTenants = tenantId
    ? [await getLocalTenantProfile(tenantId)]
    : await listLocalTenants();

  for (const tenant of candidateTenants) {
    if (!tenant) {
      continue;
    }

    const invoice = tenant.moduleData.billingBackoffice.invoices.find(
      (entry) =>
        entry.externalReference === payment.providerPaymentId ||
        (payment.invoiceId && entry.id === payment.invoiceId),
    );

    if (invoice) {
      return {
        tenant,
        invoice,
      };
    }
  }

  throw new AppError("Factuur niet gevonden voor Mollie betaling.", {
    code: "RESOURCE_NOT_FOUND",
    details: {
      paymentId: payment.providerPaymentId,
      invoiceId: payment.invoiceId,
      tenantId,
    },
  });
}

async function buildBillingSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["payments"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  const billing = tenantProfile?.billing;
  const liveProviderConfigured = isLiveBillingProviderConfigured();

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
    statusLabel: getBillingStatusLabel(billing, { liveProviderConfigured }),
    helpText: getBillingHelpText(billing, { liveProviderConfigured }),
    previewMode: !liveProviderConfigured,
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

async function buildBookingWorkspaceSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["bookingWorkspace"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return tenantProfile?.moduleSettings.booking ?? {
    oneToOneSessionName: "PT intake",
    oneToOneDurationMinutes: 60,
    trialBookingUrl: "",
    defaultCreditPackSize: 10,
    schedulingWindowDays: 14,
  };
}

async function buildRevenueWorkspaceSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["revenueWorkspace"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return tenantProfile?.moduleSettings.revenue ?? {
    webshopCollectionName: "Club essentials",
    pointOfSaleMode: "frontdesk",
    cardTerminalLabel: "Frontdesk terminal",
    autocollectPolicy: "Incasso op de eerste werkdag van de maand",
    directDebitLeadDays: 5,
  };
}

async function buildCoachingWorkspaceSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["coachingWorkspace"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return tenantProfile?.moduleSettings.coaching ?? {
    workoutPlanFocus: "Strength and conditioning blocks",
    nutritionCadence: "weekly",
    videoLibraryUrl: "",
    progressMetric: "Attendance and PR milestones",
    heartRateProvider: "Polar / Myzone",
    aiCoachMode: "Premium coach copilot",
  };
}

async function buildRetentionWorkspaceSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["retentionWorkspace"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return tenantProfile?.moduleSettings.retention ?? {
    retentionCadence: "weekly",
    communityChannel: "WhatsApp community",
    challengeTheme: "8-week consistency streak",
    questionnaireTrigger: "After trial and after 30 days",
    proContentPath: "",
    fitZoneOffer: "Recovery and lifestyle corner",
  };
}

async function buildMobileExperienceSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["mobileExperience"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return tenantProfile?.moduleSettings.mobile ?? {
    appDisplayName: "GymOS Member App",
    onboardingHeadline: "Welcome back to your club",
    supportChannel: "support@gym.test",
    primaryAccent: "#F97316",
    checkInMode: "hybrid",
    whiteLabelDomain: "",
  };
}

async function buildMarketingWorkspaceSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["marketingWorkspace"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return tenantProfile?.moduleSettings.marketing ?? {
    emailSenderName: "Gym team",
    emailReplyTo: "hello@gym.test",
    promotionHeadline: "Nieuwe proefweek live",
    leadPipelineLabel: "Trials naar members",
    automationCadence: "weekly",
  };
}

async function buildIntegrationWorkspaceSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["integrationWorkspace"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return tenantProfile?.moduleSettings.integrations ?? {
    hardwareVendors: ["Nuki", "QR scanners"],
    softwareIntegrations: ["Mollie", "WhatsApp"],
    equipmentIntegrations: [],
    migrationProvider: "Virtuagym / CSV import",
    bodyCompositionProvider: "",
  };
}

async function buildBookingPolicySummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["bookingPolicy"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return (
    tenantProfile?.bookingPolicy ?? {
      cancellationWindowHours: 12,
      lateCancelFeeCents: 1500,
      noShowFeeCents: 2500,
      maxDailyBookingsPerMember: 3,
      maxDailyWaitlistPerMember: 2,
      autoPromoteWaitlist: true,
    }
  );
}

async function buildMemberSignupSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["memberSignups"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return tenantProfile?.moduleData.memberSignups ?? [];
}

async function buildBillingBackofficeSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["billingBackoffice"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return (
    tenantProfile?.moduleData.billingBackoffice ?? {
      invoices: [],
      refunds: [],
      webhooks: [],
      reconciliationRuns: [],
    }
  );
}

async function buildLeadAutomationSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["leadAutomation"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return (
    tenantProfile?.moduleData.leadAutomation ?? {
      tasks: [],
      attributions: [],
      runs: [],
    }
  );
}

async function buildAppointmentSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["appointments"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return tenantProfile?.moduleData.appointments ?? { creditPacks: [], sessions: [] };
}

async function buildCommunitySummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["communityHub"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return (
    tenantProfile?.moduleData.community ?? {
      groups: [],
      challenges: [],
      questionnaires: [],
      responses: [],
    }
  );
}

async function buildMobileSelfServiceSummary(
  tenantContext: TenantContext,
): Promise<GymDashboardSnapshot["mobileSelfService"]> {
  const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
  return (
    tenantProfile?.moduleData.mobileSelfService ?? {
      receipts: [],
      paymentMethodRequests: [],
      pauseRequests: [],
      contracts: [],
    }
  );
}

function isSameUtcDay(left: string, right: string) {
  return left.slice(0, 10) === right.slice(0, 10);
}

function hoursUntil(targetIso: string, fromIso = new Date().toISOString()) {
  return (new Date(targetIso).getTime() - new Date(fromIso).getTime()) / (1000 * 60 * 60);
}

async function featureStates(
  actor: AuthActor,
  tenantContext: TenantContext,
) {
  const evaluator = await createFeatureEvaluatorForTenant(tenantContext.tenantId);

  return evaluator
    .list({ actor, tenantContext })
    .map<FeatureState>((evaluation) => {
      const definition = dashboardFeatureDefinitionMap.get(evaluation.key);

      return {
        key: evaluation.key,
        title: definition?.title ?? evaluation.key,
        categoryKey: definition?.categoryKey ?? "operations",
        categoryTitle: definition?.categoryTitle ?? "Operations",
        dashboardPage: definition?.dashboardPage ?? "overview",
        enabled: evaluation.enabled,
        reason: evaluation.reason,
        description: definition?.description ?? "Geen omschrijving beschikbaar.",
        statusLabel: definition?.statusLabel ?? "Expanded",
        badgeLabel: definition?.badgeLabel,
      };
    });
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

type ReservableTenantAccess = {
  readonly tenant: Awaited<ReturnType<typeof listLocalTenants>>[number];
  readonly member: GymMember;
};

function slimDashboardSnapshotForPage(
  snapshot: GymDashboardSnapshot,
  page?: DashboardPageKey,
): GymDashboardSnapshot {
  if (!page || page === "overview") {
    return snapshot;
  }

  const keepMembers =
    page === "classes" ||
    page === "members" ||
    page === "coaching" ||
    page === "retention" ||
    page === "payments" ||
    page === "mobile" ||
    page === "marketing";
  const keepLocations =
    page === "members" ||
    page === "coaching" ||
    page === "payments" ||
    page === "mobile" ||
    page === "marketing" ||
    page === "settings";
  const keepMembershipPlans =
    page === "members" ||
    page === "contracts" ||
    page === "marketing";
  const keepClassSessions =
    page === "classes" || page === "coaching" || page === "marketing";
  const keepBookings =
    page === "classes" || page === "retention" || page === "marketing";

  return {
    ...snapshot,
    metrics: [],
    locations: keepLocations ? snapshot.locations : [],
    membershipPlans: keepMembershipPlans ? snapshot.membershipPlans : [],
    members: keepMembers ? snapshot.members : [],
    memberPortalAccessMemberIds:
      page === "members" || page === "coaching" || page === "mobile"
        ? snapshot.memberPortalAccessMemberIds
        : [],
    trainers: page === "coaching" ? snapshot.trainers : [],
    classSessions: keepClassSessions ? snapshot.classSessions : [],
    bookings: keepBookings ? snapshot.bookings : [],
    attendance: page === "classes" ? snapshot.attendance : [],
    waivers: page === "members" ? snapshot.waivers : [],
    leads: page === "marketing" ? snapshot.leads : [],
    collectionCases: page === "payments" ? snapshot.collectionCases : [],
    memberSignups: page === "members" ? snapshot.memberSignups : [],
    billingBackoffice:
      page === "payments"
        ? snapshot.billingBackoffice
        : {
            invoices: [],
            refunds: [],
            webhooks: [],
            reconciliationRuns: [],
          },
    leadAutomation:
      page === "marketing"
        ? snapshot.leadAutomation
        : {
            tasks: [],
            attributions: [],
            runs: [],
          },
    appointments:
      page === "coaching"
        ? snapshot.appointments
        : {
            creditPacks: [],
            sessions: [],
          },
    communityHub:
      page === "retention"
        ? snapshot.communityHub
        : {
            groups: [],
            challenges: [],
            questionnaires: [],
            responses: [],
          },
    mobileSelfService:
      page === "mobile"
        ? snapshot.mobileSelfService
        : {
            receipts: [],
            paymentMethodRequests: [],
            pauseRequests: [],
            contracts: [],
          },
    staff: page === "settings" ? snapshot.staff : [],
    auditEntries: page === "access" ? snapshot.auditEntries : [],
    notificationPreview:
      page === "retention" || page === "marketing" ? snapshot.notificationPreview : "",
    waiverUploadPath: page === "members" ? snapshot.waiverUploadPath : "",
    supportedLanguages: page === "mobile" ? snapshot.supportedLanguages : [],
  };
}

export interface GymPlatformServices {
  createRequestTenantContext(actor: AuthActor, tenantId?: string): TenantContext;
  getDashboardSnapshot(
    actor: AuthActor,
    tenantContext: TenantContext,
    options?: {
      readonly page?: DashboardPageKey;
    },
  ): Promise<GymDashboardSnapshot>;
  getPublicReservationSnapshot(input?: {
    readonly tenantSlug?: string;
  }): Promise<PublicReservationSnapshot>;
  getPublicMembershipSignupSnapshot(input?: {
    readonly tenantSlug?: string;
  }): Promise<PublicMembershipSignupSnapshot>;
  submitPublicMemberSignup(input: {
    readonly tenantSlug?: string;
    readonly fullName: string;
    readonly email: string;
    readonly phone: string;
    readonly phoneCountry: CreateMemberInput["phoneCountry"];
    readonly membershipPlanId: string;
    readonly preferredLocationId: string;
    readonly paymentMethod: GymDashboardSnapshot["memberSignups"][number]["paymentMethod"];
    readonly contractAccepted: boolean;
    readonly waiverAccepted: boolean;
    readonly portalPassword: string;
    readonly notes?: string;
  }): Promise<PublicMembershipSignupResult>;
  getMemberReservationSnapshot(
    actor: AuthActor,
    input?: {
      readonly tenantSlug?: string;
    },
  ): Promise<MemberReservationSnapshot>;
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
  createLead(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly fullName: string;
      readonly email: string;
      readonly phone: string;
      readonly source: GymDashboardSnapshot["leads"][number]["source"];
      readonly stage: GymDashboardSnapshot["leads"][number]["stage"];
      readonly interest: string;
      readonly notes?: string;
      readonly assignedStaffName?: string;
      readonly expectedValueCents?: number;
    },
  ): Promise<GymDashboardSnapshot["leads"][number]>;
  updateLead(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly id: string;
      readonly stage: GymDashboardSnapshot["leads"][number]["stage"];
      readonly notes?: string;
      readonly assignedStaffName?: string;
    },
  ): Promise<GymDashboardSnapshot["leads"][number]>;
  convertLeadToMember(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly leadId: string;
      readonly membershipPlanId: string;
      readonly homeLocationId: string;
      readonly status: CreateMemberInput["status"];
      readonly tags: ReadonlyArray<string>;
      readonly waiverStatus: CreateMemberInput["waiverStatus"];
      readonly portalPassword?: string;
    },
  ): Promise<{
    readonly lead: GymDashboardSnapshot["leads"][number];
    readonly member: GymDashboardSnapshot["members"][number];
  }>;
  createCollectionCase(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly memberId?: string;
      readonly memberName: string;
      readonly paymentMethod: GymDashboardSnapshot["collectionCases"][number]["paymentMethod"];
      readonly status: GymDashboardSnapshot["collectionCases"][number]["status"];
      readonly amountCents: number;
      readonly reason: string;
      readonly dueAt: string;
      readonly notes?: string;
    },
  ): Promise<GymDashboardSnapshot["collectionCases"][number]>;
  updateCollectionCase(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly id: string;
      readonly status: GymDashboardSnapshot["collectionCases"][number]["status"];
      readonly notes?: string;
    },
  ): Promise<GymDashboardSnapshot["collectionCases"][number]>;
  reviewMemberSignupRequest(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly signupRequestId: string;
      readonly decision: "approved" | "rejected";
      readonly ownerNotes?: string;
      readonly memberStatus: CreateMemberInput["status"];
      readonly portalPassword?: string;
    },
  ): Promise<{
    readonly signup: GymDashboardSnapshot["memberSignups"][number];
    readonly member?: GymDashboardSnapshot["members"][number];
  }>;
  createBillingInvoice(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly memberId?: string;
      readonly memberName: string;
      readonly description: string;
      readonly amountCents: number;
      readonly dueAt: string;
      readonly source: GymDashboardSnapshot["billingBackoffice"]["invoices"][number]["source"];
      readonly currency?: string;
    },
  ): Promise<GymDashboardSnapshot["billingBackoffice"]["invoices"][number]>;
  retryBillingInvoice(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly invoiceId: string;
      readonly reason: string;
    },
  ): Promise<GymDashboardSnapshot["billingBackoffice"]["invoices"][number]>;
  refundBillingInvoice(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly invoiceId: string;
      readonly amountCents: number;
      readonly reason: string;
    },
  ): Promise<GymDashboardSnapshot["billingBackoffice"]["refunds"][number]>;
  recordBillingWebhook(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly invoiceId: string;
      readonly eventType: string;
      readonly status: GymDashboardSnapshot["billingBackoffice"]["webhooks"][number]["status"];
      readonly providerReference: string;
      readonly payloadSummary: string;
    },
  ): Promise<GymDashboardSnapshot["billingBackoffice"]["webhooks"][number]>;
  syncMollieBillingWebhook(input: {
    readonly tenantId?: string;
    readonly paymentId: string;
  }): Promise<GymDashboardSnapshot["billingBackoffice"]["webhooks"][number]>;
  reconcileBillingLedger(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly note?: string;
    },
  ): Promise<GymDashboardSnapshot["billingBackoffice"]["reconciliationRuns"][number]>;
  runLeadAutomations(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly trigger: GymDashboardSnapshot["leadAutomation"]["runs"][number]["trigger"];
    },
  ): Promise<GymDashboardSnapshot["leadAutomation"]["runs"][number]>;
  createAppointmentPack(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly memberId: string;
      readonly memberName: string;
      readonly trainerId: string;
      readonly title: string;
      readonly totalCredits: number;
      readonly validUntil: string;
    },
  ): Promise<GymDashboardSnapshot["appointments"]["creditPacks"][number]>;
  createCoachAppointments(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly trainerId: string;
      readonly memberId?: string;
      readonly memberName?: string;
      readonly locationId: string;
      readonly startsAt: string;
      readonly durationMinutes: number;
      readonly recurrence: GymDashboardSnapshot["appointments"]["sessions"][number]["recurrence"];
      readonly occurrences: number;
      readonly creditPackId?: string;
      readonly notes?: string;
    },
  ): Promise<{
    readonly appointments: ReadonlyArray<GymDashboardSnapshot["appointments"]["sessions"][number]>;
    readonly pack?: GymDashboardSnapshot["appointments"]["creditPacks"][number];
  }>;
  createCommunityGroup(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly name: string;
      readonly channel: string;
      readonly description: string;
      readonly memberIds: ReadonlyArray<string>;
    },
  ): Promise<GymDashboardSnapshot["communityHub"]["groups"][number]>;
  createMemberChallenge(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly title: string;
      readonly rewardLabel: string;
      readonly startsAt: string;
      readonly endsAt: string;
      readonly participantMemberIds: ReadonlyArray<string>;
    },
  ): Promise<GymDashboardSnapshot["communityHub"]["challenges"][number]>;
  createQuestionnaire(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly title: string;
      readonly trigger: string;
      readonly questions: ReadonlyArray<string>;
    },
  ): Promise<GymDashboardSnapshot["communityHub"]["questionnaires"][number]>;
  submitQuestionnaireResponse(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly questionnaireId: string;
      readonly memberId: string;
      readonly memberName: string;
      readonly answers: ReadonlyArray<string>;
    },
  ): Promise<GymDashboardSnapshot["communityHub"]["responses"][number]>;
  requestMobilePaymentMethodUpdate(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly memberId: string;
      readonly memberName: string;
      readonly requestedMethodLabel: string;
      readonly note?: string;
    },
  ): Promise<GymDashboardSnapshot["mobileSelfService"]["paymentMethodRequests"][number]>;
  reviewMobilePaymentMethodUpdate(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly requestId: string;
      readonly decision: "approved" | "rejected";
      readonly ownerNotes?: string;
    },
  ): Promise<GymDashboardSnapshot["mobileSelfService"]["paymentMethodRequests"][number]>;
  requestMembershipPause(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly memberId: string;
      readonly memberName: string;
      readonly startsAt: string;
      readonly endsAt: string;
      readonly reason: string;
    },
  ): Promise<GymDashboardSnapshot["mobileSelfService"]["pauseRequests"][number]>;
  reviewMembershipPause(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly requestId: string;
      readonly decision: "approved" | "rejected";
      readonly ownerNotes?: string;
    },
  ): Promise<{
    readonly request: GymDashboardSnapshot["mobileSelfService"]["pauseRequests"][number];
    readonly member?: GymDashboardSnapshot["members"][number];
  }>;
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
    input: CreateMemberInput & {
      readonly portalPassword?: string;
    },
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
  setMemberPortalPassword(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly memberId: string;
      readonly password: string;
    },
  ): Promise<{
    readonly memberId: string;
    readonly email: string;
    readonly status: "active";
  }>;
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
  updateBookingWorkspace(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: Omit<GymDashboardSnapshot["bookingWorkspace"], "lastUpdatedAt">,
  ): Promise<GymDashboardSnapshot["bookingWorkspace"]>;
  updateBookingPolicy(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: Omit<GymDashboardSnapshot["bookingPolicy"], "lastUpdatedAt">,
  ): Promise<GymDashboardSnapshot["bookingPolicy"]>;
  updateRevenueWorkspace(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: Omit<GymDashboardSnapshot["revenueWorkspace"], "lastUpdatedAt">,
  ): Promise<GymDashboardSnapshot["revenueWorkspace"]>;
  updateCoachingWorkspace(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: Omit<GymDashboardSnapshot["coachingWorkspace"], "lastUpdatedAt">,
  ): Promise<GymDashboardSnapshot["coachingWorkspace"]>;
  updateRetentionWorkspace(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: Omit<GymDashboardSnapshot["retentionWorkspace"], "lastUpdatedAt">,
  ): Promise<GymDashboardSnapshot["retentionWorkspace"]>;
  updateMobileExperience(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: Omit<GymDashboardSnapshot["mobileExperience"], "lastUpdatedAt">,
  ): Promise<GymDashboardSnapshot["mobileExperience"]>;
  updateMarketingWorkspace(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: Omit<GymDashboardSnapshot["marketingWorkspace"], "lastUpdatedAt">,
  ): Promise<GymDashboardSnapshot["marketingWorkspace"]>;
  updateIntegrationWorkspace(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: Omit<GymDashboardSnapshot["integrationWorkspace"], "lastUpdatedAt">,
  ): Promise<GymDashboardSnapshot["integrationWorkspace"]>;
  updateFeatureFlag(
    actor: AuthActor,
    tenantContext: TenantContext,
    input: {
      readonly key: string;
      readonly enabled: boolean;
    },
  ): Promise<FeatureState>;
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
  createMemberReservation(
    actor: AuthActor,
    input: {
      readonly tenantSlug?: string;
      readonly classSessionId: string;
      readonly notes?: string;
    },
  ): Promise<{
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
    member: Pick<GymMember, "id" | "fullName" | "phone" | "phoneCountry">,
    classSession: Awaited<ReturnType<GymStore["getClassSession"]>> extends infer T ? T : never,
  ) {
    const groupBookingFeature = await assertFeatureEnabled(
      actor,
      tenantContext,
      "booking.group_classes",
    );
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

    const bookingPolicy = await buildBookingPolicySummary(tenantContext);
    const [existingBookings, allClassSessions] = await Promise.all([
      runtime.store.listBookings(tenantContext),
      runtime.store.listClassSessions(tenantContext),
    ]);
    const sessionById = new Map(allClassSessions.map((session) => [session.id, session] as const));
    const sameDayBookings = existingBookings.filter((booking) => {
      if (booking.memberId !== member.id || booking.status === "cancelled") {
        return false;
      }

      const bookingSession =
        booking.classSessionId === classSession.id
          ? classSession
          : sessionById.get(booking.classSessionId);

      return bookingSession ? isSameUtcDay(bookingSession.startsAt, classSession.startsAt) : false;
    });
    const dailyConfirmedBookings = sameDayBookings.filter(
      (booking) => booking.status !== "waitlisted",
    ).length;
    const dailyWaitlistBookings = sameDayBookings.filter(
      (booking) => booking.status === "waitlisted",
    ).length;
    const willWaitlist = classSession.bookedCount >= classSession.capacity;

    if (!willWaitlist && dailyConfirmedBookings >= bookingPolicy.maxDailyBookingsPerMember) {
      throw new AppError("Deze member heeft de daglimiet voor boekingen bereikt.", {
        code: "FORBIDDEN",
        details: { limit: bookingPolicy.maxDailyBookingsPerMember },
      });
    }

    if (willWaitlist && dailyWaitlistBookings >= bookingPolicy.maxDailyWaitlistPerMember) {
      throw new AppError("Deze member heeft de daglimiet voor wachtlijstboekingen bereikt.", {
        code: "FORBIDDEN",
        details: { limit: bookingPolicy.maxDailyWaitlistPerMember },
      });
    }

    if (
      classSession.bookedCount >= classSession.capacity &&
      !groupBookingFeature.enabled
    ) {
      throw new AppError("Waitlist is uitgeschakeld voor deze tenant.", {
        code: "FORBIDDEN",
        details: { feature: groupBookingFeature.key },
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

  async function listMemberPortalAccessMemberIds(tenantId: string) {
    const accounts = await listLocalPlatformAccounts(tenantId);
    return accounts
      .filter(
        (account) =>
          account.roleKey === "member" &&
          account.status === "active" &&
          Boolean(account.linkedMemberId),
      )
      .map((account) => account.linkedMemberId!)
      .sort();
  }

  function isReservableMemberStatus(status: GymMember["status"]) {
    return status === "active" || status === "trial";
  }

  async function listReservableTenantAccess(actor: AuthActor) {
    if (!actor.email) {
      return [] satisfies ReadonlyArray<ReservableTenantAccess>;
    }

    const [accounts, tenants] = await Promise.all([
      listLocalMemberPortalAccountsByEmail(actor.email),
      listLocalTenants(),
    ]);

    if (accounts.length === 0) {
      return [] satisfies ReadonlyArray<ReservableTenantAccess>;
    }

    const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant] as const));
    const memberships = await Promise.all(
      accounts.map(async (account) => {
        const tenant = tenantById.get(account.tenantId);

        if (!tenant || !account.linkedMemberId) {
          return null;
        }

        const tenantContext = createPublicTenantContext(tenant.id);
        const matchingMember = await runtime.store.getMember(
          tenantContext,
          account.linkedMemberId,
        );

        if (!matchingMember || !isReservableMemberStatus(matchingMember.status)) {
          return null;
        }

        return {
          tenant,
          member: matchingMember,
        };
      }),
    );

    return memberships
      .filter(
        (membership): membership is NonNullable<(typeof memberships)[number]> =>
          membership !== null,
      )
      .sort((left, right) => left.tenant.name.localeCompare(right.tenant.name));
  }

  async function resolveReservableTenantSelection(
    actor: AuthActor,
    tenantSlug?: string,
  ) {
    const memberships = await listReservableTenantAccess(actor);
    const requestedTenant = tenantSlug
      ? await getLocalTenantProfileBySlug(tenantSlug)
      : null;
    const selectedMembership = requestedTenant
      ? memberships.find((membership) => membership.tenant.id === requestedTenant.id) ?? null
      : memberships.length === 1
        ? memberships[0] ?? null
        : null;

    return {
      memberships,
      selectedMembership,
    };
  }

  async function resolveSelfServiceMemberAccess(
    actor: AuthActor,
    tenantContext: TenantContext,
    memberId: string,
  ) {
    const member = await runtime.store.getMember(tenantContext, memberId);

    if (!member) {
      throw new AppError("Lid voor self-service kon niet gevonden worden.", {
        code: "RESOURCE_NOT_FOUND",
      });
    }

    if (runtime.permissionRegistry.hasPermissions(actor, ["operations.manage"], tenantContext)) {
      return member;
    }

    const tenantMembership = getTenantMembership(actor, tenantContext.tenantId);
    const memberRole = getMembershipRole("member");

    if (!tenantMembership?.roles.includes(memberRole)) {
      throw new AppError("De huidige rol mist permissies voor deze actie.", {
        code: "FORBIDDEN",
      });
    }

    if (!actor.email || normalizeEmailValue(actor.email) !== normalizeEmailValue(member.email)) {
      throw new AppError("Je kunt alleen self-service aanvragen voor je eigen lidprofiel.", {
        code: "FORBIDDEN",
      });
    }

    if (!isReservableMemberStatus(member.status)) {
      throw new AppError("Self-service is alleen beschikbaar voor actieve of trial leden.", {
        code: "FORBIDDEN",
      });
    }

    return member;
  }

  async function buildMemberReservationSnapshot(
    actor: AuthActor,
    input?: { readonly tenantSlug?: string },
  ) {
    const { memberships, selectedMembership } = await resolveReservableTenantSelection(
      actor,
      input?.tenantSlug,
    );
    const baseMember = selectedMembership?.member ?? memberships[0]?.member ?? null;

    if (!selectedMembership) {
      return toClientPlain({
        tenantName: memberships.length > 1 ? "Kies je club" : "Ledenreserveringen",
        tenantSlug: null,
        availableClubs: memberships.map((membership) => ({
          id: membership.tenant.id,
          slug: membership.tenant.id,
          name: membership.tenant.name,
        })),
        classSessions: [],
        memberDisplayName:
          baseMember?.fullName || actor.displayName || actor.email || "Account",
        memberEmail: baseMember?.email || actor.email || "",
        hasEligibleMembership: memberships.length > 0,
        selfService: {
          receipts: [],
          paymentMethodRequests: [],
          pauseRequests: [],
          contracts: [],
        },
      } satisfies MemberReservationSnapshot);
    }

    const tenantContext = createPublicTenantContext(selectedMembership.tenant.id);
    const [locations, trainers, classSessions, mobileSelfService] = await Promise.all([
      runtime.store.listLocations(tenantContext),
      runtime.store.listTrainers(tenantContext),
      runtime.store.listClassSessions(tenantContext),
      buildMobileSelfServiceSummary(tenantContext),
    ]);

    const locationById = new Map(
      locations.map((location) => [location.id, location] as const),
    );
    const trainerById = new Map(
      trainers.map((trainer) => [trainer.id, trainer] as const),
    );

    return toClientPlain({
      tenantName: selectedMembership.tenant.name,
      tenantSlug: selectedMembership.tenant.id,
      availableClubs: memberships.map((membership) => ({
        id: membership.tenant.id,
        slug: membership.tenant.id,
        name: membership.tenant.name,
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
      memberDisplayName:
        selectedMembership.member.fullName ||
        actor.displayName ||
        actor.email ||
        "Lid",
      memberEmail: selectedMembership.member.email || actor.email || "",
      hasEligibleMembership: true,
      selfService: {
        receipts: mobileSelfService.receipts.filter(
          (receipt) => receipt.memberId === selectedMembership.member.id,
        ),
        paymentMethodRequests: mobileSelfService.paymentMethodRequests.filter(
          (request) => request.memberId === selectedMembership.member.id,
        ),
        pauseRequests: mobileSelfService.pauseRequests.filter(
          (request) => request.memberId === selectedMembership.member.id,
        ),
        contracts: mobileSelfService.contracts.filter(
          (contract) => contract.memberId === selectedMembership.member.id,
        ),
      },
    } satisfies MemberReservationSnapshot);
  }

  async function ensureMemberContractRecord(
    tenantContext: TenantContext,
    member: GymDashboardSnapshot["members"][number],
  ) {
    const [membershipPlans, legal] = await Promise.all([
      runtime.store.listMembershipPlans(tenantContext),
      buildLegalComplianceSummary(tenantContext),
    ]);
    const plan = membershipPlans.find((entry) => entry.id === member.membershipPlanId);

    if (!plan) {
      return null;
    }

    return createLocalTenantContractRecord(tenantContext.tenantId, {
      memberId: member.id,
      memberName: member.fullName,
      membershipPlanId: plan.id,
      contractName: plan.name,
      documentLabel: `${plan.name} contract`,
      documentUrl:
        (legal.contractPdfTemplateKey
          ? buildSignedContractDocumentUrl(legal.contractPdfTemplateKey, member, plan)
          : "") ||
        legal.termsUrl ||
        `https://contracts.${tenantContext.tenantId}/${plan.id}.pdf`,
      status: "active",
      signedAt: member.joinedAt,
    });
  }

  async function loadSignupCheckoutPrerequisites(
    tenantContext: TenantContext,
    paymentMethod: GymDashboardSnapshot["memberSignups"][number]["paymentMethod"],
  ) {
    const [tenantProfile, legal] = await Promise.all([
      getLocalTenantProfile(tenantContext.tenantId),
      buildLegalComplianceSummary(tenantContext),
    ]);
    const billing = tenantProfile?.billing;

    if (!billing || !isBillingReady(billing)) {
      throw new AppError(
        "Checkout is nog niet live. Koppel en activeer Mollie voordat consumenten zichzelf kunnen inschrijven.",
        {
          code: "FORBIDDEN",
        },
      );
    }

    if (!billing.paymentMethods.includes(paymentMethod)) {
      throw new AppError("Deze betaalmethode is nog niet geactiveerd voor self-signup.", {
        code: "FORBIDDEN",
        details: { paymentMethod },
      });
    }

    getLiveBillingProvider(billing);

    const missingLegalFields = getMissingLegalCheckoutFields(legal);
    if (missingLegalFields.length > 0) {
      throw new AppError(
        `Self-signup mist juridische inrichting: ${missingLegalFields.join(", ")}.`,
        {
          code: "INVALID_INPUT",
          details: { missingLegalFields },
        },
      );
    }

    return { billing, legal };
  }

  async function completeMemberSignupCheckout(input: {
    readonly tenantContext: TenantContext;
    readonly signup: GymDashboardSnapshot["memberSignups"][number];
    readonly membershipPlan: GymDashboardSnapshot["membershipPlans"][number];
    readonly location: GymDashboardSnapshot["locations"][number];
    readonly memberStatus: CreateMemberInput["status"];
    readonly portalPassword?: string;
    readonly ownerNotes?: string;
    readonly actorId: string;
    readonly prerequisites?: Awaited<ReturnType<typeof loadSignupCheckoutPrerequisites>>;
  }): Promise<PublicMembershipSignupResult> {
    const prerequisites =
      input.prerequisites ??
      (await loadSignupCheckoutPrerequisites(
        input.tenantContext,
        input.signup.paymentMethod,
      ));
    const member = await runtime.store.createMember(input.tenantContext, {
      fullName: input.signup.fullName,
      email: input.signup.email,
      phone: input.signup.phone,
      phoneCountry: input.signup.phoneCountry,
      membershipPlanId: input.membershipPlan.id,
      homeLocationId: input.location.id,
      status: input.memberStatus,
      tags: ["self-signup"],
      waiverStatus: "complete",
      waiverStorageKey: prerequisites.legal.waiverStorageKey,
    });

    if (input.portalPassword?.trim()) {
      await upsertLocalMemberPortalAccount(input.tenantContext.tenantId, {
        memberId: member.id,
        displayName: member.fullName,
        email: member.email,
        password: input.portalPassword.trim(),
      });
    }

    const approvedSignup = await reviewLocalTenantMemberSignup(input.tenantContext.tenantId, {
      id: input.signup.id,
      status: "approved",
      ownerNotes: input.ownerNotes,
      approvedMemberId: member.id,
    });
    const invoice = await createLocalTenantBillingInvoice(input.tenantContext.tenantId, {
      memberId: member.id,
      memberName: member.fullName,
      description: `Membership checkout · ${input.membershipPlan.name}`,
      amountCents: getMembershipCheckoutAmountCents(input.membershipPlan),
      dueAt: new Date().toISOString(),
      source: "signup_checkout",
      externalReference: input.signup.id,
    });
    const { invoice: processedInvoice, intent } = await attachMolliePaymentToInvoice(
      input.tenantContext,
      prerequisites.billing,
      invoice,
      {
        paymentMethod: input.signup.paymentMethod,
        description: `Membership checkout · ${input.membershipPlan.name}`,
        eventLabel: "payment.signup_checkout_created",
      },
    );

    if (!intent) {
      throw new AppError("Mollie kon geen checkout aanmaken voor deze inschrijving.", {
        code: "INVALID_INPUT",
      });
    }

    const contract = await ensureMemberContractRecord(input.tenantContext, member);
    await runtime.auditLogger.write({
      action: "member_signup.checkout_created",
      category: "members",
      actorId: input.actorId,
      tenantId: input.tenantContext.tenantId,
      metadata: {
        signupRequestId: input.signup.id,
        memberId: member.id,
        invoiceId: processedInvoice.id,
        providerPaymentId: intent.providerPaymentId,
      },
    });

    return toClientPlain({
      signup: approvedSignup,
      member,
      invoice: processedInvoice,
      contract,
      checkoutUrl: intent.checkoutUrl,
      providerPaymentId: intent.providerPaymentId,
      providerStatus: intent.status,
    } satisfies PublicMembershipSignupResult);
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
    async getDashboardSnapshot(actor, tenantContext, options) {
      assertAccess(runtime, actor, tenantContext, ["dashboard.read"]);
      const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);

      const cache = createTenantAwareCache(runtime, tenantContext);
      const cached = await cache.getJson<GymDashboardSnapshot>(
        "dashboard",
        actor.subjectId,
      );

      if (cached) {
        return slimDashboardSnapshotForPage(cached, options?.page);
      }

      const [
        locations,
        membershipPlans,
        members,
        memberPortalAccessMemberIds,
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
        listMemberPortalAccessMemberIds(tenantContext.tenantId),
        runtime.store.listTrainers(tenantContext),
        runtime.store.listClassSessions(tenantContext),
        runtime.store.listBookings(tenantContext),
        runtime.store.listAttendance(tenantContext),
        runtime.store.listWaivers(tenantContext),
        runtime.auditLogger.list({ tenantId: tenantContext.tenantId }),
        runtime.healthRegistry.run({ tenantContext }),
        buildStaffSummaries(runtime, tenantContext),
      ]);
      const [
        remoteAccess,
        payments,
        legal,
        bookingWorkspace,
        bookingPolicy,
        memberSignups,
        billingBackoffice,
        leadAutomation,
        appointments,
        communityHub,
        mobileSelfService,
        revenueWorkspace,
        coachingWorkspace,
        retentionWorkspace,
        mobileExperience,
        marketingWorkspace,
        integrationWorkspace,
      ] = await Promise.all([
        buildRemoteAccessSummary(tenantContext, locations),
        buildBillingSummary(tenantContext),
        buildLegalComplianceSummary(tenantContext),
        buildBookingWorkspaceSummary(tenantContext),
        buildBookingPolicySummary(tenantContext),
        buildMemberSignupSummary(tenantContext),
        buildBillingBackofficeSummary(tenantContext),
        buildLeadAutomationSummary(tenantContext),
        buildAppointmentSummary(tenantContext),
        buildCommunitySummary(tenantContext),
        buildMobileSelfServiceSummary(tenantContext),
        buildRevenueWorkspaceSummary(tenantContext),
        buildCoachingWorkspaceSummary(tenantContext),
        buildRetentionWorkspaceSummary(tenantContext),
        buildMobileExperienceSummary(tenantContext),
        buildMarketingWorkspaceSummary(tenantContext),
        buildIntegrationWorkspaceSummary(tenantContext),
      ]);

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

      const waiverUploadPath =
        runtime.storageMode === "spaces"
          ? runtime.storagePathFactory.createTenantPath(
              tenantContext,
              {
                domain: "waivers",
                entityId: members[0]?.id ?? "member",
                fileName: "signed-liability-waiver.pdf",
              },
            )
          : "";

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
          canManageFeatureFlags: runtime.permissionRegistry.hasPermissions(
            actor,
            ["settings.manage"],
            tenantContext,
          ),
        },
        remoteAccess,
        payments,
        legal,
        bookingWorkspace,
        bookingPolicy,
        memberSignups,
        billingBackoffice,
        leadAutomation,
        appointments,
        communityHub,
        mobileSelfService,
        revenueWorkspace,
        coachingWorkspace,
        retentionWorkspace,
        mobileExperience,
        marketingWorkspace,
        integrationWorkspace,
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
        featureFlags: await featureStates(actor, tenantContext),
        locations,
        membershipPlans,
        members,
        memberPortalAccessMemberIds,
        trainers,
        classSessions,
        bookings,
        attendance,
        waivers,
        leads: tenantProfile?.leads ?? [],
        collectionCases: tenantProfile?.collectionCases ?? [],
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

      return slimDashboardSnapshotForPage(serializedSnapshot, options?.page);
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
    async getPublicMembershipSignupSnapshot(input) {
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
          membershipPlans: [],
          locations: [],
          legal: {
            termsUrl: "",
            privacyUrl: "",
            sepaMandateText: "",
            contractPdfTemplateKey: "",
            waiverStorageKey: "",
          },
          legalReady: false,
          billingReady: false,
        } satisfies PublicMembershipSignupSnapshot);
      }

      const tenantContext = createPublicTenantContext(tenantProfile.id);
      const [locations, plans, legal, payments] = await Promise.all([
        runtime.store.listLocations(tenantContext),
        runtime.store.listMembershipPlans(tenantContext),
        buildLegalComplianceSummary(tenantContext),
        buildBillingSummary(tenantContext),
      ]);

      return toClientPlain({
        tenantName: tenantProfile.name,
        tenantSlug: tenantProfile.id,
        availableGyms: tenants.map((tenant) => ({
          id: tenant.id,
          slug: tenant.id,
          name: tenant.name,
        })),
        membershipPlans: plans
          .filter((plan) => plan.status === "active")
          .map((plan) => ({
            id: plan.id,
            name: plan.name,
            priceMonthly: plan.priceMonthly,
            billingCycle: plan.billingCycle,
          })),
        locations: locations
          .filter((location) => location.status === "active")
          .map((location) => ({
            id: location.id,
            name: location.name,
            city: location.city,
          })),
        legal: {
          termsUrl: legal.termsUrl,
          privacyUrl: legal.privacyUrl,
          sepaMandateText: legal.sepaMandateText,
          contractPdfTemplateKey: legal.contractPdfTemplateKey,
          waiverStorageKey: legal.waiverStorageKey,
        },
        legalReady: isLegalCheckoutReady(legal),
        billingReady:
          payments.enabled &&
          payments.connectionStatus === "configured" &&
          !payments.previewMode,
      } satisfies PublicMembershipSignupSnapshot);
    },
    async submitPublicMemberSignup(input) {
      const tenantProfile = input.tenantSlug
        ? await getLocalTenantProfileBySlug(input.tenantSlug)
        : (await listLocalTenants())[0] ?? null;

      if (!tenantProfile) {
        throw new AppError("Sportschool niet gevonden voor aanmelding.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      if (!input.contractAccepted || !input.waiverAccepted) {
        throw new AppError("Contract en waiver moeten akkoord zijn voordat iemand zich aanmeldt.", {
          code: "INVALID_INPUT",
        });
      }

      const tenantContext = createPublicTenantContext(tenantProfile.id);
      const publicActor = createFeatureGateActor(
        tenantProfile.id,
        `public-signup:${normalizeEmailValue(input.email)}`,
      );
      await assertFeatureEnabled(publicActor, tenantContext, "membership.management");
      await assertBillingPaymentMethodEnabled(publicActor, tenantContext, input.paymentMethod);
      const [locations, membershipPlans] = await Promise.all([
        runtime.store.listLocations(tenantContext),
        runtime.store.listMembershipPlans(tenantContext),
      ]);
      const normalizedPhone = normalizePhoneForStorage(input.phone, input.phoneCountry);
      const rateLimitResult = runtime.rateLimiter.consume({
        key: buildRateLimitKey({
          scope: "member_signups.create",
          identifier: `${tenantProfile.id}:${normalizeEmailValue(input.email)}`,
          fallbackIdentifier: normalizedPhone,
        }),
        windowMs: 15 * 60_000,
        maxRequests: 4,
      });

      if (!rateLimitResult.allowed) {
        throw new AppError("Te veel aanmeldverzoeken in korte tijd.", {
          code: "RATE_LIMIT_EXCEEDED",
          details: rateLimitResult,
        });
      }

      const activeLocation = locations.find(
        (location) =>
          location.id === input.preferredLocationId && location.status === "active",
      );
      const activeMembershipPlan = membershipPlans.find(
        (plan) => plan.id === input.membershipPlanId && plan.status === "active",
      );

      if (!activeLocation) {
        throw new AppError("Vestiging voor de aanmelding is niet actief of bestaat niet.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      if (!activeMembershipPlan) {
        throw new AppError("Contract voor de aanmelding is niet actief of bestaat niet.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      const prerequisites = await loadSignupCheckoutPrerequisites(
        tenantContext,
        input.paymentMethod,
      );
      const signup = await createLocalTenantMemberSignup(tenantContext.tenantId, {
        fullName: input.fullName,
        email: input.email,
        phone: normalizedPhone,
        phoneCountry: input.phoneCountry,
        membershipPlanId: input.membershipPlanId,
        preferredLocationId: input.preferredLocationId,
        paymentMethod: input.paymentMethod,
        contractAcceptedAt: new Date().toISOString(),
        waiverAcceptedAt: new Date().toISOString(),
        notes: input.notes,
      });

      return completeMemberSignupCheckout({
        tenantContext,
        signup,
        membershipPlan: activeMembershipPlan,
        location: activeLocation,
        memberStatus: "trial",
        portalPassword: input.portalPassword,
        actorId: `public:${normalizeEmailValue(input.email)}`,
        prerequisites,
      });
    },
    async getMemberReservationSnapshot(actor, input) {
      return buildMemberReservationSnapshot(actor, input);
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
    async createLead(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "marketing.leads");
      const lead = await createLocalTenantLead(tenantContext.tenantId, input);
      await createLocalTenantLeadAttribution(tenantContext.tenantId, {
        leadId: lead.id,
        source: lead.source,
        campaignLabel: input.interest || "General inbound",
        medium: lead.source === "walk_in" ? "offline" : "digital",
      });
      await createLocalTenantLeadTask(tenantContext.tenantId, {
        type: "nurture",
        title: `Volg ${lead.fullName} op`,
        dueAt: new Date().toISOString(),
        source: lead.source,
        leadId: lead.id,
        notes: lead.notes,
        assignedStaffName: lead.assignedStaffName,
      });
      await runtime.auditLogger.write({
        action: "lead.created",
        category: "marketing",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { leadId: lead.id, source: lead.source, stage: lead.stage },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return lead;
    },
    async updateLead(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "marketing.leads");
      const lead = await updateLocalTenantLead(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "lead.updated",
        category: "marketing",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { leadId: lead.id, stage: lead.stage },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return lead;
    },
    async convertLeadToMember(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "marketing.leads");
      await assertFeatureEnabled(actor, tenantContext, "membership.management");
      const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
      const lead = tenantProfile?.leads.find((entry) => entry.id === input.leadId);

      if (!lead) {
        throw new AppError("Lead kon niet gevonden worden.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      const [membershipPlan, location] = await Promise.all([
        runtime.store
          .listMembershipPlans(tenantContext)
          .then((plans) => plans.find((entry) => entry.id === input.membershipPlanId) ?? null),
        runtime.store
          .listLocations(tenantContext)
          .then((locations) => locations.find((entry) => entry.id === input.homeLocationId) ?? null),
      ]);

      if (!membershipPlan || !location) {
        throw new AppError("Contract of vestiging voor leadconversie ontbreekt.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      const member = await runtime.store.createMember(tenantContext, {
        fullName: lead.fullName,
        email: lead.email,
        phone: normalizePhoneForStorage(lead.phone, "NL"),
        phoneCountry: "NL",
        membershipPlanId: membershipPlan.id,
        homeLocationId: location.id,
        status: input.status,
        tags: [...input.tags],
        waiverStatus: input.waiverStatus,
      });

      if (input.portalPassword?.trim()) {
        await upsertLocalMemberPortalAccount(tenantContext.tenantId, {
          memberId: member.id,
          displayName: member.fullName,
          email: member.email,
          password: input.portalPassword.trim(),
        });
      }
      await ensureMemberContractRecord(tenantContext, member);

      const updatedLead = await updateLocalTenantLead(tenantContext.tenantId, {
        id: lead.id,
        stage: "won",
        notes: lead.notes,
        assignedStaffName: lead.assignedStaffName,
        convertedMemberId: member.id,
      });

      await runtime.auditLogger.write({
        action: "lead.converted",
        category: "marketing",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { leadId: lead.id, memberId: member.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);

      return {
        lead: updatedLead,
        member,
      };
    },
    async createCollectionCase(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "billing.processing");
      await assertFeatureEnabled(actor, tenantContext, "billing.autocollect");
      await assertCollectionCasePaymentMethodEnabled(actor, tenantContext, input.paymentMethod);
      const collectionCase = await createLocalTenantCollectionCase(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "collection_case.created",
        category: "billing",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          collectionCaseId: collectionCase.id,
          amountCents: collectionCase.amountCents,
          status: collectionCase.status,
        },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return collectionCase;
    },
    async updateCollectionCase(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "billing.processing");
      await assertFeatureEnabled(actor, tenantContext, "billing.autocollect");
      const collectionCase = await updateLocalTenantCollectionCase(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "collection_case.updated",
        category: "billing",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          collectionCaseId: collectionCase.id,
          status: collectionCase.status,
        },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return collectionCase;
    },
    async reviewMemberSignupRequest(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "membership.management");
      const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
      const signup = tenantProfile?.moduleData.memberSignups.find(
        (entry) => entry.id === input.signupRequestId,
      );

      if (!signup) {
        throw new AppError("Member signup niet gevonden.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      if (input.decision === "rejected") {
        const rejectedSignup = await reviewLocalTenantMemberSignup(tenantContext.tenantId, {
          id: signup.id,
          status: "rejected",
          ownerNotes: input.ownerNotes,
        });
        await runtime.auditLogger.write({
          action: "member_signup.rejected",
          category: "members",
          actorId: actor.subjectId,
          tenantId: tenantContext.tenantId,
          metadata: { signupRequestId: signup.id },
        });
        await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
        return {
          signup: rejectedSignup,
        };
      }

      await assertBillingPaymentMethodEnabled(actor, tenantContext, signup.paymentMethod);

      const [membershipPlans, locations] = await Promise.all([
        runtime.store.listMembershipPlans(tenantContext),
        runtime.store.listLocations(tenantContext),
      ]);
      const membershipPlan = membershipPlans.find(
        (entry) => entry.id === signup.membershipPlanId && entry.status === "active",
      );
      const location = locations.find(
        (entry) => entry.id === signup.preferredLocationId && entry.status === "active",
      );

      if (!membershipPlan || !location) {
        throw new AppError("Het gekozen contract of de vestiging is niet meer actief.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      const checkout = await completeMemberSignupCheckout({
        tenantContext,
        signup,
        membershipPlan,
        location,
        memberStatus: input.memberStatus,
        portalPassword: input.portalPassword,
        ownerNotes: input.ownerNotes,
        actorId: actor.subjectId,
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return checkout;
    },
    async createBillingInvoice(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "billing.processing");
      const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
      const billing = tenantProfile?.billing;
      getLiveBillingProvider(billing);
      if (billing) {
        await assertBillingPaymentMethodEnabled(
          actor,
          tenantContext,
          selectBillingPaymentMethod(billing, input.source),
        );
      }
      const invoice = await createLocalTenantBillingInvoice(tenantContext.tenantId, input);
      const processedInvoice = billing
        ? (
            await attachMolliePaymentToInvoice(tenantContext, billing, invoice, {
              eventLabel: "payment.invoice_created",
            })
          ).invoice
        : invoice;
      await runtime.auditLogger.write({
        action: "billing.invoice_created",
        category: "billing",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          invoiceId: processedInvoice.id,
          amountCents: processedInvoice.amountCents,
          externalReference: processedInvoice.externalReference,
        },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return processedInvoice;
    },
    async retryBillingInvoice(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "billing.processing");
      await assertFeatureEnabled(actor, tenantContext, "billing.autocollect");
      const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
      const billing = tenantProfile?.billing;
      getLiveBillingProvider(billing);
      const billingBackoffice = await buildBillingBackofficeSummary(tenantContext);
      const invoice = billingBackoffice.invoices.find((entry) => entry.id === input.invoiceId);

      if (!invoice) {
        throw new AppError("Invoice niet gevonden.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      const updated = await updateLocalTenantBillingInvoice(tenantContext.tenantId, {
        id: invoice.id,
        status: "open",
        retryCount: invoice.retryCount + 1,
        lastWebhookEventType: input.reason,
      });
      const processedInvoice = billing
        ? (
            await attachMolliePaymentToInvoice(tenantContext, billing, updated, {
              description: `${updated.description} retry`,
              eventLabel: "payment.retry_created",
            })
          ).invoice
        : updated;
      await runtime.auditLogger.write({
        action: "billing.invoice_retried",
        category: "billing",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          invoiceId: invoice.id,
          retryCount: processedInvoice.retryCount,
          externalReference: processedInvoice.externalReference,
        },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return processedInvoice;
    },
    async refundBillingInvoice(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "billing.processing");
      await assertFeatureEnabled(actor, tenantContext, "billing.autocollect");
      const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
      const billing = tenantProfile?.billing;
      const liveProvider = getLiveBillingProvider(billing);
      const billingBackoffice = await buildBillingBackofficeSummary(tenantContext);
      const invoice = billingBackoffice.invoices.find((entry) => entry.id === input.invoiceId);

      if (!invoice) {
        throw new AppError("Invoice niet gevonden.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      if (liveProvider) {
        if (!invoice.externalReference) {
          throw new AppError("Mollie betaalreferentie ontbreekt voor deze factuur.", {
            code: "INVALID_INPUT",
            details: {
              invoiceId: invoice.id,
            },
          });
        }

        await liveProvider.createRefund(invoice.externalReference, {
          amountCents: input.amountCents,
          currency: invoice.currency,
          description: input.reason,
        });
      }

      const refund = await createLocalTenantBillingRefund(tenantContext.tenantId, {
        invoiceId: invoice.id,
        amountCents: input.amountCents,
        reason: input.reason,
        status: "processed",
      });
      await updateLocalTenantBillingInvoice(tenantContext.tenantId, {
        id: invoice.id,
        status: "refunded",
        refundedAt: new Date().toISOString(),
      });
      await runtime.auditLogger.write({
        action: "billing.refund_created",
        category: "billing",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          invoiceId: invoice.id,
          refundId: refund.id,
          providerReference: invoice.externalReference,
        },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return refund;
    },
    async recordBillingWebhook(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "billing.processing");
      const webhook = await createLocalTenantBillingWebhook(tenantContext.tenantId, input);
      const nextStatus =
        input.eventType === "payment.paid"
          ? "paid"
          : input.eventType === "payment.refunded"
            ? "refunded"
            : input.eventType === "payment.failed"
              ? "failed"
              : null;

      if (nextStatus) {
        await updateLocalTenantBillingInvoice(tenantContext.tenantId, {
          id: input.invoiceId,
          status: nextStatus,
          paidAt: nextStatus === "paid" ? new Date().toISOString() : undefined,
          refundedAt: nextStatus === "refunded" ? new Date().toISOString() : undefined,
          lastWebhookEventType: input.eventType,
        });
      }

      await runtime.auditLogger.write({
        action: "billing.webhook_recorded",
        category: "billing",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { invoiceId: input.invoiceId, eventType: input.eventType },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return webhook;
    },
    async syncMollieBillingWebhook(input) {
      if (!isMolliePaymentConfigured()) {
        throw new AppError("Mollie API-key ontbreekt voor webhookverwerking.", {
          code: "INVALID_INPUT",
          details: {
            env: "MOLLIE_API_KEY",
          },
        });
      }

      const provider = createMolliePaymentProvider();
      const payment = await provider.getPayment(input.paymentId);
      const { tenant, invoice } = await findInvoiceForMolliePayment(
        payment,
        input.tenantId,
      );
      await assertTenantFeatureEnabled(createPublicTenantContext(tenant.id), "billing.processing", {
        subjectId: "mollie:webhook",
      });
      const eventType = mapMollieStatusToEventType(payment.status);
      const webhookStatus = mapMollieStatusToWebhookStatus(payment.status);
      const webhook = await createLocalTenantBillingWebhook(tenant.id, {
        invoiceId: invoice.id,
        eventType,
        status: webhookStatus,
        providerReference: payment.providerPaymentId,
        payloadSummary: `Mollie status ${payment.status}`,
      });
      const nextInvoiceStatus = mapMollieStatusToInvoiceStatus(payment.status);

      if (nextInvoiceStatus) {
        await updateLocalTenantBillingInvoice(tenant.id, {
          id: invoice.id,
          status: nextInvoiceStatus,
          paidAt: nextInvoiceStatus === "paid" ? new Date().toISOString() : undefined,
          refundedAt:
            nextInvoiceStatus === "refunded" ? new Date().toISOString() : undefined,
          lastWebhookEventType: eventType,
          externalReference: payment.providerPaymentId,
        });
      }

      await runtime.auditLogger.write({
        action: "billing.mollie_webhook_synced",
        category: "billing",
        actorId: "mollie:webhook",
        tenantId: tenant.id,
        metadata: {
          invoiceId: invoice.id,
          eventType,
          paymentId: payment.providerPaymentId,
        },
      });
      return webhook;
    },
    async reconcileBillingLedger(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "billing.processing");
      await assertFeatureEnabled(actor, tenantContext, "billing.autocollect");
      const billingBackoffice = await buildBillingBackofficeSummary(tenantContext);
      const matchedInvoiceIds = billingBackoffice.invoices
        .filter((invoice) => invoice.status === "paid" || invoice.status === "refunded")
        .map((invoice) => invoice.id);
      const unmatchedInvoiceIds = billingBackoffice.invoices
        .filter((invoice) => invoice.status === "open" || invoice.status === "failed")
        .map((invoice) => invoice.id);
      const run = await createLocalTenantBillingReconciliationRun(tenantContext.tenantId, {
        note: input.note,
        matchedInvoiceIds,
        unmatchedInvoiceIds,
      });
      await runtime.auditLogger.write({
        action: "billing.reconciled",
        category: "billing",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { reconciliationRunId: run.id, totalInvoices: run.totalInvoices },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return run;
    },
    async runLeadAutomations(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "marketing.leads");
      const [tenantProfile, bookings] = await Promise.all([
        getLocalTenantProfile(tenantContext.tenantId),
        runtime.store.listBookings(tenantContext),
      ]);
      const existingTasks = tenantProfile?.moduleData.leadAutomation.tasks ?? [];
      let createdTasks = 0;

      for (const lead of tenantProfile?.leads ?? []) {
        const hasOpenTask = existingTasks.some(
          (task) => task.leadId === lead.id && task.status === "open" && task.type === "nurture",
        );

        if (!hasOpenTask && lead.stage !== "won" && lead.stage !== "lost") {
          await createLocalTenantLeadTask(tenantContext.tenantId, {
            type: "nurture",
            title: `Nurture ${lead.fullName}`,
            dueAt: new Date().toISOString(),
            source: lead.source,
            leadId: lead.id,
            notes: lead.notes,
            assignedStaffName: lead.assignedStaffName,
          });
          createdTasks += 1;
        }
      }

      for (const booking of bookings.filter((entry) => entry.status === "cancelled")) {
        const hasAbandonedTask = existingTasks.some(
          (task) =>
            task.bookingId === booking.id &&
            task.type === "abandoned_booking" &&
            task.status === "open",
        );

        if (!hasAbandonedTask) {
          await createLocalTenantLeadTask(tenantContext.tenantId, {
            type: "abandoned_booking",
            title: `Volg geannuleerde booking van ${booking.memberName} op`,
            dueAt: new Date().toISOString(),
            source: "system",
            memberId: booking.memberId,
            bookingId: booking.id,
          });
          createdTasks += 1;
        }
      }

      const run = await createLocalTenantLeadAutomationRun(tenantContext.tenantId, {
        trigger: input.trigger,
        createdTasks,
      });
      await runtime.auditLogger.write({
        action: "lead_automation.run",
        category: "marketing",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { trigger: input.trigger, createdTasks },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return run;
    },
    async createAppointmentPack(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "booking.credit_system");
      const pack = await createLocalTenantAppointmentPack(tenantContext.tenantId, {
        ...input,
        remainingCredits: input.totalCredits,
      });
      await runtime.auditLogger.write({
        action: "appointments.pack_created",
        category: "coaching",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { packId: pack.id, memberId: pack.memberId },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return pack;
    },
    async createCoachAppointments(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "booking.one_to_one");
      if (input.creditPackId) {
        await assertFeatureEnabled(actor, tenantContext, "booking.credit_system");
      }
      const trainer = await runtime.store
        .listTrainers(tenantContext)
        .then((trainers) => trainers.find((entry) => entry.id === input.trainerId) ?? null);

      if (!trainer) {
        throw new AppError("Trainer voor appointment niet gevonden.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      const occurrences = Math.max(1, input.occurrences);
      const seriesId = occurrences > 1 ? crypto.randomUUID() : undefined;
      let pack;

      if (input.creditPackId) {
        const appointmentSummary = await buildAppointmentSummary(tenantContext);
        const existingPack = appointmentSummary.creditPacks.find(
          (entry) => entry.id === input.creditPackId,
        );

        if (!existingPack) {
          throw new AppError("Credit pack niet gevonden voor appointment.", {
            code: "RESOURCE_NOT_FOUND",
          });
        }

        if (existingPack.remainingCredits < occurrences) {
          throw new AppError("Deze credit pack heeft niet genoeg credits voor alle sessies.", {
            code: "INVALID_INPUT",
            details: {
              remainingCredits: existingPack.remainingCredits,
              requestedCredits: occurrences,
            },
          });
        }

        pack = existingPack;
      }

      const appointments = await createLocalTenantCoachAppointments(
        tenantContext.tenantId,
        Array.from({ length: occurrences }, (_, index) => ({
          trainerId: trainer.id,
          trainerName: trainer.fullName,
          memberId: input.memberId,
          memberName: input.memberName,
          locationId: input.locationId,
          startsAt: new Date(
            new Date(input.startsAt).getTime() + index * 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          durationMinutes: input.durationMinutes,
          status: "scheduled",
          recurrence: input.recurrence,
          seriesId,
          creditPackId: input.creditPackId,
          notes: input.notes,
        })),
      );

      if (input.creditPackId && pack) {
        pack = await updateLocalTenantAppointmentPack(tenantContext.tenantId, {
          id: pack.id,
          remainingCredits: pack.remainingCredits - appointments.length,
        });
      }

      await runtime.auditLogger.write({
        action: "appointments.created",
        category: "coaching",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { count: appointments.length, trainerId: trainer.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return {
        appointments,
        pack,
      };
    },
    async createCommunityGroup(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "retention.community_groups");
      const group = await createLocalTenantCommunityGroup(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "community.group_created",
        category: "retention",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { groupId: group.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return group;
    },
    async createMemberChallenge(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "retention.challenges_rewards");
      const challenge = await createLocalTenantChallenge(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "community.challenge_created",
        category: "retention",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { challengeId: challenge.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return challenge;
    },
    async createQuestionnaire(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "retention.questionnaire");
      const questionnaire = await createLocalTenantQuestionnaire(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "community.questionnaire_created",
        category: "retention",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { questionnaireId: questionnaire.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return questionnaire;
    },
    async submitQuestionnaireResponse(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "retention.questionnaire");
      const response = await createLocalTenantQuestionnaireResponse(
        tenantContext.tenantId,
        input,
      );
      await runtime.auditLogger.write({
        action: "community.questionnaire_response_created",
        category: "retention",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { questionnaireId: input.questionnaireId, memberId: input.memberId },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return response;
    },
    async requestMobilePaymentMethodUpdate(actor, tenantContext, input) {
      await assertFeatureEnabled(actor, tenantContext, "mobile.white_label");
      const member = await resolveSelfServiceMemberAccess(
        actor,
        tenantContext,
        input.memberId,
      );
      const request = await createLocalTenantPaymentMethodRequest(tenantContext.tenantId, {
        ...input,
        memberName: member.fullName,
      });
      await runtime.auditLogger.write({
        action: "mobile.payment_method_request_created",
        category: "mobile",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          requestId: request.id,
          memberId: request.memberId,
          requestedByRole: runtime.permissionRegistry.hasPermissions(
            actor,
            ["operations.manage"],
            tenantContext,
          )
            ? "staff"
            : "member",
        },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return request;
    },
    async reviewMobilePaymentMethodUpdate(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "mobile.white_label");
      const request = await reviewLocalTenantPaymentMethodRequest(tenantContext.tenantId, {
        id: input.requestId,
        status: input.decision,
        ownerNotes: input.ownerNotes,
      });
      await runtime.auditLogger.write({
        action: "mobile.payment_method_request_reviewed",
        category: "mobile",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { requestId: request.id, status: request.status },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return request;
    },
    async requestMembershipPause(actor, tenantContext, input) {
      await assertFeatureEnabled(actor, tenantContext, "mobile.white_label");
      const member = await resolveSelfServiceMemberAccess(
        actor,
        tenantContext,
        input.memberId,
      );
      const request = await createLocalTenantPauseRequest(tenantContext.tenantId, {
        ...input,
        memberName: member.fullName,
      });
      await runtime.auditLogger.write({
        action: "mobile.pause_request_created",
        category: "mobile",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          requestId: request.id,
          memberId: request.memberId,
          requestedByRole: runtime.permissionRegistry.hasPermissions(
            actor,
            ["operations.manage"],
            tenantContext,
          )
            ? "staff"
            : "member",
        },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return request;
    },
    async reviewMembershipPause(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "mobile.white_label");
      const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
      const existing = tenantProfile?.moduleData.mobileSelfService.pauseRequests.find(
        (entry) => entry.id === input.requestId,
      );

      if (!existing) {
        throw new AppError("Pause request niet gevonden.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      const request = await reviewLocalTenantPauseRequest(tenantContext.tenantId, {
        id: input.requestId,
        status: input.decision,
        ownerNotes: input.ownerNotes,
      });
      let member;

      if (input.decision === "approved") {
        const existingMember = await runtime.store.getMember(tenantContext, existing.memberId);

        if (!existingMember) {
          throw new AppError("Lid voor pause request niet gevonden.", {
            code: "RESOURCE_NOT_FOUND",
          });
        }

        member = await runtime.store.updateMember(tenantContext, {
          ...existingMember,
          expectedVersion: existingMember.version,
          status: "paused",
        });
        await syncLocalMemberPortalAccount(tenantContext.tenantId, {
          memberId: member.id,
          displayName: member.fullName,
          email: member.email,
          status: "archived",
        });
      }

      await runtime.auditLogger.write({
        action: "mobile.pause_request_reviewed",
        category: "mobile",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { requestId: request.id, status: request.status },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return {
        request,
        member,
      };
    },
    async createLocation(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "clubs.multi_location");
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
      await assertFeatureEnabled(actor, tenantContext, "clubs.multi_location");
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
      await assertFeatureEnabled(actor, tenantContext, "clubs.multi_location");
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
      await assertFeatureEnabled(actor, tenantContext, "clubs.multi_location");
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
      await assertFeatureEnabled(actor, tenantContext, "membership.management");
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
      await assertFeatureEnabled(actor, tenantContext, "membership.management");
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
      await assertFeatureEnabled(actor, tenantContext, "membership.management");
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
      await assertFeatureEnabled(actor, tenantContext, "membership.management");
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
      await assertFeatureEnabled(actor, tenantContext, "staff.management");
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
      await assertFeatureEnabled(actor, tenantContext, "staff.management");
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
      await assertFeatureEnabled(actor, tenantContext, "staff.management");
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
      await assertFeatureEnabled(actor, tenantContext, "staff.management");
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
      await assertFeatureEnabled(actor, tenantContext, "membership.management");
      const { portalPassword, ...memberInput } = input;
      const member = await runtime.store.createMember(tenantContext, {
        ...memberInput,
        phone: normalizePhoneForStorage(memberInput.phone, memberInput.phoneCountry),
      });

      if (portalPassword?.trim()) {
        await upsertLocalMemberPortalAccount(tenantContext.tenantId, {
          memberId: member.id,
          displayName: member.fullName,
          email: member.email,
          password: portalPassword.trim(),
        });
      }
      await ensureMemberContractRecord(tenantContext, member);

      await runtime.auditLogger.write({
        action: "member.created",
        category: "members",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          memberId: member.id,
          portalAccessEnabled: Boolean(portalPassword?.trim()),
        },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return member;
    },
    async updateMember(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "membership.management");
      const member = await runtime.store.updateMember(tenantContext, {
        ...input,
        phone: normalizePhoneForStorage(input.phone, input.phoneCountry),
      });
      await syncLocalMemberPortalAccount(tenantContext.tenantId, {
        memberId: member.id,
        displayName: member.fullName,
        email: member.email,
        status: isReservableMemberStatus(member.status) ? "active" : "archived",
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
      await assertFeatureEnabled(actor, tenantContext, "membership.management");
      const member = await runtime.store.archiveMember(tenantContext, input);
      await syncLocalMemberPortalAccount(tenantContext.tenantId, {
        memberId: member.id,
        displayName: member.fullName,
        email: member.email,
        status: "archived",
      });
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
      await assertFeatureEnabled(actor, tenantContext, "membership.management");
      await runtime.store.deleteMember(tenantContext, input);
      await deleteLocalMemberPortalAccountByMemberId(tenantContext.tenantId, input.id);
      await runtime.auditLogger.write({
        action: "member.deleted",
        category: "members",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: { memberId: input.id },
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
    },
    async setMemberPortalPassword(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "membership.management");
      const member = await runtime.store.getMember(tenantContext, input.memberId);

      if (!member) {
        throw new AppError("Lid kon niet gevonden worden.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

      if (!isReservableMemberStatus(member.status)) {
        throw new AppError(
          "Portaltoegang is alleen beschikbaar voor actieve of trial leden.",
          {
            code: "FORBIDDEN",
          },
        );
      }

      const account = await upsertLocalMemberPortalAccount(tenantContext.tenantId, {
        memberId: member.id,
        displayName: member.fullName,
        email: member.email,
        password: input.password.trim(),
      });

      await runtime.auditLogger.write({
        action: "member.portal_access_updated",
        category: "members",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          memberId: member.id,
          accountId: account.userId,
        },
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);

      return {
        memberId: member.id,
        email: account.email,
        status: "active" as const,
      };
    },
    async importContractsAndMembers(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["operations.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "membership.management");

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
      await assertFeatureEnabled(actor, tenantContext, "booking.scheduling");
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
      await assertFeatureEnabled(actor, tenantContext, "booking.scheduling");
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
      await assertFeatureEnabled(actor, tenantContext, "booking.scheduling");
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
      await assertFeatureEnabled(actor, tenantContext, "booking.scheduling");
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
      await assertFeatureEnabled(actor, tenantContext, "staff.management");
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
      await assertFeatureEnabled(actor, tenantContext, "staff.management");
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
      await assertFeatureEnabled(actor, tenantContext, "staff.management");
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
      if (input.enabled) {
        await assertFeatureEnabled(actor, tenantContext, "access.24_7");
        await assertFeatureEnabled(actor, tenantContext, "integrations.hardware");
      }

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
      if (input.enabled) {
        await assertFeatureEnabled(actor, tenantContext, "billing.processing");
        await assertBillingPaymentMethodsEnabled(actor, tenantContext, input.paymentMethods);
      }

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
    async updateBookingWorkspace(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      const current = await buildBookingWorkspaceSummary(tenantContext);
      await assertFeatureSettingChangesEnabled(actor, tenantContext, [
        {
          key: "booking.one_to_one",
          changed:
            hasSettingChanged(current.oneToOneSessionName, input.oneToOneSessionName) ||
            hasSettingChanged(current.oneToOneDurationMinutes, input.oneToOneDurationMinutes),
        },
        {
          key: "booking.online_trial",
          changed: hasSettingChanged(current.trialBookingUrl, input.trialBookingUrl),
        },
        {
          key: "booking.credit_system",
          changed: hasSettingChanged(current.defaultCreditPackSize, input.defaultCreditPackSize),
        },
        {
          key: "booking.scheduling",
          changed: hasSettingChanged(current.schedulingWindowDays, input.schedulingWindowDays),
        },
      ]);

      await updateLocalTenantBookingSettings(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "booking_workspace.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return buildBookingWorkspaceSummary(tenantContext);
    },
    async updateBookingPolicy(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "booking.scheduling");
      await updateLocalTenantBookingPolicy(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "booking_policy.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
      });
      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return buildBookingPolicySummary(tenantContext);
    },
    async updateRevenueWorkspace(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      const current = await buildRevenueWorkspaceSummary(tenantContext);
      await assertFeatureSettingChangesEnabled(actor, tenantContext, [
        {
          key: "commerce.webshop_pos",
          changed:
            hasSettingChanged(current.webshopCollectionName, input.webshopCollectionName) ||
            hasSettingChanged(current.pointOfSaleMode, input.pointOfSaleMode) ||
            hasSettingChanged(current.cardTerminalLabel, input.cardTerminalLabel),
        },
        {
          key: "billing.autocollect",
          changed: hasSettingChanged(current.autocollectPolicy, input.autocollectPolicy),
        },
        {
          key: "billing.direct_debit",
          changed: hasSettingChanged(current.directDebitLeadDays, input.directDebitLeadDays),
        },
      ]);

      await updateLocalTenantRevenueSettings(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "revenue_workspace.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return buildRevenueWorkspaceSummary(tenantContext);
    },
    async updateCoachingWorkspace(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      const current = await buildCoachingWorkspaceSummary(tenantContext);
      await assertFeatureSettingChangesEnabled(actor, tenantContext, [
        {
          key: "coaching.workout_plans",
          changed: hasSettingChanged(current.workoutPlanFocus, input.workoutPlanFocus),
        },
        {
          key: "coaching.nutrition",
          changed: hasSettingChanged(current.nutritionCadence, input.nutritionCadence),
        },
        {
          key: "coaching.on_demand_videos",
          changed: hasSettingChanged(current.videoLibraryUrl, input.videoLibraryUrl),
        },
        {
          key: "coaching.progress_tracking",
          changed: hasSettingChanged(current.progressMetric, input.progressMetric),
        },
        {
          key: "coaching.heart_rate",
          changed: hasSettingChanged(current.heartRateProvider, input.heartRateProvider),
        },
        {
          key: "coaching.ai_max",
          changed: hasSettingChanged(current.aiCoachMode, input.aiCoachMode),
        },
      ]);

      await updateLocalTenantCoachingSettings(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "coaching_workspace.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return buildCoachingWorkspaceSummary(tenantContext);
    },
    async updateRetentionWorkspace(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      const current = await buildRetentionWorkspaceSummary(tenantContext);
      await assertFeatureSettingChangesEnabled(actor, tenantContext, [
        {
          key: "retention.planner",
          changed: hasSettingChanged(current.retentionCadence, input.retentionCadence),
        },
        {
          key: "retention.community_groups",
          changed: hasSettingChanged(current.communityChannel, input.communityChannel),
        },
        {
          key: "retention.challenges_rewards",
          changed: hasSettingChanged(current.challengeTheme, input.challengeTheme),
        },
        {
          key: "retention.questionnaire",
          changed: hasSettingChanged(current.questionnaireTrigger, input.questionnaireTrigger),
        },
        {
          key: "retention.pro_content",
          changed: hasSettingChanged(current.proContentPath, input.proContentPath),
        },
        {
          key: "retention.fitzone",
          changed: hasSettingChanged(current.fitZoneOffer, input.fitZoneOffer),
        },
      ]);

      await updateLocalTenantRetentionSettings(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "retention_workspace.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return buildRetentionWorkspaceSummary(tenantContext);
    },
    async updateMobileExperience(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      const current = await buildMobileExperienceSummary(tenantContext);
      await assertFeatureSettingChangesEnabled(actor, tenantContext, [
        {
          key: "mobile.white_label",
          changed:
            hasSettingChanged(current.appDisplayName, input.appDisplayName) ||
            hasSettingChanged(current.onboardingHeadline, input.onboardingHeadline) ||
            hasSettingChanged(current.supportChannel, input.supportChannel) ||
            hasSettingChanged(current.primaryAccent, input.primaryAccent) ||
            hasSettingChanged(current.whiteLabelDomain, input.whiteLabelDomain),
        },
        {
          key: "mobile.checkin",
          changed: hasSettingChanged(current.checkInMode, input.checkInMode),
        },
      ]);

      await updateLocalTenantMobileSettings(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "mobile_experience.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return buildMobileExperienceSummary(tenantContext);
    },
    async updateMarketingWorkspace(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      const current = await buildMarketingWorkspaceSummary(tenantContext);
      await assertFeatureSettingChangesEnabled(actor, tenantContext, [
        {
          key: "marketing.email",
          changed:
            hasSettingChanged(current.emailSenderName, input.emailSenderName) ||
            hasSettingChanged(current.emailReplyTo, input.emailReplyTo),
        },
        {
          key: "marketing.promotions",
          changed: hasSettingChanged(current.promotionHeadline, input.promotionHeadline),
        },
        {
          key: "marketing.leads",
          changed:
            hasSettingChanged(current.leadPipelineLabel, input.leadPipelineLabel) ||
            hasSettingChanged(current.automationCadence, input.automationCadence),
        },
      ]);

      await updateLocalTenantMarketingSettings(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "marketing_workspace.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return buildMarketingWorkspaceSummary(tenantContext);
    },
    async updateIntegrationWorkspace(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      const current = await buildIntegrationWorkspaceSummary(tenantContext);
      await assertFeatureSettingChangesEnabled(actor, tenantContext, [
        {
          key: "integrations.hardware",
          changed: hasSettingChanged(current.hardwareVendors, input.hardwareVendors),
        },
        {
          key: "integrations.software",
          changed: hasSettingChanged(current.softwareIntegrations, input.softwareIntegrations),
        },
        {
          key: "integrations.equipment",
          changed: hasSettingChanged(current.equipmentIntegrations, input.equipmentIntegrations),
        },
        {
          key: "integrations.virtuagym_connect",
          changed: hasSettingChanged(current.migrationProvider, input.migrationProvider),
        },
        {
          key: "integrations.body_composition",
          changed: hasSettingChanged(
            current.bodyCompositionProvider,
            input.bodyCompositionProvider,
          ),
        },
      ]);

      await updateLocalTenantIntegrationSettings(tenantContext.tenantId, input);
      await runtime.auditLogger.write({
        action: "integration_workspace.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);
      return buildIntegrationWorkspaceSummary(tenantContext);
    },
    async updateFeatureFlag(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);

      const featureDefinition = DASHBOARD_FEATURE_CATALOG.find(
        (feature) => feature.key === input.key,
      );

      if (!featureDefinition) {
        throw new AppError("Feature flag niet gevonden.", {
          code: "RESOURCE_NOT_FOUND",
          details: { key: input.key },
        });
      }

      await updateLocalTenantFeatureFlag(tenantContext.tenantId, {
        key: input.key,
        value: input.enabled,
        updatedBy: actor.displayName ?? actor.subjectId,
      });

      await runtime.auditLogger.write({
        action: "feature_flag.updated",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          key: input.key,
          enabled: input.enabled,
        },
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);

      const nextFeatureStates = await featureStates(actor, tenantContext);
      const updatedFeature = nextFeatureStates.find((feature) => feature.key === input.key);

      if (!updatedFeature) {
        throw new AppError("Feature flag kon niet worden teruggelezen.", {
          code: "RESOURCE_NOT_FOUND",
          details: { key: input.key },
        });
      }

      return updatedFeature;
    },
    async requestRemoteAccessUnlock(actor, tenantContext) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "access.24_7");
      await assertFeatureEnabled(actor, tenantContext, "integrations.hardware");

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
      const liveProvider = getLiveRemoteAccessProvider(remoteAccess);

      if (!liveProvider) {
        throw new AppError("Remote openen is niet actief voor deze gym.", {
          code: "FORBIDDEN",
        });
      }

      const providerReceipt = await liveProvider.unlock({
        smartlockId: remoteAccess.externalDeviceId,
      });

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
          mode: "live",
          providerActionId: providerReceipt.providerActionId,
          providerStatus: providerReceipt.providerStatus,
        },
      });

      await createTenantAwareCache(runtime, tenantContext).delete("dashboard", actor.subjectId);

      return {
        provider: remoteAccess.provider,
        providerLabel,
        deviceLabel: remoteAccess.deviceLabel,
        locationName,
        requestedAt,
        mode: "live",
        providerActionId: providerReceipt.providerActionId,
        providerStatus: providerReceipt.providerStatus,
        summary: `Live remote open verstuurd naar ${remoteAccess.deviceLabel} via ${providerLabel}${locationName ? ` voor ${locationName}` : ""}.`,
      };
    },
    async requestBillingPreview(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["settings.manage"]);
      await assertFeatureEnabled(actor, tenantContext, "billing.processing");
      await assertBillingPaymentMethodEnabled(actor, tenantContext, input.paymentMethod);

      const tenantProfile = await getLocalTenantProfile(tenantContext.tenantId);
      const billing = tenantProfile?.billing;

      if (!billing || !isBillingReady(billing)) {
        throw new AppError(
          "Koppel en activeer eerst Mollie voordat je een betaalflow start.",
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
      getLiveBillingProvider(billing);

      const requestedAt = new Date().toISOString();
      const paymentMethodLabel = getBillingPaymentMethodLabel(input.paymentMethod);
      const amountLabel = formatCurrencyValue(input.amountCents / 100, input.currency, "nl");
      const invoice = await createLocalTenantBillingInvoice(tenantContext.tenantId, {
        memberName: input.memberName?.trim() || "Losse betaling",
        description: input.description.trim(),
        amountCents: input.amountCents,
        currency: input.currency,
        dueAt: requestedAt,
        source: "manual",
      });
      const { invoice: processedInvoice, intent } = await attachMolliePaymentToInvoice(
        tenantContext,
        billing,
        invoice,
        {
          paymentMethod: input.paymentMethod,
          eventLabel: "payment.link_created",
        },
      );

      if (!intent) {
        throw new AppError(
          "Mollie live credentials ontbreken. Vul MOLLIE_API_KEY in voordat je betalingen verwerkt.",
          {
            code: "INVALID_INPUT",
            details: {
              provider: "mollie",
              env: "MOLLIE_API_KEY",
            },
          },
        );
      }

      const summary = runtime.templateRenderer.render(
        "Live {{paymentMethod}} van {{amountLabel}} aangemaakt via {{provider}} voor {{description}}{{memberSuffix}}.",
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
        action: "billing.payment_link_created",
        category: "settings",
        actorId: actor.subjectId,
        tenantId: tenantContext.tenantId,
        metadata: {
          provider: billing.provider,
          paymentMethod: input.paymentMethod,
          amountCents: input.amountCents,
          currency: input.currency,
          invoiceId: processedInvoice.id,
          providerPaymentId: intent.providerPaymentId,
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
        mode: "live",
        invoiceId: processedInvoice.id,
        providerPaymentId: intent.providerPaymentId,
        providerStatus: intent.status,
        checkoutUrl: intent.checkoutUrl,
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

      if (!member || !classSession) {
        throw new AppError("Lid of les kon niet gevonden worden.", {
          code: "RESOURCE_NOT_FOUND",
        });
      }

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
      const publicActor = createFeatureGateActor(
        tenantProfile.id,
        `public-reservation:${normalizeEmailValue(input.email)}`,
      );
      await assertFeatureEnabled(publicActor, tenantContext, "booking.online_trial");
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
    async createMemberReservation(actor, input) {
      const { memberships, selectedMembership } = await resolveReservableTenantSelection(
        actor,
        input.tenantSlug,
      );

      if (!selectedMembership) {
        throw new AppError(
          memberships.length > 1
            ? "Kies eerst bij welke club je wilt reserveren."
            : "Je kunt alleen reserveren bij clubs waar je al een actief lidmaatschap hebt.",
          {
            code: "FORBIDDEN",
          },
        );
      }

      const tenantContext = createPublicTenantContext(selectedMembership.tenant.id);
      const classSession = await runtime.store.getClassSession(
        tenantContext,
        input.classSessionId,
      );

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

      if (!isReservableMemberStatus(selectedMembership.member.status)) {
        throw new AppError(
          "Je lidmaatschap is niet actief genoeg om online te reserveren.",
          {
            code: "FORBIDDEN",
          },
        );
      }

      const bookingActor = createPublicBookingActor(
        selectedMembership.tenant.id,
        selectedMembership.member,
      );

      return createBookingFlow(
        bookingActor,
        tenantContext,
        {
          classSessionId: input.classSessionId,
          memberId: selectedMembership.member.id,
          idempotencyKey: `member-app:${selectedMembership.member.id}:${input.classSessionId}`,
          phone: selectedMembership.member.phone,
          phoneCountry: selectedMembership.member.phoneCountry,
          notes: input.notes,
          source: "member_app",
        },
        selectedMembership.member,
        classSession,
      );
    },
    async cancelBooking(actor, tenantContext, input) {
      assertAccess(runtime, actor, tenantContext, ["classes.book"]);
      await assertFeatureEnabled(actor, tenantContext, "booking.group_classes");

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
      const bookingPolicy = await buildBookingPolicySummary(tenantContext);

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

      if (
        classSession &&
        bookingPolicy.lateCancelFeeCents > 0 &&
        hoursUntil(classSession.startsAt) <= bookingPolicy.cancellationWindowHours
      ) {
        const [autocollectFeature, paymentRequestFeature] = await Promise.all([
          evaluateFeatureFlag(actor, tenantContext, "billing.autocollect"),
          evaluateFeatureFlag(
            actor,
            tenantContext,
            getBillingFeatureForPaymentMethod("payment_request"),
          ),
        ]);

        if (autocollectFeature.enabled && paymentRequestFeature.enabled) {
          await createLocalTenantCollectionCase(tenantContext.tenantId, {
            memberId: result.booking.memberId,
            memberName: result.booking.memberName,
            paymentMethod: "payment_request",
            status: "open",
            amountCents: bookingPolicy.lateCancelFeeCents,
            reason: `Late cancellation fee for ${classSession.title}`,
            dueAt: new Date().toISOString(),
            notes: `Automatisch aangemaakt omdat de annulering binnen ${bookingPolicy.cancellationWindowHours} uur voor aanvang viel.`,
          });
        }
      }

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
      await assertFeatureEnabled(actor, tenantContext, "checkin.studio");

      const checkInFeature = await evaluateFeatureFlag(
        actor,
        tenantContext,
        "mobile.checkin",
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
