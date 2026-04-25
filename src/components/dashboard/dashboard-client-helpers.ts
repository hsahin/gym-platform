"use client";

import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";

export async function submitDashboardMutation<TResponse>(
  url: string,
  payload: unknown,
  options?: {
    readonly method?: "POST" | "PATCH" | "DELETE";
  },
) {
  const response = await fetch(url, {
    method: options?.method ?? "POST",
    headers: {
      "content-type": "application/json",
      "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
      "x-idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as {
    ok: boolean;
    data?: TResponse;
    error?: {
      message: string;
    };
  };

  if (!response.ok || !result.ok) {
    throw new Error(result.error?.message ?? "Opslaan is mislukt.");
  }

  return result.data as TResponse;
}

export function parseCommaList(input: string) {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
