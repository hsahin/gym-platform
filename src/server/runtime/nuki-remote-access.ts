import { AppError } from "@claimtech/core";

const NUKI_API_BASE_URL = "https://api.nuki.io";

type FetchLike = typeof fetch;

interface NukiActionResponse {
  readonly id?: string;
  readonly actionId?: string;
  readonly status?: string;
}

export interface NukiUnlockInput {
  readonly smartlockId: string;
}

export interface NukiUnlockReceipt {
  readonly providerActionId: string;
  readonly providerStatus: string;
}

export interface NukiRemoteAccessProvider {
  unlock(input: NukiUnlockInput): Promise<NukiUnlockReceipt>;
}

export function isNukiRemoteAccessConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return Boolean(env.NUKI_API_TOKEN?.trim());
}

function parseNukiBody(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function createNukiRemoteAccessProvider(options?: {
  readonly apiToken?: string;
  readonly fetchImpl?: FetchLike;
  readonly apiBaseUrl?: string;
}): NukiRemoteAccessProvider {
  const apiToken = options?.apiToken?.trim() || process.env.NUKI_API_TOKEN?.trim();

  if (!apiToken) {
    throw new AppError("Nuki API-token ontbreekt.", {
      code: "INVALID_INPUT",
      details: {
        env: "NUKI_API_TOKEN",
      },
    });
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const apiBaseUrl =
    options?.apiBaseUrl?.replace(/\/+$/, "") ||
    process.env.NUKI_API_BASE_URL?.replace(/\/+$/, "") ||
    NUKI_API_BASE_URL;

  return {
    async unlock(input) {
      const smartlockId = input.smartlockId.trim();

      if (!smartlockId) {
        throw new AppError("Nuki smartlock-id ontbreekt.", {
          code: "INVALID_INPUT",
        });
      }

      const response = await fetchImpl(
        `${apiBaseUrl}/smartlock/${encodeURIComponent(smartlockId)}/action/unlock`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiToken}`,
            accept: "application/json",
          },
        },
      );
      const text = await response.text();
      const body = parseNukiBody(text);

      if (!response.ok) {
        throw new AppError("Nuki heeft de remote open actie geweigerd.", {
          code: "INVALID_INPUT",
          details: {
            status: response.status,
            body,
          },
        });
      }

      const actionBody =
        typeof body === "object" && body !== null ? (body as NukiActionResponse) : {};

      return {
        providerActionId:
          readString(actionBody.id) ||
          readString(actionBody.actionId) ||
          `nuki:${smartlockId}:unlock`,
        providerStatus: readString(actionBody.status) || "accepted",
      };
    },
  };
}
