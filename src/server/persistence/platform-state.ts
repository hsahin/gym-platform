import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError, createPrefixedIdGenerator } from "@claimtech/core";
import {
  MongoDatabaseClient,
  createMongoClient,
  type GlobalCollection,
} from "@claimtech/database";
import { toTenantId, type TenantId } from "@claimtech/tenant";
import {
  createDefaultBillingSettings,
  normalizeStoredBillingSettings,
  type StoredBillingSettings,
} from "@/lib/billing";
import {
  createDefaultRemoteAccessSettings,
  getRemoteAccessConnectionStatus,
  normalizeStoredRemoteAccessSettings,
  type StoredRemoteAccessSettings,
} from "@/lib/remote-access";
import type {
  AccountRoleKey,
  PlatformRoleKey,
} from "@/server/runtime/platform-roles";
import {
  assertProductionEnvironmentReady,
} from "@/server/runtime/production-readiness";
import type {
  BillingPaymentMethod,
  BillingProvider,
  LegalComplianceSummary,
  RemoteAccessBridgeType,
  RemoteAccessProvider,
} from "@/server/types";
import {
  createEmptyGymStoreState,
  type MemoryGymStoreState,
} from "@/server/persistence/memory-gym-store";

const stateVersion = 3;
const accountIdGenerator = createPrefixedIdGenerator({ prefix: "staff" });
const memberAccountIdGenerator = createPrefixedIdGenerator({ prefix: "member" });
const mongoPlatformStateCollection = "platform_state";
const mongoPlatformStateDocumentId = "gym-platform-state";
const productName = "gym-platform";

let mutationQueue = Promise.resolve();
let mongoStateCollectionPromise:
  | Promise<GlobalCollection<MongoLocalPlatformStateDocument> | null>
  | null = null;

