import { AppError } from "@claimtech/core";

const MOLLIE_API_BASE_URL = "https://api.mollie.com/v2";
const MOLLIE_OAUTH_BASE_URL = "https://api.mollie.com/oauth2";
const MOLLIE_AUTHORIZE_URL = "https://my.mollie.com/oauth2/authorize";
export const DEFAULT_MOLLIE_CONNECT_REDIRECT_URL =
  "https://gym-platform-vc9yk.ondigitalocean.app/api/mollie/redirect";

type FetchLike = typeof fetch;

interface MollieTokenResponse {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
  readonly scope?: string;
  readonly token_type?: string;
}

interface MollieClientLinkResponse {
  readonly id?: string;
  readonly _links?: {
    readonly clientLink?: {
      readonly href?: string;
    };
  };
}

interface MollieProfileResponse {
  readonly id?: string;
  readonly name?: string;
  readonly website?: string;
  readonly status?: string;
}

interface MollieProfilesResponse {
  readonly _embedded?: {
    readonly profiles?: ReadonlyArray<MollieProfileResponse>;
  };
}

interface MollieCustomerResponse {
  readonly id?: string;
  readonly name?: string;
  readonly email?: string;
}

interface MollieCustomersResponse {
  readonly _embedded?: {
    readonly customers?: ReadonlyArray<MollieCustomerResponse>;
  };
}

interface MollieMandateResponse {
  readonly id?: string;
  readonly method?: string;
  readonly status?: string;
  readonly signatureDate?: string;
}

interface MollieMandatesResponse {
  readonly _embedded?: {
    readonly mandates?: ReadonlyArray<MollieMandateResponse>;
  };
}

export interface MollieConnectTokenSet {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
  readonly scope: string;
  readonly tokenType: string;
}

export interface MollieConnectProfile {
  readonly id: string;
  readonly name: string;
  readonly website?: string;
  readonly status?: string;
}

export interface MollieConnectCustomer {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
}

export interface MollieConnectMandate {
  readonly id: string;
  readonly method: string;
  readonly status: string;
  readonly signatureDate?: string;
}

export interface MollieClientLinkOwnerInput {
  readonly name: string;
  readonly email?: string;
  readonly address: {
    readonly streetAndNumber: string;
    readonly postalCode: string;
    readonly city: string;
    readonly country: string;
  };
  readonly registrationNumber?: string | null;
  readonly vatNumber?: string | null;
  readonly legalEntity: string;
  readonly registrationOffice: string;
  readonly incorporationDate?: string | null;
}

export interface MollieClientLinkReceipt {
  readonly id: string;
  readonly clientLinkUrl: string;
  readonly onboardingUrl: string;
}

export interface MollieConnectClient {
  exchangeAuthorizationCode(code: string): Promise<MollieConnectTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<MollieConnectTokenSet>;
  createClientLink(input: {
    readonly owner: MollieClientLinkOwnerInput;
    readonly state: string;
  }): Promise<MollieClientLinkReceipt>;
  listProfiles(accessToken: string): Promise<ReadonlyArray<MollieConnectProfile>>;
  listCustomers(accessToken: string): Promise<ReadonlyArray<MollieConnectCustomer>>;
  listMandates(
    accessToken: string,
    customerId: string,
  ): Promise<ReadonlyArray<MollieConnectMandate>>;
}

export const MOLLIE_CONNECT_SCOPES = [
  "payments.read",
  "payments.write",
  "refunds.read",
  "refunds.write",
  "payment-links.read",
  "payment-links.write",
  "customers.read",
  "customers.write",
  "mandates.read",
  "mandates.write",
  "subscriptions.read",
  "subscriptions.write",
  "organizations.read",
  "organizations.write",
  "profiles.read",
  "profiles.write",
  "onboarding.read",
  "onboarding.write",
  "invoices.read",
  "settlements.read",
  "balances.read",
  "webhooks.read",
  "webhooks.write",
] as const;

export function isMollieTestMode(
  env: Record<string, string | undefined> = process.env,
) {
  const value = env.MOLLIE_TEST_MODE?.trim().toLowerCase();

  return value !== "false" && value !== "0" && value !== "live";
}

