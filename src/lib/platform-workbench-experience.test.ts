import { describe, expect, it } from "vitest";
import { getPlatformWorkbenchExperience } from "@/lib/platform-workbench-experience";

describe("platform workbench experience", () => {
  it("marks the first incomplete launch step as current for owners", () => {
    const experience = getPlatformWorkbenchExperience({
      locationsCount: 1,
      membershipPlansCount: 0,
      trainersCount: 0,
      membersCount: 0,
      classSessionsCount: 0,
      staffCount: 1,
      canManageStaff: true,
    });

    expect(experience.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "locations",
          countLabel: "1 vestiging",
          statusLabel: "Klaar",
          statusTone: "complete",
        }),
        expect.objectContaining({
          key: "memberships",
          countLabel: "0 lidmaatschappen",
          statusLabel: "Nu",
          statusTone: "current",
        }),
        expect.objectContaining({
          key: "staff",
          countLabel: "1 medewerkeraccount live",
          statusLabel: "Daarna",
          statusTone: "upcoming",
        }),
      ]),
    );
  });

  it("attaches the right dashboard CTA to every launch step", () => {
    const experience = getPlatformWorkbenchExperience({
      locationsCount: 0,
      membershipPlansCount: 0,
      trainersCount: 0,
      membersCount: 0,
      classSessionsCount: 0,
      staffCount: 1,
      canManageStaff: true,
    });

    expect(experience.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "locations",
          href: "/dashboard/settings",
          ctaLabel: "Vestiging toevoegen",
        }),
        expect.objectContaining({
          key: "memberships",
          href: "/dashboard/contracts",
          ctaLabel: "Lidmaatschap toevoegen",
        }),
        expect.objectContaining({
          key: "trainers",
          href: "/dashboard/settings",
          ctaLabel: "Trainer toevoegen",
        }),
        expect.objectContaining({
          key: "classes",
          href: "/dashboard/classes",
          ctaLabel: "Les plannen",
        }),
        expect.objectContaining({
          key: "members",
          href: "/dashboard/members",
          ctaLabel: "Lid toevoegen",
        }),
        expect.objectContaining({
          key: "staff",
          href: "/dashboard/settings",
          ctaLabel: "Medewerkers beheren",
        }),
      ]),
    );
  });

  it("treats member setup as a later step instead of a launch blocker", () => {
    const experience = getPlatformWorkbenchExperience({
      locationsCount: 1,
      membershipPlansCount: 1,
      trainersCount: 1,
      membersCount: 0,
      classSessionsCount: 0,
      staffCount: 1,
      canManageStaff: true,
    });

    expect(experience.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "classes",
          order: 4,
          statusLabel: "Nu",
          statusTone: "current",
        }),
        expect.objectContaining({
          key: "members",
          order: 5,
          statusLabel: "Later",
          statusTone: "upcoming",
        }),
      ]),
    );
  });

  it("switches the employee step to live once owner setup is complete", () => {
    const experience = getPlatformWorkbenchExperience({
      locationsCount: 1,
      membershipPlansCount: 1,
      trainersCount: 1,
      membersCount: 3,
      classSessionsCount: 4,
      staffCount: 4,
      canManageStaff: true,
    });

    expect(experience.steps.slice(0, 5).every((step) => step.statusLabel === "Klaar")).toBe(
      true,
    );
    expect(experience.steps[5]).toMatchObject({
      key: "staff",
      countLabel: "4 medewerkeraccounts live",
      statusLabel: "Medewerkers live",
      statusTone: "complete",
    });
  });

  it("keeps employee invitation optional when the launch core is done but only owner exists", () => {
    const experience = getPlatformWorkbenchExperience({
      locationsCount: 1,
      membershipPlansCount: 1,
      trainersCount: 1,
      membersCount: 1,
      classSessionsCount: 1,
      staffCount: 1,
      canManageStaff: true,
    });

    expect(experience.steps[5]).toMatchObject({
      key: "staff",
      countLabel: "1 medewerkeraccount live",
      statusLabel: "Optioneel",
      statusTone: "current",
    });
  });

  it("shows the staff step as owner-only for operations users", () => {
    const experience = getPlatformWorkbenchExperience({
      locationsCount: 1,
      membershipPlansCount: 1,
      trainersCount: 1,
      membersCount: 1,
      classSessionsCount: 1,
      staffCount: 4,
      canManageStaff: false,
    });

    expect(experience.steps[5]).toMatchObject({
      key: "staff",
      statusLabel: "Alleen eigenaar",
      statusTone: "locked",
    });
  });
});
