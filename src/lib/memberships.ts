import type { MembershipPlan } from "@/server/types";

export const CONTRACT_IMPORT_REQUIRED_CSV_HEADER =
  "naam;email;telefoon;contract;contractduur;prijs";

export const MEMBERSHIP_BILLING_CYCLE_OPTIONS: ReadonlyArray<{
  key: MembershipPlan["billingCycle"];
  label: string;
  helper: string;
}> = [
  {
    key: "monthly",
    label: "Per maand",
    helper: "Doorlopend maandcontract voor standaard memberships.",
  },
  {
    key: "semiannual",
    label: "6 maanden",
    helper: "Halve jaartermijn voor commitments met meer retentie en voorspelbare omzet.",
  },
  {
    key: "annual",
    label: "Per jaar",
    helper: "Jaarcontract voor langlopende members en sterkere cashflow.",
  },
] as const;

export function getMembershipBillingCycleLabel(
  billingCycle: MembershipPlan["billingCycle"],
) {
  return (
    MEMBERSHIP_BILLING_CYCLE_OPTIONS.find((option) => option.key === billingCycle)
      ?.label ?? billingCycle
  );
}

export function getMembershipBillingCycleMonths(
  billingCycle: MembershipPlan["billingCycle"],
) {
  switch (billingCycle) {
    case "semiannual":
      return 6;
    case "annual":
      return 12;
    case "monthly":
    default:
      return 1;
  }
}

export function normalizeMembershipBillingCycleInput(
  input: string,
): MembershipPlan["billingCycle"] | null {
  const normalized = input.trim().toLowerCase();

  if (
    [
      "monthly",
      "month",
      "maand",
      "per maand",
      "1 month",
      "1 maand",
    ].includes(normalized)
  ) {
    return "monthly";
  }

  if (
    [
      "semiannual",
      "semi-annual",
      "6 maanden",
      "6 months",
      "half-year",
      "half year",
      "halfjaar",
      "half jaar",
      "6m",
    ].includes(normalized)
  ) {
    return "semiannual";
  }

  if (
    [
      "annual",
      "year",
      "jaar",
      "yearly",
      "per jaar",
      "12 months",
      "12 maanden",
    ].includes(normalized)
  ) {
    return "annual";
  }

  return null;
}

export function addMonthsToIsoDate(isoDate: string, months: number) {
  const date = new Date(isoDate);
  const nextDate = new Date(date);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);
  return nextDate.toISOString();
}
