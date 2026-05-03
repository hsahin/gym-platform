import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createValkeyClient } from "@claimtech/cache";
import { AppError, createPrefixedIdGenerator } from "@claimtech/core";
import { buildRateLimitKey } from "@claimtech/ops";
import { ZodError } from "zod";
import {
  IDEMPOTENCY_HEADER,
  MUTATION_CSRF_HEADER,
  MUTATION_SECURITY_ERROR_MESSAGE,
} from "@/lib/mutation-security-constants";
import { allowsRuntimeFallbacks } from "@/server/runtime/production-readiness";

const requestIdGenerator = createPrefixedIdGenerator({ prefix: "req" });

export {
  IDEMPOTENCY_HEADER,
  MUTATION_CSRF_HEADER,
  MUTATION_SECURITY_ERROR_MESSAGE,
} from "@/lib/mutation-security-constants";
const CSRF_TOKEN_VERSION = "v1";
const DEFAULT_CSRF_TTL_SECONDS = 60 * 60 * 8;
const DEFAULT_RATE_LIMIT_TTL_SAFETY_SECONDS = 5;
const DEFAULT_RATE_LIMIT_TIMEOUT_MS = 1_000;
const LOCAL_DEVELOPMENT_CSRF_SECRET =
  "claimtech-gym-platform-local-development-csrf-secret";

interface MutationRateLimitCacheClient {
  incrBy(key: string, amount: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
}

let mutationRateLimitCachePromise: Promise<MutationRateLimitCacheClient> | undefined;
let mutationRateLimitCacheUrl: string | undefined;

class MemoryRateLimitCacheClient implements MutationRateLimitCacheClient {
  private readonly entries = new Map<
    string,
    {
      value: string;
      expiresAt?: number;
    }
  >();

  private purgeIfExpired(key: string) {
    const entry = this.entries.get(key);

    if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
    }
  }

  async incrBy(key: string, amount: number) {
    this.purgeIfExpired(key);
    const nextValue = Number(this.entries.get(key)?.value ?? "0") + amount;
    this.entries.set(key, { value: String(nextValue) });
    return nextValue;
  }

  async expire(key: string, ttlSeconds: number) {
    this.purgeIfExpired(key);
    const entry = this.entries.get(key);

    if (!entry) {
      return false;
    }

    this.entries.set(key, {
      ...entry,
      expiresAt: Date.now() + ttlSeconds * 1_000,
    });
    return true;
  }
}

interface MutationRateLimitOptions {
  readonly scope: string;
  readonly maxRequests: number;
  readonly windowMs: number;
}

export interface ApiSuccessEnvelope<TData> {
  readonly ok: true;
  readonly requestId: string;
  readonly data: TData;
}

