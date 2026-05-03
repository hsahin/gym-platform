import { describe, expect, it } from "vitest";
import { DASHBOARD_FEATURE_CATALOG } from "@/features/dashboard-feature-catalog";
import {
  DASHBOARD_FEATURE_UI_COPY,
  getDashboardFeatureCategoryLabel,
  getDashboardFeatureFlagStateLabel,
  getDashboardFeatureReasonLabel,
  getDashboardFeatureStatusLabel,
  getDashboardFeatureUiCopy,
} from "@/features/dashboard-feature-copy";

const mixedFeatureCopyFragments = [
  "owners",
  "frontdesk",
  "remote toegang",
  "owner-acties",
  "check-ins",
  "tenant",
  "retail-checkout",
  "flow",
  "Workout",
  "premium",
  "member-only",
  "journeys",
  "Leadbeheer",
  "leads",
  "accountability",
  "member progressie",
] as const;

describe("dashboard feature UI copy", () => {
  it("has clear UI copy for every feature in the catalog", () => {
    expect(Object.keys(DASHBOARD_FEATURE_UI_COPY).sort()).toEqual(
      DASHBOARD_FEATURE_CATALOG.map((feature) => feature.key).sort(),
    );

    for (const feature of DASHBOARD_FEATURE_CATALOG) {
      const copy = getDashboardFeatureUiCopy(feature);

      expect(copy.title).toBeTruthy();
      expect(copy.description).toBeTruthy();
      expect(copy.title).not.toMatch(/\b(Member|Staff|Owner|Trial|Direct Debit)\b/);
      expect(copy.description).not.toMatch(/\b(member portal|team members|owner|trial booking|one-time)\b/i);
    }
  });

  it("localizes feature state, status, category, and module availability labels", () => {
    expect(getDashboardFeatureFlagStateLabel(true)).toBe("Ingeschakeld");
    expect(getDashboardFeatureFlagStateLabel(false)).toBe("Uitgeschakeld");
    expect(getDashboardFeatureStatusLabel("Live")).toBe("Live");
    expect(getDashboardFeatureStatusLabel("Expanded")).toBe("Uitgebreid");
    expect(getDashboardFeatureStatusLabel("New")).toBe("Nieuw");
    expect(
      getDashboardFeatureCategoryLabel({
        categoryKey: "booking",
        categoryTitle: "Booking Options",
      }),
    ).toBe("Reserveringen");
    expect(getDashboardFeatureReasonLabel("tenant_override")).toBe("Clubinstelling");
    expect(getDashboardFeatureReasonLabel("actor_override")).toBe("Gebruikersinstelling");
    expect(getDashboardFeatureReasonLabel("rollout")).toBe("Standaard beschikbaar");
    expect(getDashboardFeatureReasonLabel("unknown")).toBe("Standaard");
  });

  it("keeps feature card titles and descriptions in business Dutch", () => {
    const visibleFeatureCopy = Object.values(DASHBOARD_FEATURE_UI_COPY)
      .map((copy) => `${copy.title}\n${copy.description}`)
      .join("\n\n");

    for (const fragment of mixedFeatureCopyFragments) {
      expect(visibleFeatureCopy).not.toContain(fragment);
    }
  });
});
