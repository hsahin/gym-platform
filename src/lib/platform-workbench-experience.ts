type PlatformWorkbenchExperienceInput = {
  locationsCount: number;
  membershipPlansCount: number;
  trainersCount: number;
  membersCount: number;
  classSessionsCount: number;
  staffCount: number;
  canManageStaff: boolean;
};

export type PlatformWorkbenchStep = {
  key: "locations" | "memberships" | "trainers" | "members" | "classes" | "staff";
  order: number;
  title: string;
  countLabel: string;
  helper: string;
  href: string;
  ctaLabel: string;
  statusLabel: string;
  statusTone: "complete" | "current" | "upcoming" | "locked";
};

type PlatformWorkbenchStepBase = Omit<PlatformWorkbenchStep, "href" | "ctaLabel">;

const stepTargets: Record<
  PlatformWorkbenchStep["key"],
  Pick<PlatformWorkbenchStep, "href" | "ctaLabel">
> = {
  classes: {
    href: "/dashboard/classes",
    ctaLabel: "Les plannen",
  },
  locations: {
    href: "/dashboard/settings",
    ctaLabel: "Vestiging toevoegen",
  },
  members: {
    href: "/dashboard/members",
    ctaLabel: "Lid toevoegen",
  },
  memberships: {
    href: "/dashboard/contracts",
    ctaLabel: "Contract toevoegen",
  },
  staff: {
    href: "/dashboard/settings",
    ctaLabel: "Team beheren",
  },
  trainers: {
    href: "/dashboard/settings",
    ctaLabel: "Trainer toevoegen",
  },
};

function attachStepTarget(step: PlatformWorkbenchStepBase): PlatformWorkbenchStep {
  return {
    ...step,
    ...stepTargets[step.key],
  };
}

function formatCountLabel(
  count: number,
  singular: string,
  plural: string,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getPlatformWorkbenchExperience(
  input: PlatformWorkbenchExperienceInput,
) {
  const coreSteps = [
    {
      key: "locations" as const,
      order: 1,
      title: "Vestiging live",
      count: input.locationsCount,
      countLabel: formatCountLabel(input.locationsCount, "vestiging", "vestigingen"),
      helper: "Locaties vormen de basis voor trainers, leden, lessen en capaciteit.",
    },
    {
      key: "memberships" as const,
      order: 2,
      title: "Lidmaatschappen klaar",
      count: input.membershipPlansCount,
      countLabel: formatCountLabel(
        input.membershipPlansCount,
        "lidmaatschap",
        "lidmaatschappen",
      ),
      helper: "Actieve plannen maken omzet, renewals en member-context direct geloofwaardig.",
    },
    {
      key: "trainers" as const,
      order: 3,
      title: "Coachteam opgebouwd",
      count: input.trainersCount,
      countLabel: formatCountLabel(input.trainersCount, "trainer", "trainers"),
      helper: "Zodra je trainers hebt, voelt het rooster als een echte studio-operatie.",
    },
    {
      key: "classes" as const,
      order: 4,
      title: "Rooster open",
      count: input.classSessionsCount,
      countLabel: formatCountLabel(input.classSessionsCount, "les", "lessen"),
      helper: "Met live lessen schakelt het platform vanzelf door naar bookings en check-ins.",
    },
  ];

  const currentStepIndex = coreSteps.findIndex((step) => step.count === 0);

  const steps: PlatformWorkbenchStepBase[] = coreSteps.map((step, index) => {
    if (step.count > 0) {
      return {
        ...step,
        statusLabel: "Klaar",
        statusTone: "complete",
      };
    }

    if (currentStepIndex === index) {
      return {
        ...step,
        statusLabel: "Nu",
        statusTone: "current",
      };
    }

    return {
      ...step,
      statusLabel: "Daarna",
      statusTone: "upcoming",
    };
  });

  const memberStep: PlatformWorkbenchStepBase =
    input.membersCount > 0
      ? {
          key: "members",
          order: 5,
          title: "Leden live",
          countLabel: formatCountLabel(input.membersCount, "lid", "leden"),
          helper:
            "Leden zijn zichtbaar in intake, boekingen en contactflow zodra je ze wilt toevoegen of importeren.",
          statusLabel: "Klaar",
          statusTone: "complete",
        }
      : {
          key: "members",
          order: 5,
          title: "Leden later toevoegen",
          countLabel: formatCountLabel(input.membersCount, "lid", "leden"),
          helper:
            "Dit kan later. Voeg leden toe zodra je eerste aanbod staat of importeer ze vlak voor livegang.",
          statusLabel: "Later",
          statusTone: "upcoming",
        };

  const staffCountLabel = formatCountLabel(
    input.staffCount,
    "account live",
    "accounts live",
  );

  const staffStep: PlatformWorkbenchStepBase = !input.canManageStaff
    ? {
        key: "staff",
        order: 6,
        title: "Teamrollen activeren",
        countLabel: staffCountLabel,
        helper: "Operations kan de vloer runnen, maar alleen de eigenaar opent of wijzigt teamaccounts.",
        statusLabel: "Alleen owner",
        statusTone: "locked",
      }
    : input.staffCount > 1
      ? {
          key: "staff",
          order: 6,
          title: "Teamrollen activeren",
          countLabel: staffCountLabel,
          helper: "Je team kan nu owner-, operations-, trainer- en frontdeskflows gebruiken.",
          statusLabel: "Live team",
          statusTone: "complete",
        }
      : {
          key: "staff",
          order: 6,
          title: "Teamrollen activeren",
          countLabel: staffCountLabel,
          helper: "Nodig operations, trainer of frontdesk uit zodra je team klaar is om mee te werken.",
          statusLabel: currentStepIndex === -1 ? "Optioneel" : "Daarna",
          statusTone: currentStepIndex === -1 ? "current" : "upcoming",
        };

  return {
    steps: [...steps, memberStep, staffStep].map(attachStepTarget),
  };
}