export interface LocalTenantProfile {
  readonly id: TenantId;
  readonly name: string;
  readonly billing: StoredBillingSettings;
  readonly legal: StoredLegalComplianceSettings;
  readonly remoteAccess: StoredRemoteAccessSettings;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LocalPlatformAccount {
  readonly userId: string;
  readonly tenantId: TenantId;
  readonly email: string;
  readonly displayName: string;
  readonly roleKey: AccountRoleKey;
  readonly linkedMemberId?: string;
  readonly passwordHash: string;
  readonly status: "active" | "archived";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LocalPlatformState {
  readonly version: number;
  readonly tenants: ReadonlyArray<LocalTenantProfile>;
  readonly accounts: ReadonlyArray<LocalPlatformAccount>;
  readonly data: MemoryGymStoreState;
}

export interface LocalTenantBootstrapResult {
  readonly tenant: LocalTenantProfile;
  readonly accounts: ReadonlyArray<LocalPlatformAccount>;
  readonly data: MemoryGymStoreState;
}

export interface AuthenticatedLocalAccount {
  readonly account: LocalPlatformAccount;
  readonly tenant: LocalTenantProfile;
  readonly accounts: ReadonlyArray<LocalPlatformAccount>;
  readonly tenants: ReadonlyArray<LocalTenantProfile>;
}

export interface BootstrapPlatformInput {
  readonly tenantName: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly password: string;
}

export interface CreatePlatformAccountInput {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly roleKey: PlatformRoleKey;
}

export interface UpdatePlatformAccountInput {
  readonly userId: string;
  readonly expectedUpdatedAt: string;
  readonly displayName: string;
  readonly email: string;
  readonly roleKey: PlatformRoleKey;
  readonly status: "active" | "archived";
}

export interface UpsertMemberPortalAccountInput {
  readonly memberId: string;
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
}

export interface UpdateLocalTenantRemoteAccessInput {
  readonly enabled: boolean;
  readonly provider: RemoteAccessProvider;
  readonly bridgeType: RemoteAccessBridgeType;
  readonly locationId: string | null;
  readonly deviceLabel: string;
  readonly externalDeviceId: string;
  readonly notes?: string;
  readonly allowedRoleKeys?: ReadonlyArray<PlatformRoleKey>;
}

export interface UpdateLocalTenantBillingSettingsInput {
  readonly enabled: boolean;
  readonly provider: BillingProvider;
  readonly profileLabel: string;
  readonly profileId: string;
  readonly settlementLabel: string;
  readonly supportEmail: string;
  readonly paymentMethods: ReadonlyArray<BillingPaymentMethod>;
  readonly notes?: string;
}

export type StoredLegalComplianceSettings = Pick<
  LegalComplianceSummary,
  | "termsUrl"
  | "privacyUrl"
  | "sepaCreditorId"
  | "sepaMandateText"
  | "contractPdfTemplateKey"
  | "waiverStorageKey"
  | "waiverRetentionMonths"
  | "lastValidatedAt"
>;

export type UpdateLocalTenantLegalSettingsInput = Omit<
  StoredLegalComplianceSettings,
  "lastValidatedAt"
>;

type LegacyLocalPlatformState = {
  readonly version: 1;
  readonly tenant: Omit<LocalTenantProfile, "remoteAccess" | "billing">;
  readonly accounts: ReadonlyArray<
    Omit<LocalPlatformAccount, "tenantId" | "linkedMemberId">
  >;
  readonly data: MemoryGymStoreState;
};

type LegacyVersion2LocalPlatformState = Omit<PersistedLocalPlatformState, "version"> & {
  readonly version: number;
};

type PersistedLocalTenantProfile = Omit<LocalTenantProfile, "remoteAccess" | "billing" | "legal"> & {
  readonly billing?: Partial<StoredBillingSettings>;
  readonly legal?: Partial<StoredLegalComplianceSettings>;
  readonly remoteAccess?: Partial<StoredRemoteAccessSettings>;
};

type PersistedLocalPlatformState = Omit<LocalPlatformState, "tenants"> & {
  readonly tenants: ReadonlyArray<PersistedLocalTenantProfile>;
};

type MongoLocalPlatformStateDocument = PersistedLocalPlatformState & {
  readonly id: string;
};

function getStateFilePath() {
  return (
    process.env.LOCAL_PLATFORM_STATE_FILE ||
    path.join(process.cwd(), ".data", "gym-platform-state.json")
  );
}

function shouldUseTestFileFallback() {
  return process.env.NODE_ENV === "test" && !process.env.MONGODB_URI;
}

async function resolveMongoStateCollection() {
  if (shouldUseTestFileFallback()) {
    return null;
  }

  if (!mongoStateCollectionPromise) {
    mongoStateCollectionPromise = (async () => {
      assertProductionEnvironmentReady();

      if (!process.env.MONGODB_URI) {
        throw new AppError(
          "MONGODB_URI is verplicht. De app gebruikt geen lokale platformstate meer.",
          {
            code: "INVALID_INPUT",
          },
        );
      }

      const client = createMongoClient({
        uri: process.env.MONGODB_URI,
        appName: productName,
      });
      await client.connect();

      const dbName = process.env.MONGODB_DB_NAME ?? productName;
      const databaseClient = new MongoDatabaseClient(client.db(dbName));

      return databaseClient
        .global()
        .collection<MongoLocalPlatformStateDocument>(mongoPlatformStateCollection);
    })();
  }

  return mongoStateCollectionPromise;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isMemberAccount(account: Pick<LocalPlatformAccount, "roleKey">) {
  return account.roleKey === "member";
}

function assertUniqueTenantEmail(
  accounts: ReadonlyArray<LocalPlatformAccount>,
  tenantId: TenantId,
  normalizedEmail: string,
  excludeUserId?: string,
) {
  const conflict = accounts.some(
    (account) =>
      account.tenantId === tenantId &&
      account.userId !== excludeUserId &&
      normalizeEmail(account.email) === normalizedEmail,
  );

  if (conflict) {
    throw new AppError("Er bestaat al een account met dit e-mailadres binnen deze gym.", {
      code: "INVALID_INPUT",
      details: { email: normalizedEmail, tenantId },
    });
  }
}

export function slugifyTenantName(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "gym-platform";
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const storedBuffer = Buffer.from(storedHash, "hex");
  const derivedBuffer = scryptSync(password, salt, storedBuffer.length);

  return timingSafeEqual(storedBuffer, derivedBuffer);
}

function createEmptyState(): LocalPlatformState {
  return {
    version: stateVersion,
    tenants: [],
    accounts: [],
    data: createEmptyGymStoreState(),
  };
}

function createDefaultLegalComplianceSettings(): StoredLegalComplianceSettings {
  return {
    termsUrl: "",
    privacyUrl: "",
    sepaCreditorId: "",
    sepaMandateText:
      "Ik machtig de sportschool om terugkerende lidmaatschapsbetalingen via SEPA incasso te innen volgens mijn contract.",
    contractPdfTemplateKey: "",
    waiverStorageKey: "",
    waiverRetentionMonths: 84,
  };
}

function normalizeLegalComplianceSettings(
  input?: Partial<StoredLegalComplianceSettings>,
): StoredLegalComplianceSettings {
  const base = createDefaultLegalComplianceSettings();
  const normalized = {
    ...base,
    ...input,
    waiverRetentionMonths: Math.max(
      1,
      Number(input?.waiverRetentionMonths ?? base.waiverRetentionMonths),
    ),
  };
  const isComplete = Boolean(
    normalized.termsUrl &&
      normalized.privacyUrl &&
      normalized.sepaCreditorId &&
      normalized.sepaMandateText &&
      normalized.contractPdfTemplateKey &&
      normalized.waiverStorageKey,
  );

  return {
    ...normalized,
    lastValidatedAt: isComplete ? input?.lastValidatedAt : undefined,
  };
}

function toTenantIdFromName(name: string) {
  return toTenantId(slugifyTenantName(name));
}

function toTenantSlug(tenantId: string) {
  return tenantId.trim().toLowerCase();
}

function findTenantBySlug(
  state: LocalPlatformState,
  tenantSlug: string,
) {
  return state.tenants.find(
    (tenant) => toTenantSlug(tenant.id) === toTenantSlug(tenantSlug),
  );
}

function toTenantBootstrapResult(
  state: LocalPlatformState,
  tenantId: TenantId,
): LocalTenantBootstrapResult {
  const tenant = state.tenants.find((entry) => entry.id === tenantId);

  if (!tenant) {
    throw new AppError("Tenant niet gevonden in de platformstate.", {
      code: "RESOURCE_NOT_FOUND",
      details: { tenantId },
    });
  }

  return {
    tenant,
    accounts: state.accounts.filter((account) => account.tenantId === tenantId),
    data: state.data,
  };
}

function normalizeTenantProfile(
  tenant: PersistedLocalTenantProfile,
): LocalTenantProfile {
  return {
    ...tenant,
    billing: normalizeStoredBillingSettings(tenant.billing),
    legal: normalizeLegalComplianceSettings(tenant.legal),
    remoteAccess: normalizeStoredRemoteAccessSettings(tenant.remoteAccess),
  };
}

function normalizeAccount(
  account: LocalPlatformAccount,
): LocalPlatformAccount {
  return {
    ...account,
    email: normalizeEmail(account.email),
    linkedMemberId: account.linkedMemberId?.trim() || undefined,
  };
}

function normalizeState(
  state: PersistedLocalPlatformState,
): {
  readonly state: LocalPlatformState;
  readonly changed: boolean;
} {
  let changed = false;
  const tenants = state.tenants.map((tenant) => {
    const normalized = normalizeTenantProfile(tenant);

    if (!tenant.remoteAccess || !tenant.billing || !tenant.legal) {
      changed = true;
    }

    return normalized;
  });
  const accounts = state.accounts.map((account) => {
    const normalized = normalizeAccount(account);

    if (
      normalized.email !== account.email ||
      normalized.linkedMemberId !== account.linkedMemberId
    ) {
      changed = true;
    }

    return normalized;
  });

  return {
    state: {
      ...state,
      tenants,
      accounts,
    },
    changed,
  };
}

function migrateLegacyState(parsed: LegacyLocalPlatformState): LocalPlatformState {
  return {
    version: stateVersion,
    tenants: [
      {
        ...parsed.tenant,
        billing: createDefaultBillingSettings(),
        legal: createDefaultLegalComplianceSettings(),
        remoteAccess: createDefaultRemoteAccessSettings(),
      },
    ],
    accounts: parsed.accounts.map((account) => ({
      ...account,
      tenantId: parsed.tenant.id,
      linkedMemberId: undefined,
    })),
    data: parsed.data,
  };
}

function migrateVersion2State(
  parsed: LegacyVersion2LocalPlatformState,
): LocalPlatformState {
  const normalized = normalizeState({
    ...parsed,
    version: stateVersion,
  });

  return {
    ...normalized.state,
    version: stateVersion,
  };
}

async function persistState(state: LocalPlatformState) {
  const collection = await resolveMongoStateCollection();

  if (collection) {
    const document: MongoLocalPlatformStateDocument = {
      id: mongoPlatformStateDocumentId,
      ...state,
    };
    const existing = await collection.findOne({ id: mongoPlatformStateDocumentId });

    if (!existing) {
      await collection.insertOne(document);
      return;
    }

    await collection.updateOne(
      { id: mongoPlatformStateDocumentId },
      {
        set: {
          version: document.version,
          tenants: document.tenants,
          accounts: document.accounts,
          data: document.data,
        },
      },
    );
    return;
  }

  if (!shouldUseTestFileFallback()) {
    throw new AppError(
      "Platformstate kan niet lokaal worden opgeslagen. Configureer MongoDB voor runtime data.",
      {
        code: "INVALID_INPUT",
      },
    );
  }

  const stateFilePath = getStateFilePath();
  await mkdir(path.dirname(stateFilePath), { recursive: true });
  const temporaryPath = `${stateFilePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(state, null, 2), "utf8");
  await rename(temporaryPath, stateFilePath);
}

async function withStateMutation<T>(
  mutate: (current: LocalPlatformState | null) => Promise<T>,
) {
  const nextStep = mutationQueue.then(async () => {
    const current = await readLocalPlatformState();
    return mutate(current);
  });

  mutationQueue = nextStep.then(
    () => undefined,
    () => undefined,
  );

  return nextStep;
}

export async function readLocalPlatformState(): Promise<LocalPlatformState | null> {
  const collection = await resolveMongoStateCollection();

  if (collection) {
    const document = await collection.findOne({ id: mongoPlatformStateDocumentId });

    if (!document) {
      return null;
    }

    if (document.version === 2 && "tenants" in document) {
      const migrated = migrateVersion2State(document);
      await persistState(migrated);
      return migrated;
    }

    if (document.version !== stateVersion || !("tenants" in document)) {
      throw new AppError("De platformstate in de database heeft een onverwachte versie.", {
        code: "INVALID_INPUT",
        details: { expectedVersion: stateVersion, actualVersion: document.version },
      });
    }

    const normalized = normalizeState(document);

    if (normalized.changed) {
      await persistState(normalized.state);
    }

    return normalized.state;
  }

  if (!shouldUseTestFileFallback()) {
    throw new AppError(
      "Platformstate kan niet lokaal worden gelezen. Configureer MONGODB_URI voor deze app.",
      {
        code: "INVALID_INPUT",
      },
    );
  }

  try {
    const raw = await readFile(getStateFilePath(), "utf8");

    if (!raw.trim()) {
      return null;
    }

    const parsed = JSON.parse(raw) as
      | PersistedLocalPlatformState
      | LegacyVersion2LocalPlatformState
      | LegacyLocalPlatformState;

    if (parsed.version === 1 && "tenant" in parsed) {
      const migrated = migrateLegacyState(parsed);
      await persistState(migrated);
      return migrated;
    }

    if (parsed.version === 2 && "tenants" in parsed) {
      const migrated = migrateVersion2State(parsed);
      await persistState(migrated);
      return migrated;
    }

    if (parsed.version !== stateVersion || !("tenants" in parsed)) {
      throw new AppError("De platformstate heeft een onverwachte versie.", {
        code: "INVALID_INPUT",
        details: { expectedVersion: stateVersion, actualVersion: parsed.version },
      });
    }

    const normalized = normalizeState(parsed);

    if (normalized.changed) {
      await persistState(normalized.state);
    }

    return normalized.state;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

export async function hasLocalPlatformSetup() {
  const state = await readLocalPlatformState();
  return (state?.tenants.length ?? 0) > 0;
}

export async function listLocalTenants() {
  const state = await readLocalPlatformState();
  return state?.tenants ?? [];
}

export async function bootstrapLocalPlatform(input: BootstrapPlatformInput) {
  return withStateMutation(async (current) => {
    const nextStateBase = current ?? createEmptyState();
    const tenantId = toTenantIdFromName(input.tenantName);

    if (nextStateBase.tenants.some((tenant) => tenant.id === tenantId)) {
      throw new AppError("Er bestaat al een gym met deze naam of slug.", {
        code: "INVALID_INPUT",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const tenant: LocalTenantProfile = {
      id: tenantId,
      name: input.tenantName.trim(),
      billing: createDefaultBillingSettings(),
      legal: createDefaultLegalComplianceSettings(),
      remoteAccess: createDefaultRemoteAccessSettings(),
      createdAt: now,
      updatedAt: now,
    };
    const ownerAccount: LocalPlatformAccount = {
      userId: accountIdGenerator.next(),
      tenantId,
      email: normalizeEmail(input.ownerEmail),
      displayName: input.ownerName.trim(),
      roleKey: "owner",
      passwordHash: hashPassword(input.password),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const nextState: LocalPlatformState = {
      ...nextStateBase,
      version: stateVersion,
      tenants: [...nextStateBase.tenants, tenant],
      accounts: [...nextStateBase.accounts, ownerAccount],
    };

    await persistState(nextState);
    return toTenantBootstrapResult(nextState, tenantId);
  });
}

export async function authenticateLocalAccount(
  email: string,
  password: string,
  tenantSlug?: string,
): Promise<AuthenticatedLocalAccount | null> {
  const state = await readLocalPlatformState();

  if (!state) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const candidateAccounts = state.accounts.filter(
    (entry) =>
      entry.status === "active" && normalizeEmail(entry.email) === normalizedEmail,
  );

  if (candidateAccounts.length === 0) {
    return null;
  }

  const scopedAccounts = tenantSlug
    ? candidateAccounts.filter(
        (entry) => toTenantSlug(entry.tenantId) === toTenantSlug(tenantSlug),
      )
    : candidateAccounts;

  const matchingAccounts = scopedAccounts.filter((entry) =>
    verifyPassword(password, entry.passwordHash),
  );

  if (matchingAccounts.length === 0) {
    return null;
  }

  const matchingTenants = matchingAccounts
    .map((account) => state.tenants.find((entry) => entry.id === account.tenantId) ?? null)
    .filter((tenant): tenant is LocalTenantProfile => tenant !== null);

  if (matchingTenants.length !== matchingAccounts.length) {
    return null;
  }

  if (matchingAccounts.length > 1 && !matchingAccounts.every(isMemberAccount)) {
    return null;
  }

  const [account] = matchingAccounts;
  const [tenant] = matchingTenants;

  if (!account || !tenant) {
    return null;
  }

  return {
    account,
    tenant,
    accounts: matchingAccounts,
    tenants: matchingTenants,
  };
}

export async function listLocalPlatformAccounts(tenantId?: string) {
  const state = await readLocalPlatformState();

  if (!state) {
    return [];
  }

  if (!tenantId) {
    return state.accounts;
  }

  return state.accounts.filter((account) => account.tenantId === tenantId);
}

export async function listLocalMemberPortalAccountsByEmail(email: string) {
  const state = await readLocalPlatformState();

  if (!state) {
    return [];
  }

  const normalizedEmail = normalizeEmail(email);
  return state.accounts.filter(
    (account) =>
      isMemberAccount(account) &&
      account.status === "active" &&
      account.linkedMemberId &&
      normalizeEmail(account.email) === normalizedEmail,
  );
}

export async function getLocalTenantProfile(tenantId?: string) {
  const state = await readLocalPlatformState();

  if (!state) {
    return null;
  }

  if (!tenantId) {
    return state.tenants[0] ?? null;
  }

  return state.tenants.find((tenant) => tenant.id === tenantId) ?? null;
}

export async function getLocalTenantProfileBySlug(tenantSlug: string) {
  const state = await readLocalPlatformState();

  if (!state) {
    return null;
  }

  return findTenantBySlug(state, tenantSlug) ?? null;
}

export async function createLocalPlatformAccount(
  tenantId: string,
  input: CreatePlatformAccountInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je teamaccounts toevoegt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor dit teamaccount.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const normalizedEmail = normalizeEmail(input.email);
    assertUniqueTenantEmail(current.accounts, tenant.id, normalizedEmail);

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
            }
          : entry,
      ),
      accounts: [
        ...current.accounts,
        {
          userId: accountIdGenerator.next(),
          tenantId: tenant.id,
          email: normalizedEmail,
          displayName: input.displayName.trim(),
          roleKey: input.roleKey,
          passwordHash: hashPassword(input.password),
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
    };

    await persistState(nextState);
    return toTenantBootstrapResult(nextState, tenant.id);
  });
}

export async function upsertLocalMemberPortalAccount(
  tenantId: string,
  input: UpsertMemberPortalAccountInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je ledenaccounts beheert.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor dit ledenaccount.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const existingAccount = current.accounts.find(
      (account) =>
        account.tenantId === tenant.id &&
        isMemberAccount(account) &&
        account.linkedMemberId === input.memberId,
    );
    const normalizedEmail = normalizeEmail(input.email);
    const passwordHash = hashPassword(input.password);
    assertUniqueTenantEmail(
      current.accounts,
      tenant.id,
      normalizedEmail,
      existingAccount?.userId,
    );

    const now = new Date().toISOString();
    const nextAccount: LocalPlatformAccount = existingAccount
      ? {
          ...existingAccount,
          displayName: input.displayName.trim(),
          email: normalizedEmail,
          passwordHash,
          status: "active",
          updatedAt: now,
        }
      : {
          userId: memberAccountIdGenerator.next(),
          tenantId: tenant.id,
          email: normalizedEmail,
          displayName: input.displayName.trim(),
          roleKey: "member",
          linkedMemberId: input.memberId,
          passwordHash,
          status: "active",
          createdAt: now,
          updatedAt: now,
        };

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenant.id ? { ...entry, updatedAt: now } : entry,
      ),
      accounts: (
        existingAccount
          ? current.accounts.map((account) =>
              account.userId === existingAccount.userId ? nextAccount : account,
            )
          : [...current.accounts, nextAccount]
      ).map((account) =>
        isMemberAccount(account) && normalizeEmail(account.email) === normalizedEmail
          ? {
              ...account,
              passwordHash,
              updatedAt: now,
            }
          : account,
      ),
    };

    await persistState(nextState);
    return nextAccount;
  });
}

export async function syncLocalMemberPortalAccount(
  tenantId: string,
  input: {
    readonly memberId: string;
    readonly displayName: string;
    readonly email: string;
    readonly status: "active" | "archived";
  },
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je ledenaccounts beheert.", {
        code: "FORBIDDEN",
      });
    }

    const existingAccount = current.accounts.find(
      (account) =>
        account.tenantId === tenantId &&
        isMemberAccount(account) &&
        account.linkedMemberId === input.memberId,
    );

    if (!existingAccount) {
      return null;
    }

    const normalizedEmail = normalizeEmail(input.email);
    assertUniqueTenantEmail(
      current.accounts,
      existingAccount.tenantId,
      normalizedEmail,
      existingAccount.userId,
    );

    const now = new Date().toISOString();
    const nextAccount: LocalPlatformAccount = {
      ...existingAccount,
      displayName: input.displayName.trim(),
      email: normalizedEmail,
      status: input.status,
      updatedAt: now,
    };
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === existingAccount.tenantId ? { ...entry, updatedAt: now } : entry,
      ),
      accounts: current.accounts.map((account) =>
        account.userId === existingAccount.userId ? nextAccount : account,
      ),
    };

    await persistState(nextState);
    return nextAccount;
  });
}

export async function deleteLocalMemberPortalAccountByMemberId(
  tenantId: string,
  memberId: string,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je ledenaccounts beheert.", {
        code: "FORBIDDEN",
      });
    }

    const matchingAccounts = current.accounts.filter(
      (account) =>
        account.tenantId === tenantId &&
        isMemberAccount(account) &&
        account.linkedMemberId === memberId,
    );

    if (matchingAccounts.length === 0) {
      return 0;
    }

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId ? { ...entry, updatedAt: now } : entry,
      ),
      accounts: current.accounts.filter(
        (account) =>
          !(
            account.tenantId === tenantId &&
            isMemberAccount(account) &&
            account.linkedMemberId === memberId
          ),
      ),
    };

    await persistState(nextState);
    return matchingAccounts.length;
  });
}

export async function updateLocalPlatformAccount(
  tenantId: string,
  input: UpdatePlatformAccountInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je teamaccounts beheert.", {
        code: "FORBIDDEN",
      });
    }

    const account = current.accounts.find(
      (entry) => entry.tenantId === tenantId && entry.userId === input.userId,
    );

    if (!account) {
      throw new AppError("Teamaccount niet gevonden binnen deze gym.", {
        code: "RESOURCE_NOT_FOUND",
        details: { userId: input.userId, tenantId },
      });
    }

    if (account.updatedAt !== input.expectedUpdatedAt) {
      throw new AppError("Teamaccount is al gewijzigd; laad eerst opnieuw.", {
        code: "VERSION_CONFLICT",
        details: {
          userId: input.userId,
          expectedUpdatedAt: input.expectedUpdatedAt,
          actualUpdatedAt: account.updatedAt,
        },
      });
    }

    const normalizedEmail = normalizeEmail(input.email);
    assertUniqueTenantEmail(current.accounts, account.tenantId, normalizedEmail, input.userId);

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((tenant) =>
        tenant.id === tenantId ? { ...tenant, updatedAt: now } : tenant,
      ),
      accounts: current.accounts.map((entry) =>
        entry.tenantId === tenantId && entry.userId === input.userId
          ? {
              ...entry,
              displayName: input.displayName.trim(),
              email: normalizedEmail,
              roleKey: input.roleKey,
              status: input.status,
              updatedAt: now,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return toTenantBootstrapResult(nextState, account.tenantId);
  });
}

export async function deleteLocalPlatformAccount(
  tenantId: string,
  input: { readonly userId: string; readonly expectedUpdatedAt: string },
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je teamaccounts beheert.", {
        code: "FORBIDDEN",
      });
    }

    const account = current.accounts.find(
      (entry) => entry.tenantId === tenantId && entry.userId === input.userId,
    );

    if (!account) {
      throw new AppError("Teamaccount niet gevonden binnen deze gym.", {
        code: "RESOURCE_NOT_FOUND",
        details: { userId: input.userId, tenantId },
      });
    }

    if (account.updatedAt !== input.expectedUpdatedAt) {
      throw new AppError("Teamaccount is al gewijzigd; laad eerst opnieuw.", {
        code: "VERSION_CONFLICT",
        details: {
          userId: input.userId,
          expectedUpdatedAt: input.expectedUpdatedAt,
          actualUpdatedAt: account.updatedAt,
        },
      });
    }

    if (
      account.roleKey === "owner" &&
      current.accounts.filter(
        (entry) =>
          entry.tenantId === tenantId &&
          entry.roleKey === "owner" &&
          entry.status === "active",
      ).length <= 1
    ) {
      throw new AppError("Je kunt de laatste actieve owner niet verwijderen.", {
        code: "FORBIDDEN",
      });
    }

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((tenant) =>
        tenant.id === tenantId ? { ...tenant, updatedAt: now } : tenant,
      ),
      accounts: current.accounts.filter(
        (entry) => !(entry.tenantId === tenantId && entry.userId === input.userId),
      ),
    };

    await persistState(nextState);
    return toTenantBootstrapResult(nextState, account.tenantId);
  });
}

export async function updateLocalTenantRemoteAccess(
  tenantId: string,
  input: UpdateLocalTenantRemoteAccessInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je remote toegang instelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor remote toegang.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextRemoteAccessBase = normalizeStoredRemoteAccessSettings({
      ...tenant.remoteAccess,
      ...input,
      allowedRoleKeys: input.allowedRoleKeys ?? tenant.remoteAccess.allowedRoleKeys,
      lastRemoteActionAt: tenant.remoteAccess.lastRemoteActionAt,
      lastRemoteActionBy: tenant.remoteAccess.lastRemoteActionBy,
    });
    const nextConnectionStatus = getRemoteAccessConnectionStatus(nextRemoteAccessBase);
    const nextRemoteAccess: StoredRemoteAccessSettings = {
      ...nextRemoteAccessBase,
      lastValidatedAt:
        nextConnectionStatus === "configured" ? now : undefined,
    };

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              remoteAccess: nextRemoteAccess,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantBillingSettings(
  tenantId: string,
  input: UpdateLocalTenantBillingSettingsInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je betalingen instelt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor betalingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextBillingBase = normalizeStoredBillingSettings({
      ...tenant.billing,
      ...input,
      lastPaymentActionAt: tenant.billing.lastPaymentActionAt,
      lastPaymentActionBy: tenant.billing.lastPaymentActionBy,
    });
    const nextBilling: StoredBillingSettings = {
      ...nextBillingBase,
      lastValidatedAt:
        nextBillingBase.profileLabel &&
        nextBillingBase.profileId &&
        nextBillingBase.supportEmail
          ? now
          : undefined,
    };

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              billing: nextBilling,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalTenantLegalSettings(
  tenantId: string,
  input: UpdateLocalTenantLegalSettingsInput,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je juridische instellingen opslaat.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor juridische instellingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextLegalBase = normalizeLegalComplianceSettings({
      ...tenant.legal,
      ...input,
      lastValidatedAt: tenant.legal.lastValidatedAt,
    });
    const nextLegal: StoredLegalComplianceSettings = {
      ...nextLegalBase,
      lastValidatedAt:
        nextLegalBase.termsUrl &&
        nextLegalBase.privacyUrl &&
        nextLegalBase.sepaCreditorId &&
        nextLegalBase.sepaMandateText &&
        nextLegalBase.contractPdfTemplateKey &&
        nextLegalBase.waiverStorageKey
          ? now
          : undefined,
    };

    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              legal: nextLegal,
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function markLocalTenantRemoteAccessAction(
  tenantId: string,
  actorName: string,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je remote toegang gebruikt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor remote toegang.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              remoteAccess: {
                ...entry.remoteAccess,
                lastRemoteActionAt: now,
                lastRemoteActionBy: actorName,
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function markLocalTenantBillingAction(
  tenantId: string,
  actorName: string,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je betalingen gebruikt.", {
        code: "FORBIDDEN",
      });
    }

    const tenant = current.tenants.find((entry) => entry.id === tenantId);

    if (!tenant) {
      throw new AppError("Gym niet gevonden voor betalingen.", {
        code: "RESOURCE_NOT_FOUND",
        details: { tenantId },
      });
    }

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((entry) =>
        entry.id === tenantId
          ? {
              ...entry,
              updatedAt: now,
              billing: {
                ...entry.billing,
                lastPaymentActionAt: now,
                lastPaymentActionBy: actorName,
              },
            }
          : entry,
      ),
    };

    await persistState(nextState);
    return nextState.tenants.find((entry) => entry.id === tenantId)!;
  });
}

export async function updateLocalPlatformData(
  update: (data: MemoryGymStoreState) => MemoryGymStoreState,
) {
  return withStateMutation(async (current) => {
    if (!current) {
      throw new AppError("Richt eerst het platform in voordat je data opslaat.", {
        code: "FORBIDDEN",
      });
    }

    const now = new Date().toISOString();
    const nextState: LocalPlatformState = {
      ...current,
      tenants: current.tenants.map((tenant) => ({
        ...tenant,
        updatedAt: now,
      })),
      data: update(current.data),
    };

    await persistState(nextState);
    return nextState;
  });
}
