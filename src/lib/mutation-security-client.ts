"use client";

import {
  IDEMPOTENCY_HEADER,
  MUTATION_CSRF_HEADER,
} from "@/lib/mutation-security-constants";

interface CsrfTokenResponse {
  readonly ok: boolean;
  readonly data?: {
    readonly csrfToken: string;
    readonly expiresInSeconds: number;
  };
}

let cachedToken:
  | {
      readonly token: string;
      readonly expiresAt: number;
    }
  | undefined;

async function getMutationCsrfToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const response = await fetch("/api/security/csrf", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = (await response.json()) as CsrfTokenResponse;

  if (!response.ok || !payload.ok || !payload.data?.csrfToken) {
    throw new Error("Beveiliging kon niet worden voorbereid. Vernieuw de pagina.");
  }

  cachedToken = {
    token: payload.data.csrfToken,
    expiresAt: Date.now() + payload.data.expiresInSeconds * 1_000,
  };

  return cachedToken.token;
}

export async function buildMutationHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  return {
    "content-type": "application/json",
    [MUTATION_CSRF_HEADER]: await getMutationCsrfToken(),
    [IDEMPOTENCY_HEADER]: crypto.randomUUID(),
    ...extra,
  };
}

export function resetMutationSecurityClientForTests() {
  cachedToken = undefined;
}
