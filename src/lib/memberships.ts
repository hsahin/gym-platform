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
    helper: "Doorlopend maandcontract voor standaard lidmaatschappen.",
  },
  {
    key: "semiannual",
    label: "6 maanden",
    helper: "Halve jaartermijn voor leden die langer blijven en voorspelbare omzet geven.",
  },
  {
    key: "annual",
    label: "Per jaar",
    helper: "Jaarcontract voor langlopende leden en sterkere kasstroom.",
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

export function normalizeFullPaymentDiscountPercent(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((value ?? 0) * 100) / 100));
}

export function getMembershipMonthlyAmountCents(
  membershipPlan: Pick<MembershipPlan, "priceMonthly">,
) {
  return Math.round(membershipPlan.priceMonthly * 100);
}

export function getMembershipFullPaymentAmountCents(
  membershipPlan: Pick<
    MembershipPlan,
    "billingCycle" | "fullPaymentDiscountPercent" | "priceMonthly"
  >,
) {
  const grossAmountCents = Math.round(
    membershipPlan.priceMonthly *
      getMembershipBillingCycleMonths(membershipPlan.billingCycle) *
      100,
  );
  const discountMultiplier =
    (100 - normalizeFullPaymentDiscountPercent(membershipPlan.fullPaymentDiscountPercent)) /
    100;

  return Math.max(0, Math.round(grossAmountCents * discountMultiplier));
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
