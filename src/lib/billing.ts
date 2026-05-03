import type {
  BillingConnectionStatus,
  BillingPaymentMethod,
  BillingProvider,
} from "@/server/types";
import {
  getBillingPaymentMethodLabel as getBillingPaymentMethodUiLabel,
} from "@/lib/ui-labels";

export interface StoredBillingSettings {
  readonly enabled: boolean;
  readonly provider: BillingProvider;
  readonly profileLabel: string;
  readonly profileId: string;
  readonly settlementLabel: string;
  readonly supportEmail: string;
  readonly paymentMethods: ReadonlyArray<BillingPaymentMethod>;
  readonly notes?: string;
  readonly lastValidatedAt?: string;
  readonly lastPaymentActionAt?: string;
  readonly lastPaymentActionBy?: string;
  readonly mollieConnect?: StoredMollieConnectSettings;
}

export interface StoredMollieConnectSettings {
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly expiresAt?: string;
  readonly scope?: string;
  readonly connectedAt?: string;
  readonly testMode?: boolean;
  readonly state?: string;
  readonly stateCreatedAt?: string;
  readonly clientLinkId?: string;
  readonly clientLinkUrl?: string;
  readonly onboardingUrl?: string;
  readonly profileStatus?: string;
}

export interface BillingRuntimeOptions {
  readonly liveProviderConfigured?: boolean;
}

export const BILLING_PROVIDER_OPTIONS: ReadonlyArray<{
  key: BillingProvider;
  label: string;
  helper: string;
}> = [
  {
    key: "mollie",
    label: "Mollie",
    helper:
      "Sterke Europese betaalprovider voor incasso, eenmalige betaling en gedeelde betaalverzoeken.",
  },
] as const;

export const BILLING_PAYMENT_METHOD_OPTIONS: ReadonlyArray<{
  key: BillingPaymentMethod;
  label: string;
  helper: string;
}> = [
  {
    key: "direct_debit",
    label: getBillingPaymentMethodUiLabel("direct_debit"),
    helper: "Voor lidmaatschappen die je maandelijks automatisch int via SEPA-incasso.",
  },
  {
    key: "one_time",
    label: getBillingPaymentMethodUiLabel("one_time"),
    helper: "Voor leden die de volledige contractperiode in één keer betalen.",
  },
  {
    key: "payment_request",
    label: getBillingPaymentMethodUiLabel("payment_request"),
    helper: "Voor losse betaalverzoeken via WhatsApp of sms, bijvoorbeeld voor intake of toeslagen.",
  },
] as const;

export function createDefaultBillingSettings(): StoredBillingSettings {
  return {
    enabled: false,
    provider: "mollie",
    profileLabel: "",
    profileId: "",
    settlementLabel: "",
    supportEmail: "",
    paymentMethods: ["one_time"],
  };
}

export function getBillingProviderLabel(provider: BillingProvider) {
  return (
    BILLING_PROVIDER_OPTIONS.find((option) => option.key === provider)?.label ??
    provider
  );
}

export function getBillingPaymentMethodLabel(paymentMethod: BillingPaymentMethod) {
  return getBillingPaymentMethodUiLabel(paymentMethod);
}

