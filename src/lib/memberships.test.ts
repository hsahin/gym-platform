import { describe, expect, it } from "vitest";
import {
  CONTRACT_IMPORT_REQUIRED_CSV_HEADER,
  MEMBERSHIP_BILLING_CYCLE_OPTIONS,
  addMonthsToIsoDate,
  getMembershipBillingCycleMonths,
  getMembershipBillingCycleLabel,
  normalizeMembershipBillingCycleInput,
} from "@/lib/memberships";

describe("membership helpers", () => {
  it("maps contractduur labels to supported billing cycles", () => {
    expect(normalizeMembershipBillingCycleInput("maand")).toBe("monthly");
    expect(normalizeMembershipBillingCycleInput(" per maand ")).toBe("monthly");
    expect(normalizeMembershipBillingCycleInput("1 month")).toBe("monthly");
    expect(normalizeMembershipBillingCycleInput("6 maanden")).toBe("semiannual");
    expect(normalizeMembershipBillingCycleInput("jaar")).toBe("annual");
    expect(normalizeMembershipBillingCycleInput("half-year")).toBe("semiannual");
    expect(normalizeMembershipBillingCycleInput("6M")).toBe("semiannual");
    expect(normalizeMembershipBillingCycleInput("12 maanden")).toBe("annual");
    expect(normalizeMembershipBillingCycleInput("onbekend")).toBeNull();
  });

  it("formats billing cycles for the UI", () => {
    expect(getMembershipBillingCycleLabel("monthly")).toBe("Per maand");
    expect(getMembershipBillingCycleLabel("semiannual")).toBe("6 maanden");
    expect(getMembershipBillingCycleLabel("annual")).toBe("Per jaar");
    expect(getMembershipBillingCycleLabel("custom" as never)).toBe("custom");
  });

  it("keeps billing-cycle helper copy Dutch and member-friendly", () => {
    const helperCopy = MEMBERSHIP_BILLING_CYCLE_OPTIONS.map((option) => option.helper).join("\n");

    expect(helperCopy).toContain("lidmaatschappen");
    expect(helperCopy).not.toContain("memberships");
    expect(helperCopy).not.toContain("members");
    expect(helperCopy).not.toContain("commitments");
    expect(helperCopy).not.toContain("cashflow");
  });

  it("maps billing cycles to renewal month counts", () => {
    expect(getMembershipBillingCycleMonths("monthly")).toBe(1);
    expect(getMembershipBillingCycleMonths("semiannual")).toBe(6);
    expect(getMembershipBillingCycleMonths("annual")).toBe(12);
    expect(getMembershipBillingCycleMonths("custom" as never)).toBe(1);
  });

  it("adds the right number of months to a renewal date", () => {
    expect(addMonthsToIsoDate("2026-01-15T10:00:00.000Z", 1)).toBe(
      "2026-02-15T10:00:00.000Z",
    );
    expect(addMonthsToIsoDate("2026-01-15T10:00:00.000Z", 6)).toBe(
      "2026-07-15T10:00:00.000Z",
    );
    expect(addMonthsToIsoDate("2026-01-15T10:00:00.000Z", 12)).toBe(
      "2027-01-15T10:00:00.000Z",
    );
  });

  it("provides a required-only CSV header for contract imports", () => {
    expect(CONTRACT_IMPORT_REQUIRED_CSV_HEADER).toBe(
      "naam;email;telefoon;contract;contractduur;prijs",
    );
  });
});
