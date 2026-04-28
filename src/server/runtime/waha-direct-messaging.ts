import { AppError } from "@claimtech/core";
import type {
  MessageReceipt,
  MessagingProvider,
  OutboundMessage,
} from "@claimtech/messaging";

const WAHA_ENV_NAMES = ["WAHA_BASE_URL", "WAHA_API_KEY"] as const;
const DEFAULT_WAHA_SESSION = "default";

type FetchImplementation = typeof fetch;

export interface WahaConfiguration {
  readonly configured: boolean;
  readonly missingEnv: ReadonlyArray<(typeof WAHA_ENV_NAMES)[number]>;
  readonly session: string;
}

export interface DirectWahaWhatsAppProviderOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly session?: string;
  readonly fetchImpl?: FetchImplementation;
}

function isPresent(value: string | undefined) {
  return Boolean(value?.trim());
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function buildHeaders(apiKey: string) {
  return {
    "X-Api-Key": apiKey,
    "content-type": "application/json",
  };
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function createWahaError(message: string, details?: Readonly<Record<string, unknown>>) {
  return new AppError(message, {
    code: "INVALID_INPUT",
    details,
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function getProviderMessageId(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const directId = value.id ?? value.messageId;

  if (typeof directId === "string" && directId.trim()) {
    return directId;
  }

  const key = value.key;

  if (isRecord(key) && typeof key.id === "string" && key.id.trim()) {
    return key.id;
  }

  return undefined;
}

function hasExistingRecipient(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  return value.numberExists === true || value.exists === true || value.result === true;
}

export function validateWahaConfig(
  env: Partial<Record<string, string | undefined>> = process.env,
): WahaConfiguration {
  const missingEnv = WAHA_ENV_NAMES.filter((name) => !isPresent(env[name]));

  return {
    configured: missingEnv.length === 0,
    missingEnv,
    session: env.WAHA_SESSION?.trim() || DEFAULT_WAHA_SESSION,
  };
}

export function normalizeWahaPhone(phone: string) {
  let normalized = phone.replace(/\D/g, "");

  if (normalized.startsWith("00")) {
    normalized = normalized.slice(2);
  } else if (normalized.startsWith("0")) {
    normalized = `31${normalized.slice(1)}`;
  }

  if (!/^\d{8,15}$/.test(normalized)) {
    throw createWahaError("Ongeldig WhatsApp nummer.");
  }

  return normalized;
}

export function isWahaSessionHealthy(session: unknown) {
  if (!isRecord(session)) {
    return false;
  }

  const engine = session.engine;

  return (
    session.status === "WORKING" ||
    session.state === "CONNECTED" ||
    (isRecord(engine) && engine.state === "CONNECTED")
  );
}

class DirectWahaWhatsAppProvider implements MessagingProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly session: string;
  private readonly fetchImpl: FetchImplementation;

  constructor(options: DirectWahaWhatsAppProviderOptions) {
    if (!options.baseUrl.trim() || !options.apiKey.trim()) {
      throw createWahaError("WAHA configuratie mist WAHA_BASE_URL of WAHA_API_KEY.");
    }

    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    this.session = options.session?.trim() || DEFAULT_WAHA_SESSION;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(message: OutboundMessage): Promise<MessageReceipt> {
    const normalizedPhone = normalizeWahaPhone(message.recipient);
    await this.assertHealthySession();
    await this.assertRecipientExists(normalizedPhone);

    const response = await this.fetchImpl(`${this.baseUrl}/api/sendText`, {
      method: "POST",
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify({
        chatId: `${normalizedPhone}@c.us`,
        reply_to: null,
        text: message.body,
        linkPreview: true,
        linkPreviewHighQuality: false,
        session: this.session,
      }),
    });
    const raw = await readJsonResponse(response);

    if (!response.ok) {
      throw createWahaError("WAHA bericht kon niet worden verzonden.", {
        status: response.status,
      });
    }

    return {
      accepted: true,
      status: "sent",
      providerMessageId: getProviderMessageId(raw),
      raw,
    };
  }

  private async assertHealthySession() {
    const response = await this.fetchImpl(`${this.baseUrl}/api/sessions/${this.session}`, {
      method: "GET",
      headers: buildHeaders(this.apiKey),
    });
    const raw = await readJsonResponse(response);

    if (!response.ok) {
      throw createWahaError("WAHA sessie kon niet worden gecontroleerd.", {
        status: response.status,
      });
    }

    if (!isWahaSessionHealthy(raw)) {
      throw createWahaError("WAHA sessie is niet verbonden.");
    }
  }

  private async assertRecipientExists(normalizedPhone: string) {
    const url = new URL(`${this.baseUrl}/api/contacts/check-exists`);
    url.searchParams.set("phone", normalizedPhone);
    url.searchParams.set("session", this.session);

    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: buildHeaders(this.apiKey),
    });
    const raw = await readJsonResponse(response);

    if (!response.ok) {
      throw createWahaError("WAHA ontvanger kon niet worden gecontroleerd.", {
        status: response.status,
      });
    }

    if (!hasExistingRecipient(raw)) {
      throw createWahaError("WhatsApp ontvanger bestaat niet of is niet bereikbaar.");
    }
  }
}

export function createDirectWahaWhatsAppProvider(
  options: DirectWahaWhatsAppProviderOptions,
): MessagingProvider {
  return new DirectWahaWhatsAppProvider(options);
}
