"use client";

import {
  MUTATION_SECURITY_ERROR_MESSAGE,
  MUTATION_CSRF_TOKEN,
} from "@/server/http/platform-api";

const MUTATION_FALLBACK_ERROR_MESSAGE =
  "Opslaan is niet gelukt. Controleer je invoer en probeer het opnieuw.";

const SECURITY_ERROR_CODES = new Set([
  "FORBIDDEN",
  "CSRF_TOKEN_MISSING",
  "IDEMPOTENCY_KEY_MISSING",
]);

interface DashboardMutationResult<TResponse> {
  readonly ok: boolean;
  readonly data?: TResponse;
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
}

async function readMutationResult<TResponse>(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {
      ok: false,
      error: {
        message:
          response.status === 401
            ? "Je sessie is verlopen. Log opnieuw in en probeer het nog een keer."
            : MUTATION_FALLBACK_ERROR_MESSAGE,
      },
    } satisfies DashboardMutationResult<TResponse>;
  }

  try {
    return (await response.json()) as DashboardMutationResult<TResponse>;
  } catch {
    return {
      ok: false,
      error: {
        message: MUTATION_FALLBACK_ERROR_MESSAGE,
      },
    } satisfies DashboardMutationResult<TResponse>;
  }
}

function toDashboardMutationMessage<TResponse>(
  response: Response,
  result: DashboardMutationResult<TResponse>,
) {
  if (result.error?.code && SECURITY_ERROR_CODES.has(result.error.code)) {
    return MUTATION_SECURITY_ERROR_MESSAGE;
  }

  if (response.status === 401) {
    return "Je sessie is verlopen. Log opnieuw in en probeer het nog een keer.";
  }

  return result.error?.message || MUTATION_FALLBACK_ERROR_MESSAGE;
}

export async function submitDashboardMutation<TResponse>(
  url: string,
  payload: unknown,
  options?: {
    readonly method?: "POST" | "PATCH" | "DELETE";
  },
) {
  const response = await fetch(url, {
    method: options?.method ?? "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
      "x-idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });
  const result = await readMutationResult<TResponse>(response);

  if (!response.ok || !result.ok) {
    throw new Error(toDashboardMutationMessage(response, result));
  }

  return result.data as TResponse;
}

export function parseCommaList(input: string) {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
