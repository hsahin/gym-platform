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

const PRODUCT_NAME_FEATURES = new Set([
  "billing.autocollect",
  "coaching.ai_max",
  "retention.fitzone",
  "integrations.virtuagym_connect",
]);

describe("dashboard feature UI copy", () => {
  it("has clear UI copy for every feature in the catalog", () => {
    expect(Object.keys(DASHBOARD_FEATURE_UI_COPY).sort()).toEqual(
      DASHBOARD_FEATURE_CATALOG.map((feature) => feature.key).sort(),
    );

    for (const feature of DASHBOARD_FEATURE_CATALOG) {
      const copy = getDashboardFeatureUiCopy(feature);

      expect(copy.title).toBeTruthy();
      expect(copy.description).toBeTruthy();
      if (!PRODUCT_NAME_FEATURES.has(feature.key)) {
        expect(copy.title).not.toBe(feature.title);
      }
      expect(copy.description).not.toBe(feature.description);
    }
  });

  it("localizes feature state, status, category, and rollout reason labels", () => {
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
    ).toBe("Boekingsopties");
    expect(getDashboardFeatureReasonLabel("tenant_override")).toBe("Tenantinstelling");
    expect(getDashboardFeatureReasonLabel("actor_override")).toBe("Gebruikersinstelling");
    expect(getDashboardFeatureReasonLabel("rollout")).toBe("Rollout");
    expect(getDashboardFeatureReasonLabel("unknown")).toBe("Standaard");
  });
});
