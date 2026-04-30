import { AppError } from "@claimtech/core";
import type { BillingPaymentMethod } from "@/server/types";

const MOLLIE_API_BASE_URL = "https://api.mollie.com/v2";

type FetchLike = typeof fetch;

interface MollieLink {
  readonly href?: string;
}

interface MolliePaymentResponse {
  readonly id?: string;
  readonly status?: string;
  readonly metadata?: Record<string, unknown>;
  readonly _links?: {
    readonly checkout?: MollieLink;
  };
}

interface MollieRefundResponse {
  readonly id?: string;
  readonly status?: string;
}

export interface CreateMolliePaymentIntentInput {
  readonly amountCents: number;
  readonly currency: string;
  readonly description: string;
  readonly paymentMethod: BillingPaymentMethod;
  readonly redirectUrl: string;
  readonly webhookUrl: string;
  readonly profileId?: string;
  readonly metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface MolliePaymentIntent {
  readonly providerPaymentId: string;
  readonly checkoutUrl: string;
  readonly status: string;
}

export interface MolliePaymentStatus {
  readonly providerPaymentId: string;
  readonly status: string;
  readonly invoiceId?: string;
  readonly tenantId?: string;
}

export interface CreateMollieRefundInput {
  readonly amountCents: number;
  readonly currency: string;
  readonly description: string;
}

export interface MollieRefundReceipt {
  readonly providerRefundId: string;
  readonly status: string;
}

export interface MolliePaymentProvider {
  createPaymentIntent(input: CreateMolliePaymentIntentInput): Promise<MolliePaymentIntent>;
  getPayment(paymentId: string): Promise<MolliePaymentStatus>;
  createRefund(paymentId: string, input: CreateMollieRefundInput): Promise<MollieRefundReceipt>;
}

export function isMolliePaymentConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return Boolean(env.MOLLIE_API_KEY?.trim());
}

export function toMolliePaymentMethod(paymentMethod: BillingPaymentMethod) {
  if (paymentMethod === "direct_debit") {
    return "directdebit";
  }

  return undefined;
}

function formatMollieAmount(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

function compactMetadata(
  metadata?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!metadata) {
    return undefined;
  }

  const compacted = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined && value !== ""),
  );

  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseMollieErrorBody(text: string) {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function createMolliePaymentProvider(options?: {
  readonly apiKey?: string;
  readonly accessToken?: string;
  readonly fetchImpl?: FetchLike;
  readonly apiBaseUrl?: string;
  readonly testMode?: boolean;
}): MolliePaymentProvider {
  const apiKey = options?.apiKey?.trim() || process.env.MOLLIE_API_KEY?.trim();
  const accessToken = options?.accessToken?.trim();
  const bearerToken = accessToken || apiKey;

  if (!bearerToken) {
    throw new AppError("Mollie API-key ontbreekt.", {
      code: "INVALID_INPUT",
      details: {
        env: "MOLLIE_API_KEY",
      },
    });
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const apiBaseUrl = options?.apiBaseUrl ?? MOLLIE_API_BASE_URL;
  const testMode = Boolean(options?.testMode);

  function buildPath(path: string) {
    if (!testMode) {
      return path;
    }

    return `${path}${path.includes("?") ? "&" : "?"}testmode=true`;
  }

  async function request<TBody>(path: string, init?: RequestInit) {
    const response = await fetchImpl(`${apiBaseUrl}${buildPath(path)}`, {
      ...init,
      headers: {
        authorization: `Bearer ${bearerToken}`,
        accept: "application/json",
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();
    const body = parseMollieErrorBody(text);

    if (!response.ok) {
      throw new AppError("Mollie heeft de betaalactie geweigerd.", {
        code: "INVALID_INPUT",
        details: {
          status: response.status,
          body,
        },
      });
    }

    return body as TBody;
  }

  return {
    async createPaymentIntent(input) {
      const method = toMolliePaymentMethod(input.paymentMethod);
      const payload = {
        amount: {
          currency: input.currency.toUpperCase(),
          value: formatMollieAmount(input.amountCents),
        },
        description: input.description,
        redirectUrl: input.redirectUrl,
        webhookUrl: input.webhookUrl,
        ...(input.profileId?.trim() ? { profileId: input.profileId.trim() } : {}),
        ...(method ? { method } : {}),
        metadata: compactMetadata(input.metadata),
      };
      const response = await request<MolliePaymentResponse>("/payments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const providerPaymentId = response.id?.trim();
      const checkoutUrl = response._links?.checkout?.href?.trim();

      if (!providerPaymentId || !checkoutUrl) {
        throw new AppError("Mollie gaf geen geldige betaallink terug.", {
          code: "INVALID_INPUT",
          details: response,
        });
      }

      return {
        providerPaymentId,
        checkoutUrl,
        status: response.status ?? "open",
      };
    },
    async getPayment(paymentId) {
      const response = await request<MolliePaymentResponse>(
        `/payments/${encodeURIComponent(paymentId)}`,
      );
      const providerPaymentId = response.id?.trim() || paymentId;

      return {
        providerPaymentId,
        status: response.status ?? "unknown",
        invoiceId: readMetadataString(response.metadata, "invoiceId"),
        tenantId: readMetadataString(response.metadata, "tenantId"),
      };
    },
    async createRefund(paymentId, input) {
      const response = await request<MollieRefundResponse>(
        `/payments/${encodeURIComponent(paymentId)}/refunds`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: {
              currency: input.currency.toUpperCase(),
              value: formatMollieAmount(input.amountCents),
            },
            description: input.description,
          }),
        },
      );
      const providerRefundId = response.id?.trim();

      if (!providerRefundId) {
        throw new AppError("Mollie gaf geen geldige refundreferentie terug.", {
          code: "INVALID_INPUT",
          details: response,
        });
      }

      return {
        providerRefundId,
        status: response.status ?? "queued",
      };
    },
  };
}