export function normalizeStoredBillingSettings(
  input?: Partial<StoredBillingSettings> | null,
): StoredBillingSettings {
  const base = createDefaultBillingSettings();
  const mollieConnect = input?.mollieConnect
    ? {
        accessToken: input.mollieConnect.accessToken?.trim() || undefined,
        refreshToken: input.mollieConnect.refreshToken?.trim() || undefined,
        expiresAt: input.mollieConnect.expiresAt?.trim() || undefined,
        scope: input.mollieConnect.scope?.trim() || undefined,
        connectedAt: input.mollieConnect.connectedAt?.trim() || undefined,
        testMode: input.mollieConnect.testMode,
        state: input.mollieConnect.state?.trim() || undefined,
        stateCreatedAt: input.mollieConnect.stateCreatedAt?.trim() || undefined,
        clientLinkId: input.mollieConnect.clientLinkId?.trim() || undefined,
        clientLinkUrl: input.mollieConnect.clientLinkUrl?.trim() || undefined,
        onboardingUrl: input.mollieConnect.onboardingUrl?.trim() || undefined,
        profileStatus: input.mollieConnect.profileStatus?.trim() || undefined,
      }
    : undefined;

  return {
    ...base,
    ...input,
    profileLabel: input?.profileLabel?.trim() ?? base.profileLabel,
    profileId: input?.profileId?.trim() ?? base.profileId,
    settlementLabel: input?.settlementLabel?.trim() ?? base.settlementLabel,
    supportEmail: input?.supportEmail?.trim().toLowerCase() ?? base.supportEmail,
    paymentMethods:
      input?.paymentMethods && input.paymentMethods.length > 0
        ? Array.from(new Set(input.paymentMethods))
        : base.paymentMethods,
    notes: input?.notes?.trim() ? input.notes.trim() : undefined,
    mollieConnect:
      mollieConnect &&
      Object.values(mollieConnect).some((value) => value !== undefined)
        ? mollieConnect
        : undefined,
  };
}

export function getBillingConnectionStatus(
  settings: StoredBillingSettings,
): BillingConnectionStatus {
  const hasAnyConfiguration = Boolean(
    settings.profileLabel ||
      settings.profileId ||
      settings.supportEmail ||
      settings.settlementLabel,
  );
  const hasFullConfiguration = Boolean(
    settings.profileLabel &&
      settings.profileId &&
      settings.supportEmail &&
      settings.paymentMethods.length > 0,
  );

  if (!hasAnyConfiguration) {
    return "not_configured";
  }

  if (hasFullConfiguration) {
    return "configured";
  }

  return "attention";
}

export function isBillingReady(settings: StoredBillingSettings) {
  return settings.enabled && getBillingConnectionStatus(settings) === "configured";
}

export function getBillingStatusLabel(
  settings: StoredBillingSettings,
  options?: BillingRuntimeOptions,
) {
  const status = getBillingConnectionStatus(settings);

  if (status === "configured" && settings.enabled) {
    return options?.liveProviderConfigured ? "Live" : "Live inrichting nodig";
  }

  if (status === "configured") {
    return "Klaar om te activeren";
  }

  if (status === "attention") {
    return "Aandacht nodig";
  }

  return "Niet gekoppeld";
}

export function getBillingHelpText(
  settings: StoredBillingSettings,
  options?: BillingRuntimeOptions,
) {
  const providerLabel = getBillingProviderLabel(settings.provider);
  const methods = settings.paymentMethods.map(getBillingPaymentMethodLabel);
  const methodLabel =
    methods.length === 0
      ? "nog geen betaalroutes"
      : methods.length === 1
        ? methods[0]
        : `${methods.slice(0, -1).join(", ")} en ${methods.at(-1)}`;
  const status = getBillingConnectionStatus(settings);

  if (status === "configured" && settings.enabled) {
    if (options?.liveProviderConfigured) {
      return `${providerLabel} verwerkt nu ${methodLabel}. Facturen, terugbetalingen en dagafsluiting lopen via de live betaalverwerking.`;
    }

    return `${providerLabel} is ingesteld voor ${methodLabel}, maar de live betaalverwerking is nog niet volledig aangesloten in de omgeving.`;
  }

  if (status === "configured") {
    return `${providerLabel} is ingevuld voor ${methodLabel}. Activeer betalingen zodra je lidmaatschappen of losse verkopen live wilt incasseren.`;
  }

  if (status === "attention") {
    return `Vul profielnaam, profiel-id en support e-mail aan om ${providerLabel} betrouwbaar te kunnen gebruiken.`;
  }

  return "Koppel betaalgegevens per gym om maandelijkse incasso, volledige vooruitbetaling en deelbare betaalverzoeken voor te bereiden.";
}
