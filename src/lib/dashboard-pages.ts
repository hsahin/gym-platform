function formatCountLabel(
  count: number,
  singular: string,
  plural: string,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export const DASHBOARD_PAGE_KEYS = [
  "overview",
  "classes",
  "members",
  "contracts",
  "coaching",
  "retention",
  "access",
  "payments",
  "mobile",
  "marketing",
  "integrations",
  "settings",
  "superadmin",
] as const;

export type DashboardPageKey = (typeof DASHBOARD_PAGE_KEYS)[number];

export interface DashboardPagesInput {
  readonly locationsCount: number;
  readonly membershipPlansCount: number;
  readonly trainersCount: number;
  readonly membersCount: number;
  readonly classSessionsCount: number;
  readonly bookingsCount: number;
  readonly staffCount: number;
  readonly healthAttentionCount: number;
  readonly paymentsStatusLabel: string;
  readonly remoteAccessStatusLabel: string;
  readonly canManagePayments: boolean;
  readonly canManageRemoteAccess: boolean;
  readonly canManageStaff: boolean;
  readonly coachingFeaturesEnabled: number;
  readonly retentionFeaturesEnabled: number;
  readonly mobileFeaturesEnabled: number;
  readonly integrationFeaturesEnabled: number;
  readonly canManageFeatureFlags: boolean;
  readonly canManageOwnerAccounts: boolean;
  readonly canViewPlatformChecks: boolean;
}

export interface DashboardPageDefinition {
  readonly key: DashboardPageKey;
  readonly title: string;
  readonly value: string;
  readonly helper: string;
  readonly href: string;
}

export function isDashboardPageKey(input: string): input is DashboardPageKey {
  return DASHBOARD_PAGE_KEYS.includes(input as DashboardPageKey);
}

export function resolveDashboardRouteKey(input: string): DashboardPageKey | null {
  if (isDashboardPageKey(input)) {
    return input;
  }

  switch (input) {
    case "reservations":
    case "schedule":
      return "classes";
    case "smartdoors":
      return "access";
    case "nutrition":
      return "coaching";
    case "community":
      return "retention";
    case "app":
      return "mobile";
    case "hardware":
      return "integrations";
    case "locations":
    case "staff":
    case "imports":
    case "status":
      return "settings";
    case "feature-flags":
    case "super-admin":
      return "superadmin";
    default:
      return null;
  }
}

export function getDashboardPageHref(key: DashboardPageKey) {
  return key === "overview" ? "/dashboard" : `/dashboard/${key}`;
}

export function getDashboardPageForWorkbenchStep(
  stepKey: string,
): DashboardPageKey {
  switch (stepKey) {
    case "memberships":
      return "contracts";
    case "classes":
      return "classes";
    case "members":
      return "members";
    case "remote-access":
      return "access";
    case "coaching":
      return "coaching";
    case "retention":
      return "retention";
    case "payments":
      return "payments";
    case "mobile":
      return "mobile";
    case "integrations":
      return "integrations";
    case "feature-flags":
      return "superadmin";
    case "locations":
    case "trainers":
    case "staff":
    case "imports":
      return "settings";
    default:
      return "overview";
  }
}

export function getDashboardPages(
  input: DashboardPagesInput,
): ReadonlyArray<DashboardPageDefinition> {
  const pages: ReadonlyArray<Omit<DashboardPageDefinition, "href">> = [
    {
      key: "overview",
      title: "Overzicht",
      value: formatCountLabel(input.membersCount, "lid", "leden"),
      helper: "Kerncijfers, planning, recente reserveringen en livegangsignalen.",
    },
    {
      key: "classes",
      title: "Lessen",
      value: formatCountLabel(input.classSessionsCount, "les", "lessen"),
      helper: "Rooster, reserveringen, aanwezigheid, capaciteit en wachtlijstbeheer.",
    },
    {
      key: "members",
      title: "Leden",
      value: formatCountLabel(input.membersCount, "lid", "leden"),
      helper: "Leden, intake-status, tags en ledencontext per vestiging.",
    },
    {
      key: "contracts",
      title: "Contracten",
      value: formatCountLabel(input.membershipPlansCount, "lidmaatschap", "lidmaatschappen"),
      helper: "Maand-, 6-maanden- en jaarcontracten beheren voor lidmaatschappen.",
    },
    {
      key: "coaching",
      title: "Coaching",
      value: formatCountLabel(
        input.coachingFeaturesEnabled,
        "module actief",
        "modules actief",
      ),
      helper: "Trainingsschema's, voeding, voortgang en verdiepende coachmomenten.",
    },
    {
      key: "retention",
      title: "Retentie",
      value: formatCountLabel(
        input.retentionFeaturesEnabled,
        "module actief",
        "modules actief",
      ),
      helper: "Uitdagingen, community's, vragenlijsten en retentieroutes.",
    },
    {
      key: "access",
      title: "Toegang",
      value: input.canManageRemoteAccess
        ? input.remoteAccessStatusLabel
        : "Alleen eigenaar",
      helper: "Toegang op afstand voor Nuki en andere gangbare slimme sloten.",
    },
    {
      key: "payments",
      title: "Betalingen",
      value: input.canManagePayments ? input.paymentsStatusLabel : "Alleen eigenaar",
      helper: "Mollie, incasso, eenmalige betalingen en betaalverzoeken per gym.",
    },
    {
      key: "mobile",
      title: "Mobiele app",
      value: formatCountLabel(
        input.mobileFeaturesEnabled,
        "module actief",
        "modules actief",
      ),
      helper: "Merkapp, aankomstregistratie en app-ervaringen voor leden en coaching.",
    },
    {
      key: "marketing",
      title: "Marketing",
      value: input.bookingsCount > 0 ? "Segmenten klaar" : "Eerste data nodig",
      helper: "Campagnes, retentiesignalen en reserveringsmomenten zonder losse tooling.",
    },
    {
      key: "integrations",
      title: "Integraties",
      value: formatCountLabel(
        input.integrationFeaturesEnabled,
        "koppeling live",
        "koppelingen live",
      ),
      helper: "Apparaten, software, meetapparatuur en migratiekoppelingen per gym.",
    },
    {
      key: "settings",
      title: "Gym instellingen",
      value: input.canViewPlatformChecks
        ? input.healthAttentionCount === 0
          ? "Alles gezond"
          : formatCountLabel(input.healthAttentionCount, "check", "checks")
        : formatCountLabel(input.locationsCount, "vestiging", "vestigingen"),
      helper: input.canViewPlatformChecks
        ? "Vestigingen, medewerkers, import, systeemstatus en eigenaarsinstellingen."
        : "Vestigingen, medewerkers, import en eigenaarsinstellingen.",
    },
    {
      key: "superadmin",
      title: "Superadmin",
      value: input.canManageOwnerAccounts
        ? "Eigenaarsbeheer"
        : input.canManageFeatureFlags
          ? "Modulebeheer"
          : "Geen toegang",
      helper: "Eigenaarsaccounts en clubmodules beheren.",
    },
  ];

  return pages
    .filter((page) => page.key !== "superadmin" || input.canManageOwnerAccounts)
    .map((page) => ({
      ...page,
      href: getDashboardPageHref(page.key),
    }));
}
