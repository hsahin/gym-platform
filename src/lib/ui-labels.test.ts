import { describe, expect, it } from "vitest";
import {
  getBillingPaymentMethodLabel,
  getLeadAutomationTriggerLabel,
  getLeadSourceLabel,
  getBookingSourceLabel,
  getBookingStatusLabel,
  getClassLevelLabel,
  getMemberSignupStatusLabel,
  getMemberStatusLabel,
  getPointOfSaleModeLabel,
  getRoleLabel,
  getSystemCacheModeLabel,
  getUiLabel,
  getWaiverStatusLabel,
} from "@/lib/ui-labels";

describe("ui labels", () => {
  it("translates payment methods, statuses, roles and flow modes without leaking enum keys", () => {
    expect(getBillingPaymentMethodLabel("direct_debit")).toBe("Automatische incasso");
    expect(getBillingPaymentMethodLabel("one_time")).toBe("Eenmalige betaling");
    expect(getBillingPaymentMethodLabel("payment_request")).toBe("Betaalverzoek");
    expect(getMemberStatusLabel("active")).toBe("Actief");
    expect(getWaiverStatusLabel("pending")).toBe("Waiver open");
    expect(getBookingStatusLabel("checked_in")).toBe("Ingecheckt");
    expect(getBookingSourceLabel("frontdesk")).toBe("Balie");
    expect(getClassLevelLabel("advanced")).toBe("Gevorderd");
    expect(getPointOfSaleModeLabel("hybrid")).toBe("Balie en kiosk");
    expect(getLeadSourceLabel("meta_ads")).toBe("Meta-advertenties");
    expect(getLeadAutomationTriggerLabel("booking_cancellation")).toBe(
      "Geannuleerde reservering",
    );
    expect(getMemberSignupStatusLabel("pending_review")).toBe("Wacht op controle");
    expect(getRoleLabel("owner")).toBe("Eigenaar");
    expect(getRoleLabel("gym.frontdesk")).toBe("Balie");
    expect(getSystemCacheModeLabel("redis")).toBe("Actief");
    expect(getSystemCacheModeLabel("memory")).toBe("Tijdelijke stand");
  });

  it("uses a safe fallback for unknown values instead of rendering raw technical input", () => {
    expect(getUiLabel("memberStatus", "future_status")).toBe("Onbekend");
    expect(getUiLabel("billingPaymentMethod", "")).toBe("Onbekend");
    expect(getUiLabel("entityStatus", null)).toBe("Onbekend");
  });
});