export function resolveMollieConnectRedirectUrl(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.MOLLIE_CONNECT_REDIRECT_URL?.trim() ||
    (env.APP_BASE_URL?.trim()
      ? `${env.APP_BASE_URL.trim().replace(/\/+$/g, "")}/api/mollie/redirect`
      : DEFAULT_MOLLIE_CONNECT_REDIRECT_URL)
  );
}

export function isMollieConnectConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return Boolean(env.MOLLIE_CLIENT_ID?.trim() && env.MOLLIE_CLIENT_SECRET?.trim());
}

export function isMollieClientLinksConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return Boolean(isMollieConnectConfigured(env) && env.MOLLIE_ORGANIZATION_ACCESS_TOKEN?.trim());
}

export function getMollieConnectScopeString(
  scopes: ReadonlyArray<string> = MOLLIE_CONNECT_SCOPES,
) {
  return Array.from(new Set(scopes)).join(" ");
}

export function buildMollieConnectAuthorizationUrl(input: {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly scopes?: ReadonlyArray<string>;
  readonly approvalPrompt?: "auto" | "force";
  readonly testMode?: boolean;
}) {
  const url = new URL(MOLLIE_AUTHORIZE_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", getMollieConnectScopeString(input.scopes));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", input.approvalPrompt ?? "auto");

  if (input.testMode) {
    url.searchParams.set("testmode", "true");
  }

  return url.toString();
}