export interface ApiErrorEnvelope {
  readonly ok: false;
  readonly requestId: string;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

interface AppErrorLike {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

function isAppErrorLike(error: unknown): error is AppErrorLike {
  if (error instanceof AppError) {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

function normalizeError(error: unknown) {
  if (error instanceof ZodError) {
    return new AppError("De invoer is ongeldig.", {
      code: "INVALID_INPUT",
      details: error.flatten(),
    });
  }

  return error;
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMutationCsrfSecret() {
  const configuredSecret =
    process.env.CLAIMTECH_CSRF_SECRET?.trim() ||
    process.env.CLAIMTECH_SESSION_SECRET?.trim();

  if (
    configuredSecret &&
    configuredSecret !== "replace-me" &&
    configuredSecret !== "claimtech-gym-platform-local-secret"
  ) {
    return configuredSecret;
  }

  if (allowsRuntimeFallbacks()) {
    return LOCAL_DEVELOPMENT_CSRF_SECRET;
  }

  throw new AppError("CSRF-beveiliging mist een sterke server secret.", {
    code: "INVALID_INPUT",
    details: {
      missingEnv: ["CLAIMTECH_CSRF_SECRET", "CLAIMTECH_SESSION_SECRET"],
    },
  });
}

function signMutationCsrfPayload(payload: string) {
  return createHmac("sha256", getMutationCsrfSecret())
    .update(payload)
    .digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.byteLength === rightBuffer.byteLength &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function getMutationCsrfMaxAgeSeconds() {
  return getPositiveIntegerEnv(
    "CLAIMTECH_CSRF_MAX_AGE_SECONDS",
    DEFAULT_CSRF_TTL_SECONDS,
  );
}

export function createMutationCsrfToken(now = Date.now()) {
  const payload = `${CSRF_TOKEN_VERSION}.${now}.${randomUUID()}`;
  const signature = signMutationCsrfPayload(payload);

  return `${payload}.${signature}`;
}

export function verifyMutationCsrfToken(token: string | null | undefined, now = Date.now()) {
  if (!token) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 4 || parts[0] !== CSRF_TOKEN_VERSION) {
    return false;
  }

  const issuedAt = Number(parts[1]);

  if (!Number.isFinite(issuedAt)) {
    return false;
  }

  const maxAgeMs = getMutationCsrfMaxAgeSeconds() * 1_000;

  if (issuedAt > now + 30_000 || now - issuedAt > maxAgeMs) {
    return false;
  }

  const payload = parts.slice(0, 3).join(".");
  const expectedSignature = signMutationCsrfPayload(payload);

  return safeEqual(expectedSignature, parts[3] ?? "");
}

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id")?.trim() || requestIdGenerator.next();
}

function readRequestOrigin(request: Request) {
  const directOrigin = request.headers.get("origin")?.trim();

  if (directOrigin) {
    return directOrigin;
  }

  const referer = request.headers.get("referer")?.trim();

  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function firstHeaderValue(value: string | null) {
  return value
    ?.split(",")[0]
    ?.trim()
    .toLowerCase() || null;
}

function readForwardedHost(request: Request) {
  const forwarded = request.headers.get("forwarded");

  if (!forwarded) {
    return null;
  }

  const hostPart = forwarded
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith("host="));

  return hostPart?.slice(5).replace(/^"|"$/g, "").toLowerCase() || null;
}

function readExpectedMutationHosts(request: Request) {
  return new Set(
    [
      firstHeaderValue(request.headers.get("host")),
      firstHeaderValue(request.headers.get("x-forwarded-host")),
      firstHeaderValue(request.headers.get("x-original-host")),
      readForwardedHost(request),
      new URL(request.url).host.toLowerCase(),
    ].filter((host): host is string => Boolean(host)),
  );
}

function assertSameOriginMutation(request: Request) {
  const origin = readRequestOrigin(request);

  if (!origin) {
    return;
  }

  let originHost: string;

  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    throw new AppError(MUTATION_SECURITY_ERROR_MESSAGE, {
      code: "FORBIDDEN",
      details: {
        origin,
        reason: "malformed-origin",
      },
    });
  }

  const expectedHosts = readExpectedMutationHosts(request);

  if (!expectedHosts.has(originHost)) {
    throw new AppError(
      MUTATION_SECURITY_ERROR_MESSAGE,
      {
        code: "FORBIDDEN",
        details: {
          origin,
          expectedHosts: [...expectedHosts],
        },
      },
    );
  }
}

function resolveClientIdentifier(request: Request) {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("user-agent")?.trim() ||
    new URL(request.url).host
  );
}

async function withRateLimitTimeout<T>(operation: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutMs = getPositiveIntegerEnv(
    "CLAIMTECH_RATE_LIMIT_TIMEOUT_MS",
    DEFAULT_RATE_LIMIT_TIMEOUT_MS,
  );
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Mutation rate limit timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function getMutationRateLimitCache() {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (!redisUrl) {
    if (allowsRuntimeFallbacks()) {
      if (!mutationRateLimitCachePromise || mutationRateLimitCacheUrl !== "memory") {
        mutationRateLimitCacheUrl = "memory";
        mutationRateLimitCachePromise = Promise.resolve(new MemoryRateLimitCacheClient());
      }

      return mutationRateLimitCachePromise;
    }

    throw new AppError("REDIS_URL is verplicht voor veilige rate limiting.", {
      code: "INVALID_INPUT",
    });
  }

  if (!mutationRateLimitCachePromise || mutationRateLimitCacheUrl !== redisUrl) {
    mutationRateLimitCacheUrl = redisUrl;
    mutationRateLimitCachePromise = createValkeyClient({
      url: redisUrl,
      name: "gym-platform-mutation-security",
      socket: {
        connectTimeout: getPositiveIntegerEnv("CLAIMTECH_REDIS_CONNECT_TIMEOUT_MS", 1500),
        reconnectStrategy: (retries) => Math.min(retries * 100, 1000),
      },
    });
  }

  return mutationRateLimitCachePromise;
}

async function enforceMutationRateLimit(
  request: Request,
  rateLimit: MutationRateLimitOptions,
) {
  const cache = await getMutationRateLimitCache();
  const key = buildRateLimitKey({
    scope: rateLimit.scope,
    identifier: resolveClientIdentifier(request),
    fallbackIdentifier: new URL(request.url).pathname,
  });
  const currentCount = await withRateLimitTimeout(cache.incrBy(key, 1));

  if (currentCount === 1) {
    await withRateLimitTimeout(
      cache.expire(
        key,
        Math.ceil(rateLimit.windowMs / 1_000) + DEFAULT_RATE_LIMIT_TTL_SAFETY_SECONDS,
      ),
    );
  }

  if (currentCount > rateLimit.maxRequests) {
    throw new AppError("Te veel mutaties in korte tijd. Probeer het zo opnieuw.", {
      code: "RATE_LIMIT_EXCEEDED",
      details: {
        scope: rateLimit.scope,
        maxRequests: rateLimit.maxRequests,
        windowMs: rateLimit.windowMs,
      },
    });
  }
}

export function requireMutationSecurity(
  request: Request,
  options?: {
    readonly rateLimit?: MutationRateLimitOptions;
  },
) {
  const csrfToken = request.headers.get(MUTATION_CSRF_HEADER);
  const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER)?.trim();

  if (!verifyMutationCsrfToken(csrfToken)) {
    throw new AppError(MUTATION_SECURITY_ERROR_MESSAGE, {
      code: "CSRF_TOKEN_MISSING",
      details: {
        expectedHeader: MUTATION_CSRF_HEADER,
      },
    });
  }

  if (!idempotencyKey) {
    throw new AppError(MUTATION_SECURITY_ERROR_MESSAGE, {
      code: "IDEMPOTENCY_KEY_MISSING",
      details: {
        expectedHeader: IDEMPOTENCY_HEADER,
      },
    });
  }

  assertSameOriginMutation(request);

  if (options?.rateLimit) {
    throw new AppError(
      "Gebruik requireRateLimitedMutationSecurity voor publieke rate limits.",
      {
        code: "INVALID_INPUT",
      },
    );
  }

  return { idempotencyKey };
}

export async function requireRateLimitedMutationSecurity(
  request: Request,
  options: {
    readonly rateLimit: MutationRateLimitOptions;
  },
) {
  const result = requireMutationSecurity(request);
  await enforceMutationRateLimit(request, options.rateLimit);

  return result;
}

function toStatusCode(error: unknown) {
  if (!isAppErrorLike(error)) {
    return 500;
  }

  switch (error.code) {
    case "AUTH_REQUIRED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "CSRF_TOKEN_MISSING":
    case "IDEMPOTENCY_KEY_MISSING":
    case "INVALID_INPUT":
      return 400;
    case "RESOURCE_NOT_FOUND":
      return 404;
    case "VERSION_CONFLICT":
      return 409;
    case "RATE_LIMIT_EXCEEDED":
      return 429;
    default:
      return 500;
  }
}

function toErrorEnvelope(requestId: string, error: unknown): ApiErrorEnvelope {
  if (isAppErrorLike(error)) {
    return {
      ok: false,
      requestId,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  return {
    ok: false,
    requestId,
    error: {
      code: "UNEXPECTED_ERROR",
      message: "Er is iets onverwachts misgegaan.",
    },
  };
}

export function jsonOk<TData>(
  requestId: string,
  data: TData,
  init?: ResponseInit,
) {
  return Response.json(
    {
      ok: true,
      requestId,
      data,
    } satisfies ApiSuccessEnvelope<TData>,
    {
      status: init?.status ?? 200,
      headers: {
        "cache-control": "no-store",
        ...(init?.headers ?? {}),
      },
    },
  );
}

export function jsonError(requestId: string, error: unknown) {
  const normalizedError = normalizeError(error);

  return Response.json(toErrorEnvelope(requestId, normalizedError), {
    status: toStatusCode(normalizedError),
    headers: {
      "cache-control": "no-store",
    },
  });
}

async function reportApiError(request: Request, requestId: string, error: unknown) {
  const webhookUrl = process.env.MONITORING_WEBHOOK_URL;

  if (!webhookUrl) {
    if (process.env.NODE_ENV !== "test") {
      console.error("API error", {
        requestId,
        url: request.url,
        method: request.method,
        error,
      });
    }
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId,
        method: request.method,
        url: request.url,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      }),
    });
  } catch (reportError) {
    console.error("Failed to report API error", { requestId, reportError });
  }
}

export async function runApiHandler<TData>(
  request: Request,
  handler: (requestId: string) => Promise<TData>,
  options?: {
    readonly successStatus?: number;
  },
) {
  const requestId = getRequestId(request);

  try {
    const data = await handler(requestId);
    return jsonOk(requestId, data, { status: options?.successStatus ?? 200 });
  } catch (error) {
    await reportApiError(request, requestId, error);
    return jsonError(requestId, error);
  }
}
