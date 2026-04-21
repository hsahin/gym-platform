import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError, createPrefixedIdGenerator } from "@claimtech/core";
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
import type { PlatformRoleKey } from "@/server/runtime/platform-roles";
import type {
  BillingPaymentMethod,
  BillingProvider,
  RemoteAccessBridgeType,
  RemoteAccessProvider,
} from "@/server/types";
import {
  createEmptyGymStoreState,
  type MemoryGymStoreState,
} from "@/server/persistence/memory-gym-store";

const stateVersion = 2;
const accountIdGenerator = createPrefixedIdGenerator({ prefix: "staff" });

let mutationQueue = Promise.resolve();

export interface LocalTenantProfile {
  readonly id: TenantId;
  readonly name: string;
  readonly billing: StoredBillingSettings;
  readonly remoteAccess: StoredRemoteAccessSettings;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LocalPlatformAccount {
  readonly userId: string;
  readonly tenantId: TenantId;
  readonly email: string;
  readonly displayName: string;
  readonly roleKey: PlatformRoleKey;
  readonly passwordHash: string;
  readonly status: "active";
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

type LegacyLocalPlatformState = {
  readonly version: 1;
  readonly tenant: Omit<LocalTenantProfile, "remoteAccess" | "billing">;
  readonly accounts: ReadonlyArray<
    Omit<LocalPlatformAccount, "tenantId">
  >;
  readonly data: MemoryGymStoreState;
};

type PersistedLocalTenantProfile = Omit<LocalTenantProfile, "remoteAccess" | "billing"> & {
  readonly billing?: Partial<StoredBillingSettings>;
  readonly remoteAccess?: Partial<StoredRemoteAccessSettings>;
};

type PersistedLocalPlatformState = Omit<LocalPlatformState, "tenants"> & {
  readonly tenants: ReadonlyArray<PersistedLocalTenantProfile>;
};

function getStateFilePath() {
  return (
    process.env.LOCAL_PLATFORM_STATE_FILE ||
    path.join(process.cwd(), ".data", "gym-platform-state.json")
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
    throw new AppError("Tenant niet gevonden in de lokale platformstate.", {
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
    remoteAccess: normalizeStoredRemoteAccessSettings(tenant.remoteAccess),
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

    if (!tenant.remoteAccess || !tenant.billing) {
      changed = true;
    }

    return normalized;
  });

  return {
    state: {
      ...state,
      tenants,
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
        remoteAccess: createDefaultRemoteAccessSettings(),
      },
    ],
    accounts: parsed.accounts.map((account) => ({
      ...account,
      tenantId: parsed.tenant.id,
    })),
    data: parsed.data,
  };
}

async function persistState(state: LocalPlatformState) {
  const stateFilePath = getStateFilePath();
  await mkdir(path.dirname(stateFilePath), { recursive: true });
  await writeFile(stateFilePath, JSON.stringify(state, null, 2), "utf8");
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
  try {
    const raw = await readFile(getStateFilePath(), "utf8");
    const parsed = JSON.parse(raw) as PersistedLocalPlatformState | LegacyLocalPlatformState;

    if (parsed.version === 1 && "tenant" in parsed) {
      const migrated = migrateLegacyState(parsed);
      await persistState(migrated);
      return migrated;
    }

    if (parsed.version !== stateVersion || !("tenants" in parsed)) {
      throw new AppError("De lokale platformstate heeft een onverwachte versie.", {
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
) {
  const state = await readLocalPlatformState();

  if (!state) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const candidateAccounts = state.accounts.filter(
    (entry) => normalizeEmail(entry.email) === normalizedEmail,
  );

  if (candidateAccounts.length === 0) {
    return null;
  }

  const account = tenantSlug
    ? candidateAccounts.find(
        (entry) => toTenantSlug(entry.tenantId) === toTenantSlug(tenantSlug),
      )
    : candidateAccounts.length === 1
      ? candidateAccounts[0]
      : null;

  if (!account || !verifyPassword(password, account.passwordHash)) {
    return null;
  }

  const tenant = state.tenants.find((entry) => entry.id === account.tenantId);

  if (!tenant) {
    return null;
  }

  return {
    account,
    tenant,
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

    if (
      current.accounts.some(
        (account) =>
          account.tenantId === tenantId && normalizeEmail(account.email) === normalizedEmail,
      )
    ) {
      throw new AppError("Er bestaat al een account met dit e-mailadres binnen deze gym.", {
        code: "INVALID_INPUT",
        details: { email: normalizedEmail, tenantId },
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
