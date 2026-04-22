import { AppError, createPrefixedIdGenerator } from "@claimtech/core";
import { ZodError } from "zod";

const requestIdGenerator = createPrefixedIdGenerator({ prefix: "req" });

export const MUTATION_CSRF_HEADER = "x-claimtech-csrf";
export const MUTATION_CSRF_TOKEN = "claimtech-gym-platform";
export const IDEMPOTENCY_HEADER = "x-idempotency-key";

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

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id")?.trim() || requestIdGenerator.next();
}

export function requireMutationSecurity(request: Request) {
  const csrfToken = request.headers.get(MUTATION_CSRF_HEADER);
  const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER)?.trim();

  if (csrfToken !== MUTATION_CSRF_TOKEN) {
    throw new AppError("CSRF header ontbreekt of is ongeldig.", {
      code: "CSRF_TOKEN_MISSING",
      details: {
        expectedHeader: MUTATION_CSRF_HEADER,
      },
    });
  }

  if (!idempotencyKey) {
    throw new AppError("Idempotency key ontbreekt voor deze mutatie.", {
      code: "IDEMPOTENCY_KEY_MISSING",
      details: {
        expectedHeader: IDEMPOTENCY_HEADER,
      },
    });
  }

  return { idempotencyKey };
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
