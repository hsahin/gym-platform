import { describe, expect, it } from "vitest";
import {
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
  it("starts with a safe Mollie preview default", () => {
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
    expect(getBillingPaymentMethodLabel("payment_request")).toBe("Betaalverzoek");
    expect(getBillingPaymentMethodLabel("manual" as never)).toBe("manual");
    expect(getBillingStatusLabel(createDefaultBillingSettings())).toBe("Niet gekoppeld");
    expect(getBillingStatusLabel(attention)).toBe("Aandacht nodig");
    expect(getBillingStatusLabel(configuredDisabled)).toBe("Klaar om te activeren");
    expect(getBillingStatusLabel(configuredEnabled)).toBe("Live preview");
    expect(getBillingHelpText(createDefaultBillingSettings())).toContain("Koppel Mollie");
    expect(getBillingHelpText(attention)).toContain("Vul profielnaam");
    expect(getBillingHelpText(configuredDisabled)).toContain("is ingevuld");
    expect(getBillingHelpText(configuredEnabled)).toContain(
      "Automatische incasso, Eenmalige betaling en Betaalverzoek",
    );
    expect(getBillingHelpText(configuredWithoutMethods)).toContain("Vul profielnaam");
  });
});
