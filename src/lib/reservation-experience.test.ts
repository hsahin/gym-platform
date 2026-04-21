import { describe, expect, it } from "vitest";
import { getReservationExperience } from "@/lib/reservation-experience";
import type { PublicReservationSnapshot } from "@/server/types";

const liveSnapshot: PublicReservationSnapshot = {
  tenantName: "Atlas Horizon Club",
  tenantSlug: "atlas-horizon-club",
  availableGyms: [
    {
      id: "atlas-horizon-club",
      slug: "atlas-horizon-club",
      name: "Atlas Horizon Club",
    },
  ],
  classSessions: [
    {
      id: "class-1",
      title: "Sunrise Strength",
      startsAt: "2026-05-01T06:30:00.000Z",
      durationMinutes: 50,
      locationName: "Atlas Oost",
      trainerName: "Milan de Vries",
      capacity: 16,
      bookedCount: 12,
      waitlistCount: 1,
      level: "mixed",
      focus: "strength",
    },
    {
      id: "class-2",
      title: "Recovery Flow",
      startsAt: "2026-05-01T08:00:00.000Z",
      durationMinutes: 45,
      locationName: "Atlas Oost",
      trainerName: "Nadia Vermeer",
      capacity: 14,
      bookedCount: 7,
      waitlistCount: 0,
      level: "beginner",
      focus: "mobility",
    },
  ],
};

describe("reservation experience", () => {
  it("builds live consumer proof from the current roster", () => {
    const experience = getReservationExperience(liveSnapshot);

    expect(experience.heroBadges).toEqual([
      "Member journey",
      "Live rooster",
      "Direct bevestigd",
    ]);
    expect(experience.rosterSummary.value).toBe("2 lessen live");
    expect(experience.rosterSummary.helper).toContain("11 openstaande plekken");
    expect(experience.promiseCards[0]?.title).toBe("Snelle keuze");
  });

  it("turns an empty roster into a premium pre-launch state", () => {
    const experience = getReservationExperience({
      tenantName: "Atlas Horizon Club",
      tenantSlug: "atlas-horizon-club",
      availableGyms: [
        {
          id: "atlas-horizon-club",
          slug: "atlas-horizon-club",
          name: "Atlas Horizon Club",
        },
      ],
      classSessions: [],
    });

    expect(experience.heroBadges).toEqual([
      "Founder edition",
      "Binnenkort live",
      "Member-ready",
    ]);
    expect(experience.emptyState?.title).toBe("Nieuwe class drops openen hier als eerste.");
    expect(experience.emptyState?.highlights).toContain(
      "De eerste live les activeert direct reserveringen, wachtlijst en confirmations.",
    );
    expect(experience.rosterSummary.value).toBe("Opening in opbouw");
  });
});
