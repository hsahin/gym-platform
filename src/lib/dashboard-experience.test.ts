import { describe, expect, it } from "vitest";
import { getDashboardExperience } from "@/lib/dashboard-experience";

describe("dashboard experience", () => {
  it("builds a guided launch mode when the club is still empty", () => {
    const experience = getDashboardExperience({
      locationsCount: 0,
      membershipPlansCount: 0,
      trainersCount: 0,
      membersCount: 0,
      classSessionsCount: 0,
      bookingsCount: 0,
      healthAttentionCount: 2,
    });

    expect(experience.isLaunchMode).toBe(true);
    expect(experience.pageHeroTitle).toBe(
      "Je gym staat klaar voor de eerste live week.",
    );
    expect(experience.progressValue).toBe("0% live");
    expect(experience.nextStep.label).toBe("Vestiging");
    expect(experience.actionTitle).toBe("Werk je club live in vier heldere stappen");
    expect(experience.launchSteps[0]).toMatchObject({
      label: "Vestiging",
      statusLabel: "Nu doen",
      complete: false,
    });
    expect(experience.launchSteps.map((step) => step.label)).toEqual([
      "Vestiging",
      "Lidmaatschap",
      "Trainer",
      "Les",
    ]);
    expect(experience.screenChapters).toEqual([
      expect.objectContaining({
        key: "today",
        title: "Vandaag",
        value: "0 lessen",
      }),
      expect.objectContaining({
        key: "bookings",
        title: "Reserveringen",
        value: "Start bij je eerste les",
      }),
      expect.objectContaining({
        key: "members",
        title: "Leden",
        value: "0 leden",
      }),
      expect.objectContaining({
        key: "platform",
        title: "Platform",
        value: "0/4 live",
      }),
    ]);
  });

  it("switches to operations mode once the core launch steps are complete", () => {
    const experience = getDashboardExperience({
      locationsCount: 1,
      membershipPlansCount: 2,
      trainersCount: 3,
      membersCount: 24,
      classSessionsCount: 8,
      bookingsCount: 32,
      healthAttentionCount: 1,
    });

    expect(experience.isLaunchMode).toBe(false);
    expect(experience.pageHeroTitle).toBe(
      "Je club voelt nu als een sterk merk, ook achter de schermen.",
    );
    expect(experience.progressValue).toBe("100% live");
    expect(experience.nextStep.label).toBe("Live gezet");
    expect(experience.actionTitle).toBe("Nieuwe reservering of snelle check");
    expect(experience.launchSteps.every((step) => step.complete)).toBe(true);
    expect(experience.screenChapters).toEqual([
      expect.objectContaining({
        key: "today",
        value: "8 lessen",
      }),
      expect.objectContaining({
        key: "bookings",
        value: "32 reserveringen",
      }),
      expect.objectContaining({
        key: "members",
        value: "24 leden",
      }),
      expect.objectContaining({
        key: "platform",
        value: "1 check",
      }),
    ]);
  });

  it("shows a healthy platform label when there are no owner checks", () => {
    const experience = getDashboardExperience({
      locationsCount: 1,
      membershipPlansCount: 1,
      trainersCount: 1,
      membersCount: 1,
      classSessionsCount: 1,
      bookingsCount: 1,
      healthAttentionCount: 0,
    });

    expect(experience.screenChapters.find((chapter) => chapter.key === "platform")).toMatchObject({
      value: "Platform live",
    });
  });

  it("keeps dashboard experience copy in Dutch business language", () => {
    const launchExperience = getDashboardExperience({
      locationsCount: 0,
      membershipPlansCount: 0,
      trainersCount: 0,
      membersCount: 0,
      classSessionsCount: 0,
      bookingsCount: 0,
      healthAttentionCount: 2,
    });
    const liveExperience = getDashboardExperience({
      locationsCount: 1,
      membershipPlansCount: 2,
      trainersCount: 3,
      membersCount: 24,
      classSessionsCount: 8,
      bookingsCount: 32,
      healthAttentionCount: 1,
    });
    const visibleCopy = [
      launchExperience,
      liveExperience,
    ].flatMap((experience) => [
      experience.pageHeroTitle,
      experience.pageHeroDescription,
      experience.sectionTitle,
      experience.sectionDescription,
      experience.actionTitle,
      experience.actionDescription,
      ...experience.launchSteps.map((step) => `${step.label} ${step.helper}`),
      ...experience.screenChapters.map((chapter) => `${chapter.title} ${chapter.helper}`),
    ]).join("\n");

    for (const fragment of [
      "premium",
      "Membership",
      "membership",
      "renewals",
      "member journey",
      "frontdesk",
      "check-ins",
      "member-bookings",
      "Stack live",
      "gym-stack",
      "launchcanvas",
      "launchpad",
      "booking",
    ]) {
      expect(visibleCopy).not.toContain(fragment);
    }
  });
});
