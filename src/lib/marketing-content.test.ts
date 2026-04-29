import { describe, expect, it } from "vitest";
import { getLoginExperienceContent, getPublicLandingContent } from "@/lib/marketing-content";
import type { PublicReservationSnapshot } from "@/server/types";

const snapshot: PublicReservationSnapshot = {
  tenantName: "Atlas Fitness",
  tenantSlug: "atlas-fitness",
  availableGyms: [
    {
      id: "atlas-fitness",
      slug: "atlas-fitness",
      name: "Atlas Fitness",
    },
  ],
  classSessions: [
    {
      id: "class-1",
      title: "Sunrise Strength",
      startsAt: "2026-05-01T06:30:00.000Z",
      durationMinutes: 50,
      locationName: "Atlas Centrum",
      trainerName: "Mila Coach",
      capacity: 18,
      bookedCount: 14,
      waitlistCount: 2,
      level: "mixed",
      focus: "strength and engine",
    },
  ],
};

describe("marketing content", () => {
  it("builds a landing experience for both owners and members", () => {
    const content = getPublicLandingContent(snapshot);

    expect(content.heroTitle).toBe(
      "Run je gym als een merk waar leden direct bij willen horen.",
    );
    expect(content.ownerSectionTitle).toBe("Voor gym owners");
    expect(content.memberSectionTitle).toBe("Voor leden");
    expect(content.primaryCta).toBe("Plan je launch");
    expect(content.secondaryCta).toBe("Bekijk lessen");
  });

  it("derives live proof and class fill labels from the reservation snapshot", () => {
    const content = getPublicLandingContent(snapshot);

    expect(content.stats.totalBooked).toBe(14);
    expect(content.stats.totalCapacity).toBe(18);
    expect(content.stats.waitlist).toBe(2);
    expect(content.proofCards[0]).toMatchObject({
      label: "Live bezetting",
      value: "78%",
    });
    expect(content.proofCards[0]?.helper).toContain("14 van 18 plekken");
    expect(content.proofCards[1]?.label).toBe("Bevestigde plekken");
    expect(content.ownerStage.statusLabel).toBe("Live operatie");
    expect(content.highlightedClasses[0]?.fillLabel).toBe("14 / 18 plekken gevuld");
    expect(content.highlightedClasses[0]?.trainerName).toBe("Mila Coach");
  });

  it("turns an empty tenant into a launch-oriented landing instead of dead zero proof", () => {
    const content = getPublicLandingContent({
      tenantName: "Jouw sportschool",
      tenantSlug: null,
      availableGyms: [],
      classSessions: [],
    });

    expect(content.proofCards[0]).toMatchObject({
      label: "Launchstatus",
      value: "Klaar voor live",
    });
    expect(content.proofCards[1]?.value).toBe("Eerste les");
    expect(content.ownerStage.statusLabel).toBe("Launch canvas");
    expect(content.ownerStage.primaryMetric.value).toBe("Eerste les");
    expect(content.ownerStage.secondaryMetric.value).toBe("Member-ready");
    expect(content.highlightedClasses).toHaveLength(0);
  });

  it("builds owner login momentum for both setup states", () => {
    const setupContent = getLoginExperienceContent({
      accountCount: 0,
      isSetupComplete: false,
    });
    const liveContent = getLoginExperienceContent({
      accountCount: 4,
      isSetupComplete: true,
    });

    expect(setupContent.heroTitle).toBe("Van eerste locatie tot volle lesroosters.");
    expect(setupContent.ownerHighlights).toContain("Boutique uitstraling");
    expect(setupContent.ownerHighlights).toContain("Omzet, bezetting en teamflow");
    expect(liveContent.momentumLabel).toBe("4 live accounts");
    expect(liveContent.reservationCta).toBe("Open reserveringspagina");
    expect(liveContent.bookingPromise).toContain("premium booking-ervaring");
  });

  it("uses singular login copy when exactly one live account exists", () => {
    const content = getLoginExperienceContent({
      accountCount: 1,
      isSetupComplete: true,
    });

    expect(content.momentumLabel).toBe("1 live account");
  });
});
