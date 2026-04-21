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
  "access",
  "payments",
  "marketing",
  "settings",
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
    case "locations":
    case "staff":
    case "imports":
    case "status":
      return "settings";
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
    case "payments":
      return "payments";
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
      title: "Dashboard",
      value: formatCountLabel(input.membersCount, "lid", "leden"),
      helper: "Owner facts, planning, recente reserveringen en launch-signalen.",
    },
    {
      key: "classes",
      title: "Classes",
      value: formatCountLabel(input.classSessionsCount, "les", "lessen"),
      helper: "Rooster, reserveringen, check-ins, capaciteit en wachtlijstbeheer.",
    },
    {
      key: "members",
      title: "Members",
      value: formatCountLabel(input.membersCount, "lid", "leden"),
      helper: "Leden, intake-status, tags en membercontext per vestiging.",
    },
    {
      key: "contracts",
      title: "Contracten",
      value: formatCountLabel(input.membershipPlansCount, "contract", "contracten"),
      helper: "Maand, 6 maanden en jaarcontracten beheren voor memberships.",
    },
    {
      key: "access",
      title: "Smartdeurs",
      value: input.canManageRemoteAccess
        ? input.remoteAccessStatusLabel
        : "Owner-only",
      helper: "Remote toegang voor Nuki en andere gangbare slimme sloten.",
    },
    {
      key: "payments",
      title: "Betalingen",
      value: input.canManagePayments ? input.paymentsStatusLabel : "Owner-only",
      helper: "Mollie, incasso, eenmalige betalingen en betaalverzoeken per gym.",
    },
    {
      key: "marketing",
      title: "Marketing",
      value: input.bookingsCount > 0 ? "Segmenten klaar" : "Eerste data nodig",
      helper: "Campagnes, retentie-signalen en bookingmomenten zonder losse tooling.",
    },
    {
      key: "settings",
      title: "Settings",
      value:
        input.healthAttentionCount === 0
          ? "Alles gezond"
          : formatCountLabel(input.healthAttentionCount, "check", "checks"),
      helper: "Vestigingen, personeel, imports, platformstatus en owner-instellingen.",
    },
  ];

  return pages.map((page) => ({
    ...page,
    href: getDashboardPageHref(page.key),
  }));
}
