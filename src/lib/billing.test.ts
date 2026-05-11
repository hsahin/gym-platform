import { describe, expect, it } from "vitest";
import {
  BILLING_PAYMENT_METHOD_OPTIONS,
  createDefaultBillingSettings,
  getBillingConnectionStatus,
  getBillingHelpText,
  getBillingPaymentMethodLabel,
  getBillingProviderLabel,
  getBillingStatusLabel,
  isBillingReady,
  normalizeStoredBillingSettings,
  type StoredBillingSettings,
} from "@/lib/billing";

describe("billing helpers", () => {
  it("starts with a safe Mollie default", () => {
    expect(createDefaultBillingSettings()).toEqual({
      enabled: false,
      provider: "mollie",
      profileLabel: "",
      profileId: "",
      settlementLabel: "",
      supportEmail: "",
      paymentMethods: ["one_time"],
    });
  });

  it("normalizes stored settings without leaking whitespace into the dashboard", () => {
    expect(
      normalizeStoredBillingSettings({
        profileLabel: "  Northside Payments  ",
        profileId: "  pfl_test_123  ",
        settlementLabel: "  Northside Club  ",
        supportEmail: "  Billing@Northside.Test  ",
        paymentMethods: ["one_time", "direct_debit", "one_time"],
        notes: "  Preview only  ",
      }),
    ).toMatchObject({
      profileLabel: "Northside Payments",
      profileId: "pfl_test_123",
      settlementLabel: "Northside Club",
      supportEmail: "billing@northside.test",
      paymentMethods: ["one_time", "direct_debit"],
      notes: "Preview only",
    });

    expect(normalizeStoredBillingSettings({ paymentMethods: [], notes: "   " })).toMatchObject({
      paymentMethods: ["one_time"],
      notes: undefined,
    });
  });

  it("normalizes nested mollieConnect tokens by trimming whitespace and keeping testMode", () => {
    const result = normalizeStoredBillingSettings({
      mollieConnect: {
        accessToken: "  access_token_value  ",
        refreshToken: "  refresh_token_value  ",
        expiresAt: "  2026-06-01T00:00:00.000Z  ",
        scope: "  payments.read clients.write  ",
        connectedAt: "  2026-05-01T00:00:00.000Z  ",
        testMode: true,
        state: "  state-uuid  ",
        stateCreatedAt: "  2026-04-01T00:00:00.000Z  ",
        clientLinkId: "  cl_test_123  ",
        clientLinkUrl: "  https://example.com/link  ",
        onboardingUrl: "  https://example.com/onboarding  ",
        profileStatus: "  active  ",
      },
    });

    expect(result.mollieConnect).toMatchObject({
      accessToken: "access_token_value",
      refreshToken: "refresh_token_value",
      expiresAt: "2026-06-01T00:00:00.000Z",
      scope: "payments.read clients.write",
      connectedAt: "2026-05-01T00:00:00.000Z",
      testMode: true,
      state: "state-uuid",
      stateCreatedAt: "2026-04-01T00:00:00.000Z",
      clientLinkId: "cl_test_123",
      clientLinkUrl: "https://example.com/link",
      onboardingUrl: "https://example.com/onboarding",
      profileStatus: "active",
    });

    const blank = normalizeStoredBillingSettings({
      mollieConnect: {
        accessToken: "   ",
        refreshToken: "   ",
        expiresAt: "   ",
        scope: "   ",
        connectedAt: "   ",
        testMode: false,
        state: "   ",
        stateCreatedAt: "   ",
        clientLinkId: "   ",
        clientLinkUrl: "   ",
        onboardingUrl: "   ",
        profileStatus: "   ",
      },
    });

    expect(blank.mollieConnect).toMatchObject({
      accessToken: undefined,
      refreshToken: undefined,
      expiresAt: undefined,
      scope: undefined,
      connectedAt: undefined,
      testMode: false,
      state: undefined,
      stateCreatedAt: undefined,
      clientLinkId: undefined,
      clientLinkUrl: undefined,
      onboardingUrl: undefined,
      profileStatus: undefined,
    });
  });

  it("reports not configured, attention and configured states", () => {
    const blank = createDefaultBillingSettings();
    const partial = normalizeStoredBillingSettings({
      profileLabel: "Northside Payments",
    });
    const configured = normalizeStoredBillingSettings({
      enabled: true,
      profileLabel: "Northside Payments",
      profileId: "pfl_test_123",
      supportEmail: "billing@northside.test",
      paymentMethods: ["direct_debit", "one_time", "payment_request"],
    });

    expect(getBillingConnectionStatus(blank)).toBe("not_configured");
    expect(getBillingConnectionStatus(partial)).toBe("attention");
    expect(getBillingConnectionStatus(configured)).toBe("configured");
    expect(isBillingReady(configured)).toBe(true);
  });

  it("builds owner-facing labels and help text for every billing state", () => {
    const configuredDisabled = normalizeStoredBillingSettings({
      enabled: false,
      profileLabel: "Northside Payments",
      profileId: "pfl_test_123",
      supportEmail: "billing@northside.test",
      paymentMethods: ["one_time"],
    });
    const configuredEnabled = {
      ...configuredDisabled,
      enabled: true,
      paymentMethods: ["direct_debit", "one_time", "payment_request"],
    } satisfies StoredBillingSettings;
    const configuredWithoutMethods = {
      ...configuredEnabled,
      paymentMethods: [],
    } satisfies StoredBillingSettings;
    const attention = normalizeStoredBillingSettings({ profileId: "pfl_test_123" });

    expect(getBillingProviderLabel("mollie")).toBe("Mollie");
    expect(getBillingProviderLabel("custom" as never)).toBe("custom");
    expect(getBillingPaymentMethodLabel("payment_request")).toBe("Los betaalverzoek");
    expect(getBillingPaymentMethodLabel("manual" as never)).toBe("Onbekend");
    expect(getBillingStatusLabel(createDefaultBillingSettings())).toBe("Niet gekoppeld");
    expect(getBillingStatusLabel(attention)).toBe("Aandacht nodig");
    expect(getBillingStatusLabel(configuredDisabled)).toBe("Klaar om te activeren");
    expect(getBillingStatusLabel(configuredEnabled)).toBe("Live inrichting nodig");
    expect(getBillingStatusLabel(configuredEnabled, { liveProviderConfigured: true })).toBe(
      "Live",
    );
    expect(getBillingHelpText(createDefaultBillingSettings())).toContain(
      "Koppel betaalgegevens",
    );
    expect(getBillingHelpText(attention)).toContain("Vul profielnaam");
    expect(getBillingHelpText(configuredDisabled)).toContain("is ingevuld");
    expect(getBillingHelpText(configuredDisabled)).toContain("lidmaatschappen");
    expect(getBillingHelpText(configuredDisabled)).not.toContain("memberships");
    expect(getBillingHelpText(configuredDisabled)).not.toContain("losse sales");
    expect(getBillingHelpText(configuredEnabled)).toContain("live betaalverwerking");
    expect(getBillingHelpText(configuredEnabled, { liveProviderConfigured: true })).toContain(
      "Automatische incasso, Volledige contractbetaling en Los betaalverzoek",
    );
    expect(getBillingHelpText(configuredWithoutMethods)).toContain("Vul profielnaam");
  });

  it("explains payment routes in owner-facing business language", () => {
    expect(BILLING_PAYMENT_METHOD_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "direct_debit",
          helper: expect.stringContaining("maandelijks"),
        }),
        expect.objectContaining({
          key: "one_time",
          helper: expect.stringContaining("volledige contractperiode"),
        }),
      ]),
    );
  });
});
