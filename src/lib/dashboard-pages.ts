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
      helper: "Kerncijfers, planning, recente reserveringen en launchsignalen.",
    },
    {
      key: "classes",
      title: "Lessen",
      value: formatCountLabel(input.classSessionsCount, "les", "lessen"),
      helper: "Rooster, reserveringen, check-ins, capaciteit en wachtlijstbeheer.",
    },
    {
      key: "members",
      title: "Leden",
      value: formatCountLabel(input.membersCount, "lid", "leden"),
      helper: "Leden, intake-status, tags en membercontext per vestiging.",
    },
    {
      key: "contracts",
      title: "Contracten",
      value: formatCountLabel(input.membershipPlansCount, "contract", "contracten"),
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
      helper: "Workoutflows, voeding, voortgang en premium coachmomenten.",
    },
    {
      key: "retention",
      title: "Retentie",
      value: formatCountLabel(
        input.retentionFeaturesEnabled,
        "module actief",
        "modules actief",
      ),
      helper: "Uitdagingen, community's, vragenlijsten en retentieflows.",
    },
    {
      key: "access",
      title: "Toegang",
      value: input.canManageRemoteAccess
        ? input.remoteAccessStatusLabel
        : "Alleen owner",
      helper: "Remote toegang voor Nuki en andere gangbare slimme sloten.",
    },
    {
      key: "payments",
      title: "Betalingen",
      value: input.canManagePayments ? input.paymentsStatusLabel : "Alleen owner",
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
      helper: "White-label, mobile check-in en app-ervaringen voor leden en coaching.",
    },
    {
      key: "marketing",
      title: "Marketing",
      value: input.bookingsCount > 0 ? "Segmenten klaar" : "Eerste data nodig",
      helper: "Campagnes, retentie-signalen en bookingmomenten zonder losse tooling.",
    },
    {
      key: "integrations",
      title: "Integraties",
      value: formatCountLabel(
        input.integrationFeaturesEnabled,
        "koppeling live",
        "koppelingen live",
      ),
      helper: "Hardware, software, equipment en migratiekoppelingen per gym.",
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
        ? "Vestigingen, personeel, imports, platformstatus en owner-instellingen."
        : "Vestigingen, personeel, imports en owner-instellingen.",
    },
    {
      key: "superadmin",
      title: "Superadmin",
      value: input.canManageOwnerAccounts
        ? "Owner beheer"
        : input.canManageFeatureFlags
          ? "Flags beheer"
          : "Geen toegang",
      helper: "Owner accounts, moduleflags en rolloutcontrole voor het platform.",
    },
  ];

  return pages.map((page) => ({
    ...page,
    href: getDashboardPageHref(page.key),
  }));
}
