import { describe, expect, it } from "vitest";
import { toPublicMembershipSignupPortalSnapshot } from "@/lib/public-membership-signup-view";
import type { PublicMembershipSignupSnapshot } from "@/server/types";

describe("public membership signup view model", () => {
  it("removes setup diagnostics before the snapshot reaches the consumer signup UI", () => {
    const publicSnapshot = toPublicMembershipSignupPortalSnapshot({
      tenantName: "Homegym",
      tenantSlug: "homegym",
      availableGyms: [{ id: "homegym", slug: "homegym", name: "Homegym" }],
      membershipPlans: [
        {
          id: "plan_1",
          name: "Membership",
          priceMonthly: 80,
          billingCycle: "monthly",
        },
      ],
      locations: [{ id: "loc_1", name: "Homegym", city: "Den Haag" }],
      legal: {
        termsUrl: "https://home-gym.nl/algemene-voorwaarden",
        privacyUrl: "https://home-gym.nl/privacy",
        sepaMandateText: "Incassotekst",
        contractPdfTemplateKey: "contracts/templates/homegym.pdf",
        waiverStorageKey: "waivers/homegym/",
      },
      legalReady: false,
      billingReady: false,
      legalMissingFields: ["contracttemplate", "waiveropslag"],
      billingMissingFields: ["betaalprofiel", "webhook-url"],
      testMode: false,
      billingMessage: "Betaalprofiel en webhook-url ontbreken.",
      legalMessage: "Contracttemplate en waiveropslag ontbreken.",
    } satisfies PublicMembershipSignupSnapshot);

    expect(publicSnapshot).not.toHaveProperty("billingMessage");
    expect(publicSnapshot).not.toHaveProperty("legalMessage");
    expect(publicSnapshot).not.toHaveProperty("billingMissingFields");
    expect(publicSnapshot).not.toHaveProperty("legalMissingFields");
    expect(publicSnapshot).not.toHaveProperty("billingReady");
    expect(publicSnapshot).not.toHaveProperty("legalReady");
    expect(publicSnapshot).not.toHaveProperty("testMode");
    expect(publicSnapshot.checkoutAvailable).toBe(false);
    expect(publicSnapshot.legal).not.toHaveProperty("contractPdfTemplateKey");
    expect(publicSnapshot.legal).not.toHaveProperty("waiverStorageKey");
    expect(JSON.stringify(publicSnapshot)).not.toMatch(
      /betaalprofiel|webhook-url|contracttemplate|waiveropslag|ontbreekt|ontbreken/i,
    );
  });
});
