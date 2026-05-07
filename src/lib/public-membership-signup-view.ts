import type { PublicMembershipSignupSnapshot } from "@/server/types";

export interface PublicMembershipSignupPortalSnapshot {
  readonly tenantName: string;
  readonly tenantSlug: string | null;
  readonly availableGyms: ReadonlyArray<{
    readonly id: string;
    readonly slug: string;
    readonly name: string;
  }>;
  readonly membershipPlans: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly priceMonthly: number;
    readonly fullPaymentDiscountPercent: number;
    readonly billingCycle: PublicMembershipSignupSnapshot["membershipPlans"][number]["billingCycle"];
  }>;
  readonly paymentMethods: PublicMembershipSignupSnapshot["paymentMethods"];
  readonly locations: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly city: string;
  }>;
  readonly legal: {
    readonly termsUrl: string;
    readonly privacyUrl: string;
    readonly sepaMandateText: string;
  };
  readonly checkoutAvailable: boolean;
}

export function toPublicMembershipSignupPortalSnapshot(
  snapshot: PublicMembershipSignupSnapshot,
): PublicMembershipSignupPortalSnapshot {
  const legal = snapshot.legal as Partial<PublicMembershipSignupSnapshot["legal"]> | undefined;
  const membershipPlans = snapshot.membershipPlans ?? [];
  const locations = snapshot.locations ?? [];

  return {
    tenantName: snapshot.tenantName,
    tenantSlug: snapshot.tenantSlug ?? null,
    availableGyms: snapshot.availableGyms ?? [],
    membershipPlans,
    paymentMethods: (snapshot.paymentMethods ?? []).filter(
      (method) => method === "direct_debit" || method === "one_time",
    ),
    locations,
    legal: {
      termsUrl: legal?.termsUrl ?? "",
      privacyUrl: legal?.privacyUrl ?? "",
      sepaMandateText: legal?.sepaMandateText ?? "",
    },
    checkoutAvailable: Boolean(
      snapshot.tenantSlug &&
        snapshot.billingReady &&
        (snapshot.legalReady || snapshot.testMode) &&
        membershipPlans.length > 0 &&
        locations.length > 0,
    ),
  };
}
