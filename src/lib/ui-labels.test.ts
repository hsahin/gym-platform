import { describe, expect, it } from "vitest";
import * as UiLabels from "@/lib/ui-labels";
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
    expect(getBillingPaymentMethodLabel("one_time")).toBe("Volledige contractbetaling");
    expect(getBillingPaymentMethodLabel("payment_request")).toBe("Los betaalverzoek");
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

  it("keeps every exported enum translator wired to the central Dutch label layer", () => {
    const cases: ReadonlyArray<readonly [keyof typeof UiLabels, string, string]> = [
      ["getAppointmentStatusLabel", "scheduled", "Gepland"],
      ["getAttendanceChannelLabel", "frontdesk", "Balie"],
      ["getBillingInvoiceSourceLabel", "signup_checkout", "Online aanmelding"],
      ["getBillingInvoiceStatusLabel", "refunded", "Terugbetaald"],
      ["getBillingPaymentMethodLabel", "bank_transfer", "Overschrijving"],
      ["getBillingReconciliationStatusLabel", "attention", "Aandacht nodig"],
      ["getBillingRefundStatusLabel", "processed", "Verwerkt"],
      ["getBillingWebhookStatusLabel", "received", "Ontvangen"],
      ["getBookingKindLabel", "open_gym", "Vrij trainen"],
      ["getBookingSourceLabel", "member_app", "Ledenapp"],
      ["getBookingStatusLabel", "waitlisted", "Wachtlijst"],
      ["getChallengeStatusLabel", "completed", "Afgerond"],
      ["getClassLevelLabel", "mixed", "Gemengd"],
      ["getCollectionCaseStatusLabel", "retrying", "In opvolging"],
      ["getCommunityGroupStatusLabel", "archived", "Gearchiveerd"],
      ["getEntityStatusLabel", "paused", "Gepauzeerd"],
      ["getLeadStageLabel", "trial_scheduled", "Proefles gepland"],
      ["getLeadSourceLabel", "walk_in", "Binnenloper"],
      ["getLeadAutomationTriggerLabel", "schedule", "Planning"],
      ["getLeadTaskStatusLabel", "done", "Afgerond"],
      ["getLeadTaskTypeLabel", "follow_up", "Nabellen"],
      ["getMemberSignupStatusLabel", "rejected", "Afgewezen"],
      ["getMemberStatusLabel", "trial", "Proeflid"],
      ["getMobileRequestStatusLabel", "approved", "Goedgekeurd"],
      ["getPointOfSaleModeLabel", "kiosk", "Kiosk"],
      ["getQuestionnaireStatusLabel", "closed", "Gesloten"],
      ["getRemoteAccessBridgeTypeLabel", "hub", "Hub"],
      ["getRemoteAccessConnectionStatusLabel", "configured", "Ingericht"],
      ["getRemoteAccessProviderLabel", "salto_ks", "Salto KS"],
      ["getReviewRequestStatusLabel", "pending", "Open"],
      ["getRoleLabel", "gym.trainer", "Trainer"],
      ["getTrainerStatusLabel", "away", "Afwezig"],
      ["getSystemHealthStatusLabel", "missing_config", "Configuratie mist"],
      ["getSystemCacheModeLabel", "memory", "Tijdelijke stand"],
      ["getWaiverRecordStatusLabel", "expired", "Verlopen"],
      ["getWaiverStatusLabel", "complete", "Waiver akkoord"],
    ];

    for (const [functionName, value, expected] of cases) {
      const translator = UiLabels[functionName];

      expect(typeof translator).toBe("function");
      expect((translator as (input: string) => string)(value)).toBe(expected);
    }
  });
});
