import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readComponentSource(relativePath: string) {
  return readFileSync(path.join(process.cwd(), "src/components", relativePath), "utf8");
}

describe("ui label usage", () => {
  it("renders common dashboard enums through the central UI label layer", () => {
    const paymentsSource = readComponentSource("dashboard/pages/PaymentsDashboardPage.tsx");
    const memberSource = readComponentSource("MemberView.tsx");
    const bookingSource = readComponentSource("BookingDialog.tsx");
    const locationSource = readComponentSource("LocationView.tsx");
    const classSource = readComponentSource("ClassSessionView.tsx");
    const overviewSource = readComponentSource("dashboard/pages/OverviewDashboardPage.tsx");
    const membersPageSource = readComponentSource("dashboard/pages/MembersDashboardPage.tsx");
    const classesPageSource = readComponentSource("dashboard/pages/ClassesDashboardPage.tsx");
    const settingsPageSource = readComponentSource("dashboard/pages/SettingsDashboardPage.tsx");
    const marketingPageSource = readComponentSource("dashboard/pages/MarketingDashboardPage.tsx");
    const superadminPageSource = readComponentSource("dashboard/pages/SuperadminDashboardPage.tsx");

    expect(paymentsSource).toContain("@/lib/ui-labels");
    expect(paymentsSource).toContain("getBillingPaymentMethodLabel");
    expect(paymentsSource).toContain("getCollectionCaseStatusLabel");
    expect(paymentsSource).toContain("getBillingInvoiceStatusLabel");
    expect(paymentsSource).not.toContain("const PAYMENT_METHOD_LABELS");
    expect(paymentsSource).not.toContain("getPaymentPageLabel");

    expect(memberSource).toContain("getMemberStatusLabel");
    expect(memberSource).toContain("getWaiverStatusLabel");
    expect(memberSource).not.toContain("{member.status}");
    expect(memberSource).not.toContain("waiver {member.waiverStatus}");

    expect(bookingSource).toContain("getBookingStatusLabel");
    expect(bookingSource).toContain("getMemberStatusLabel");
    expect(bookingSource).not.toContain("payload.data.booking.status");
    expect(bookingSource).not.toContain("{selectedMember.status}");

    expect(locationSource).toContain("getEntityStatusLabel");
    expect(locationSource).not.toContain("{location.status}");

    expect(classSource).toContain("getClassLevelLabel");
    expect(classSource).not.toContain("{classSession.level}");

    expect(overviewSource).toContain("getBookingStatusLabel");
    expect(overviewSource).toContain("getBookingSourceLabel");
    expect(overviewSource).toContain("getEntityStatusLabel");
    expect(overviewSource).not.toContain("{session.status}");
    expect(overviewSource).not.toContain("{booking.status}");

    expect(membersPageSource).toContain("getMemberStatusLabel");
    expect(membersPageSource).toContain("getBillingPaymentMethodLabel");
    expect(membersPageSource).toContain("getMemberSignupStatusLabel");
    expect(membersPageSource).not.toContain("{member.status}");
    expect(membersPageSource).not.toContain("{signup.paymentMethod}");
    expect(membersPageSource).not.toContain("{signup.status}");

    expect(classesPageSource).toContain("getClassLevelLabel");
    expect(classesPageSource).toContain("getBookingStatusLabel");
    expect(classesPageSource).not.toContain("{session.level}");
    expect(classesPageSource).not.toContain("{session.status}");
    expect(classesPageSource).not.toContain("{booking.status}");

    expect(settingsPageSource).toContain("getRoleLabel");
    expect(settingsPageSource).toContain("getTrainerStatusLabel");
    expect(settingsPageSource).not.toContain("{location.status}");
    expect(settingsPageSource).not.toContain("{trainer.status}");
    expect(settingsPageSource).not.toContain("{member.status}");

    expect(marketingPageSource).toContain("getMemberStatusLabel");
    expect(marketingPageSource).toContain("getWaiverStatusLabel");
    expect(marketingPageSource).toContain("getLeadAutomationTriggerLabel");
    expect(marketingPageSource).toContain("getLeadSourceLabel");
    expect(marketingPageSource).toContain("Verwachte waarde (€)");
    expect(marketingPageSource).toContain("parseEuroInputToCents");
    expect(marketingPageSource).not.toContain("Verwachte waarde (cent)");
    expect(marketingPageSource).not.toContain("Member status");
    expect(marketingPageSource).not.toContain("Waiver status");
    expect(marketingPageSource).not.toContain(">Pending<");
    expect(marketingPageSource).not.toContain("Automation run");
    expect(marketingPageSource).not.toContain("Marketing signals");

    expect(superadminPageSource).toContain("getDashboardFeatureCategoryLabel");
    expect(superadminPageSource).not.toContain("title: feature.categoryTitle");
  });
});
