import { describe, expect, it } from "vitest";
import {
  CONTRACT_IMPORT_REQUIRED_CSV_HEADER,
  addMonthsToIsoDate,
  getMembershipBillingCycleLabel,
  normalizeMembershipBillingCycleInput,
} from "@/lib/memberships";

describe("membership helpers", () => {
  it("maps contractduur labels to supported billing cycles", () => {
    expect(normalizeMembershipBillingCycleInput("maand")).toBe("monthly");
    expect(normalizeMembershipBillingCycleInput("6 maanden")).toBe("semiannual");
    expect(normalizeMembershipBillingCycleInput("jaar")).toBe("annual");
    expect(normalizeMembershipBillingCycleInput("half-year")).toBe("semiannual");
  });

  it("formats billing cycles for the UI", () => {
    expect(getMembershipBillingCycleLabel("monthly")).toBe("Per maand");
    expect(getMembershipBillingCycleLabel("semiannual")).toBe("6 maanden");
    expect(getMembershipBillingCycleLabel("annual")).toBe("Per jaar");
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
