function formatCountLabel(
  count: number,
  singular: string,
  plural: string,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export interface DashboardExperienceInput {
  readonly locationsCount: number;
  readonly membershipPlansCount: number;
  readonly trainersCount: number;
  readonly membersCount: number;
  readonly classSessionsCount: number;
  readonly bookingsCount: number;
  readonly healthAttentionCount: number;
}

export interface DashboardLaunchStep {
  readonly key: string;
  readonly label: string;
  readonly helper: string;
  readonly complete: boolean;
  readonly statusLabel: string;
}

export interface DashboardScreenChapter {
  readonly key: "today" | "bookings" | "members" | "platform";
  readonly title: string;
  readonly value: string;
  readonly helper: string;
}

export function getDashboardExperience(input: DashboardExperienceInput) {
  const launchSteps: DashboardLaunchStep[] = [
    {
      key: "locations",
      label: "Vestiging",
      complete: input.locationsCount > 0,
      helper:
        input.locationsCount > 0
          ? `${formatCountLabel(input.locationsCount, "vestiging", "vestigingen")} klaar als basis voor je team en rooster.`
          : "Voeg je eerste vestiging toe zodat trainers, leden en lessen een duidelijke thuisbasis krijgen.",
      statusLabel:
        input.locationsCount > 0 ? "Klaar" : "Nu doen",
    },
    {
      key: "memberships",
      label: "Membership",
      complete: input.membershipPlansCount > 0,
      helper:
        input.membershipPlansCount > 0
          ? `${formatCountLabel(input.membershipPlansCount, "membership", "memberships")} gekoppeld aan je clubpropositie.`
          : "Maak een membership aan zodat je leden, omzet en renewals vanuit echte plannen kunt opbouwen.",
      statusLabel:
        input.membershipPlansCount > 0 ? "Klaar" : "Daarna",
    },
    {
      key: "trainers",
      label: "Trainer",
      complete: input.trainersCount > 0,
      helper:
        input.trainersCount > 0
          ? `${formatCountLabel(input.trainersCount, "trainer", "trainers")} klaar voor planning en coachflow.`
          : "Voeg je eerste trainer toe voordat je lessen plant, zodat de member journey meteen geloofwaardig voelt.",
      statusLabel:
        input.trainersCount > 0 ? "Klaar" : "Daarna",
    },
    {
      key: "classes",
      label: "Les",
      complete: input.classSessionsCount > 0,
      helper:
        input.classSessionsCount > 0
          ? `${formatCountLabel(input.classSessionsCount, "les", "lessen")} live voor reserveringen en frontdeskflow.`
          : "Plan je eerste les en open daarna direct de publieke reserveringsflow voor leden.",
      statusLabel:
        input.classSessionsCount > 0 ? "Klaar" : "Launch",
    },
  ];

  const completedSteps = launchSteps.filter((step) => step.complete).length;
  const progress = Math.round((completedSteps / launchSteps.length) * 100);
  const nextStep =
    launchSteps.find((step) => !step.complete) ?? {
      label: "Live gezet",
      helper:
        "Je basis staat. Tijd om reserveringen, check-ins en teamritme dagelijks te laten lopen.",
    };
  const isLaunchMode = completedSteps < launchSteps.length;
  const screenChapters: DashboardScreenChapter[] = [
    {
      key: "today",
      title: "Vandaag",
      value: formatCountLabel(input.classSessionsCount, "les", "lessen"),
      helper: isLaunchMode
        ? "Je rooster krijgt hier meteen een premium dagoverzicht zodra je eerste les live staat."
        : "Je eerstvolgende lessen, coaches en locaties in één ritme.",
    },
    {
      key: "bookings",
      title: "Reserveringen",
      value:
        isLaunchMode && input.bookingsCount === 0
          ? "Start bij je eerste les"
          : formatCountLabel(input.bookingsCount, "reservering", "reserveringen"),
      helper: isLaunchMode
        ? "Zodra je eerste les live staat, lopen member-bookings en frontdeskbeheer hier samen."
        : "Status, check-ins, no-shows en annuleringen op één plek.",
    },
    {
      key: "members",
      title: "Leden",
      value: formatCountLabel(input.membersCount, "lid", "leden"),
      helper: isLaunchMode
        ? "Voeg leden toe zodra je eerste aanbod live staat, handmatig of later via import."
        : "Je belangrijkste leden, plannen en teamcontext in één overzicht.",
    },
    {
      key: "platform",
      title: "Platform",
      value: isLaunchMode
        ? `${completedSteps}/${launchSteps.length} live`
        : input.healthAttentionCount === 0
          ? "Stack live"
          : formatCountLabel(
              input.healthAttentionCount,
              "check",
              "checks",
            ),
      helper: isLaunchMode
        ? "Hier bouw je vestigingen, memberships, trainers, leden en lessen op."
        : "Health, modules, revenue en audittrail voor je hele gym-stack.",
    },
  ];

  return {
    isLaunchMode,
    pageHeroTitle: isLaunchMode
      ? "Je premium gym staat klaar voor de eerste live week."
      : "Je club voelt nu als een premium merk, ook achter de schermen.",
    pageHeroDescription: isLaunchMode
      ? "Zet je eerste vestiging, membership, trainer en les live. Leden en team kun je daarna in je eigen tempo aanvullen."
      : "Combineer een sterke eerste indruk met dagelijkse rust in de operatie: reserveringen, leden, planning en open acties zitten in één ritme.",
    sectionTitle: isLaunchMode
      ? "Werk je launch doelgericht af"
      : "Wat vraagt vandaag aandacht?",
    sectionDescription: isLaunchMode
      ? "In deze eerste fase draait het om vier bouwstenen. Rond je die af, dan verandert deze omgeving van launchcanvas naar live operatie."
      : "De belangrijkste acties staan bovenaan: de eerstvolgende les, open intakepunten en de laatste mutaties aan de balie.",
    progressValue: `${progress}% live`,
    progressHelper: `${completedSteps} van ${launchSteps.length} bouwstenen klaar.`,
    nextStep,
    actionTitle: isLaunchMode
      ? "Werk je club live in vier heldere stappen"
      : "Nieuwe booking of snelle check",
    actionDescription: isLaunchMode
      ? "Gebruik de dashboardpagina's hieronder als launchpad. Zodra je eerste les live staat, kun je daarna leden, betalingen en teamritme verder uitbouwen."
      : "Gebruik dit blok voor de meest voorkomende dagelijkse taak. De juiste gym- en rolrechten lopen op de achtergrond mee.",
    launchSteps,
    screenChapters,
  };
}
