import type {
  BillingConnectionStatus,
  BillingPaymentMethod,
  BillingProvider,
} from "@/server/types";

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
      "Sterke Europese betaalprovider voor incasso, eenmalige checkout en gedeelde betaalverzoeken.",
  },
] as const;

export const BILLING_PAYMENT_METHOD_OPTIONS: ReadonlyArray<{
  key: BillingPaymentMethod;
  label: string;
  helper: string;
}> = [
  {
    key: "direct_debit",
    label: "Automatische incasso",
    helper: "Voor memberships en doorlopende betalingen met een vaste mandateflow.",
  },
  {
    key: "one_time",
    label: "Eenmalige betaling",
    helper: "Voor drop-ins, intakepakketten of een snelle checkout voor losse aankopen.",
  },
  {
    key: "payment_request",
    label: "Betaalverzoek",
    helper: "Voor een deelbare betaallink via WhatsApp of sms, in Tikkie-stijl.",
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
  return (
    BILLING_PAYMENT_METHOD_OPTIONS.find((option) => option.key === paymentMethod)?.label ??
    paymentMethod
  );
}

export function normalizeStoredBillingSettings(
  input?: Partial<StoredBillingSettings> | null,
): StoredBillingSettings {
  const base = createDefaultBillingSettings();

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

export function getBillingStatusLabel(settings: StoredBillingSettings) {
  const status = getBillingConnectionStatus(settings);

  if (status === "configured" && settings.enabled) {
    return "Live preview";
  }

  if (status === "configured") {
    return "Klaar om te activeren";
  }

  if (status === "attention") {
    return "Aandacht nodig";
  }

  return "Niet gekoppeld";
}

export function getBillingHelpText(settings: StoredBillingSettings) {
  const providerLabel = getBillingProviderLabel(settings.provider);
  const methods = settings.paymentMethods.map(getBillingPaymentMethodLabel);
  const methodLabel =
    methods.length === 0
      ? "nog geen betaalflows"
      : methods.length === 1
        ? methods[0]
        : `${methods.slice(0, -1).join(", ")} en ${methods.at(-1)}`;
  const status = getBillingConnectionStatus(settings);

  if (status === "configured" && settings.enabled) {
    return `${providerLabel} staat klaar voor ${methodLabel}. Deze koppeling draait nu in preview totdat live credentials en webhooks worden aangesloten.`;
  }

  if (status === "configured") {
    return `${providerLabel} is ingevuld voor ${methodLabel}. Activeer betalingen zodra je memberships of losse sales live wilt incasseren.`;
  }

  if (status === "attention") {
    return `Vul profielnaam, profiel-id en support e-mail aan om ${providerLabel} betrouwbaar te kunnen gebruiken.`;
  }

  return "Koppel Mollie per gym om automatische incasso, eenmalige betalingen en deelbare betaalverzoeken voor te bereiden.";
}