function parseMollieBody(text: string) {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function buildBasicAuthorization(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function appendTestMode(path: string, testMode: boolean) {
  if (!testMode) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}testmode=true`;
}

function normalizeTokenResponse(
  response: MollieTokenResponse,
): MollieConnectTokenSet {
  const accessToken = response.access_token?.trim();
  const refreshToken = response.refresh_token?.trim();

  if (!accessToken || !refreshToken) {
    throw new AppError("Mollie gaf geen geldige OAuth tokens terug.", {
      code: "INVALID_INPUT",
      details: response,
    });
  }

  const expiresInSeconds =
    typeof response.expires_in === "number" && response.expires_in > 0
      ? response.expires_in
      : 3600;

  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    scope: response.scope?.trim() || "",
    tokenType: response.token_type?.trim() || "Bearer",
  };
}

function normalizeProfile(profile: MollieProfileResponse): MollieConnectProfile | null {
  const id = profile.id?.trim();

  if (!id) {
    return null;
  }

  return {
    id,
    name: profile.name?.trim() || profile.website?.trim() || id,
    website: profile.website?.trim() || undefined,
    status: profile.status?.trim() || undefined,
  };
}

function normalizeCustomer(customer: MollieCustomerResponse): MollieConnectCustomer | null {
  const id = customer.id?.trim();

  if (!id) {
    return null;
  }

  return {
    id,
    name: customer.name?.trim() || customer.email?.trim() || id,
    email: customer.email?.trim().toLowerCase() || undefined,
  };
}

function normalizeMandate(mandate: MollieMandateResponse): MollieConnectMandate | null {
  const id = mandate.id?.trim();

  if (!id) {
    return null;
  }

  return {
    id,
    method: mandate.method?.trim() || "unknown",
    status: mandate.status?.trim() || "unknown",
    signatureDate: mandate.signatureDate?.trim() || undefined,
  };
}

export function createMollieConnectClient(options?: {
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly organizationAccessToken?: string;
  readonly redirectUri?: string;
  readonly fetchImpl?: FetchLike;
  readonly apiBaseUrl?: string;
  readonly oauthBaseUrl?: string;
  readonly testMode?: boolean;
}): MollieConnectClient {
  const clientId = options?.clientId?.trim() || process.env.MOLLIE_CLIENT_ID?.trim();
  const clientSecret =
    options?.clientSecret?.trim() || process.env.MOLLIE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new AppError("Mollie OAuth client credentials ontbreken.", {
      code: "INVALID_INPUT",
      details: {
        env: "MOLLIE_CLIENT_ID,MOLLIE_CLIENT_SECRET",
      },
    });
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const apiBaseUrl = options?.apiBaseUrl ?? MOLLIE_API_BASE_URL;
  const oauthBaseUrl = options?.oauthBaseUrl ?? MOLLIE_OAUTH_BASE_URL;
  const redirectUri = options?.redirectUri ?? resolveMollieConnectRedirectUrl();
  const testMode = options?.testMode ?? isMollieTestMode();
  const basicAuthorization = buildBasicAuthorization(clientId, clientSecret);

  async function request<TBody>(
    baseUrl: string,
    path: string,
    init?: RequestInit,
  ) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const body = parseMollieBody(await response.text());

    if (!response.ok) {
      throw new AppError("Mollie Connect heeft de aanvraag geweigerd.", {
        code: "INVALID_INPUT",
        details: {
          status: response.status,
          body,
        },
      });
    }

    return body as TBody;
  }

  async function requestToken(payload: Record<string, string>) {
    const response = await request<MollieTokenResponse>(oauthBaseUrl, "/tokens", {
      method: "POST",
      headers: {
        authorization: basicAuthorization,
      },
      body: JSON.stringify(payload),
    });

    return normalizeTokenResponse(response);
  }

  return {
    exchangeAuthorizationCode(code) {
      return requestToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      });
    },
    refreshAccessToken(refreshToken) {
      return requestToken({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        redirect_uri: redirectUri,
      });
    },
    async createClientLink(input) {
      const organizationAccessToken =
        options?.organizationAccessToken?.trim() ||
        process.env.MOLLIE_ORGANIZATION_ACCESS_TOKEN?.trim();

      if (!organizationAccessToken) {
        throw new AppError("Mollie organization access token ontbreekt.", {
          code: "INVALID_INPUT",
          details: {
            env: "MOLLIE_ORGANIZATION_ACCESS_TOKEN",
          },
        });
      }

      const response = await request<MollieClientLinkResponse>(
        apiBaseUrl,
        appendTestMode("/client-links", testMode),
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${organizationAccessToken}`,
          },
          body: JSON.stringify({
            owner: input.owner,
          }),
        },
      );
      const id = response.id?.trim();
      const clientLinkUrl = response._links?.clientLink?.href?.trim();

      if (!id || !clientLinkUrl) {
        throw new AppError("Mollie gaf geen geldige client link terug.", {
          code: "INVALID_INPUT",
          details: response,
        });
      }

      const onboardingUrl = new URL(clientLinkUrl);
      onboardingUrl.searchParams.set("client_id", clientId);
      onboardingUrl.searchParams.set("state", input.state);
      onboardingUrl.searchParams.set("scope", getMollieConnectScopeString());
      onboardingUrl.searchParams.set("approval_prompt", "auto");

      if (testMode) {
        onboardingUrl.searchParams.set("testmode", "true");
      }

      return {
        id,
        clientLinkUrl,
        onboardingUrl: onboardingUrl.toString(),
      };
    },
    async listProfiles(accessToken) {
      const response = await request<MollieProfilesResponse>(
        apiBaseUrl,
        appendTestMode("/profiles", testMode),
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return (
        response._embedded?.profiles
          ?.map(normalizeProfile)
          .filter((profile): profile is MollieConnectProfile => Boolean(profile)) ?? []
      );
    },
    async listCustomers(accessToken) {
      const response = await request<MollieCustomersResponse>(
        apiBaseUrl,
        appendTestMode("/customers?limit=250", testMode),
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return (
        response._embedded?.customers
          ?.map(normalizeCustomer)
          .filter((customer): customer is MollieConnectCustomer => Boolean(customer)) ?? []
      );
    },
    async listMandates(accessToken, customerId) {
      const response = await request<MollieMandatesResponse>(
        apiBaseUrl,
        appendTestMode(
          `/customers/${encodeURIComponent(customerId)}/mandates?limit=250`,
          testMode,
        ),
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return (
        response._embedded?.mandates
          ?.map(normalizeMandate)
          .filter((mandate): mandate is MollieConnectMandate => Boolean(mandate)) ?? []
      );
    },
  };
}
