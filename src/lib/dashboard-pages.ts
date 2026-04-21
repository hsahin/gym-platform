function formatCountLabel(
  count: number,
  singular: string,
  plural: string,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export const DASHBOARD_PAGE_KEYS = [
  "overview",
  "reservations",
  "members",
  "contracts",
  "schedule",
  "locations",
  "staff",
  "payments",
  "smartdoors",
  "imports",
  "status",
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

export function getDashboardPageHref(key: DashboardPageKey) {
  return key === "overview" ? "/dashboard" : `/dashboard/${key}`;
}

export function getDashboardPageForWorkbenchStep(
  stepKey: string,
): DashboardPageKey {
  switch (stepKey) {
    case "locations":
      return "locations";
    case "memberships":
      return "contracts";
    case "trainers":
    case "staff":
      return "staff";
    case "classes":
      return "schedule";
    case "members":
      return "members";
    case "imports":
      return "imports";
    case "remote-access":
      return "smartdoors";
    case "payments":
      return "payments";
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
      value: formatCountLabel(input.classSessionsCount, "les", "lessen"),
      helper: "Dagstart met planning, open acties en de belangrijkste clubsituatie.",
    },
    {
      key: "reservations",
      title: "Reserveringen",
      value: formatCountLabel(input.bookingsCount, "reservering", "reserveringen"),
      helper: "Boekingen, check-ins, no-shows, annuleringen en wachtlijstbeheer.",
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
      helper: "Maand, 6 maanden en jaarcontracten beheren voor memberships.",
    },
    {
      key: "schedule",
      title: "Rooster",
      value: formatCountLabel(input.classSessionsCount, "les", "lessen"),
      helper: "Lessen plannen, capaciteit bepalen en trainers koppelen.",
    },
    {
      key: "locations",
      title: "Vestigingen",
      value: formatCountLabel(input.locationsCount, "vestiging", "vestigingen"),
      helper: "Alle gym-locaties met capaciteit, manager en faciliteiten.",
    },
    {
      key: "staff",
      title: "Personeel",
      value: input.canManageStaff
        ? formatCountLabel(input.staffCount, "account", "accounts")
        : "Owner-only",
      helper: "Teamaccounts, trainers, frontdesk en operationsrollen apart beheren.",
    },
    {
      key: "payments",
      title: "Betalingen",
      value: input.canManagePayments ? input.paymentsStatusLabel : "Owner-only",
      helper: "Mollie, incasso, eenmalige betalingen en betaalverzoeken per gym.",
    },
    {
      key: "smartdoors",
      title: "Smartdeurs",
      value: input.canManageRemoteAccess
        ? input.remoteAccessStatusLabel
        : "Owner-only",
      helper: "Remote toegang voor Nuki en andere gangbare slimme sloten.",
    },
    {
      key: "imports",
      title: "Import",
      value: input.locationsCount > 0 ? "CSV klaar" : "Vestiging nodig",
      helper: "Bestaande klanten en lopende contracten gecontroleerd importeren.",
    },
    {
      key: "status",
      title: "Status",
      value:
        input.healthAttentionCount === 0
          ? "Alles gezond"
          : formatCountLabel(input.healthAttentionCount, "check", "checks"),
      helper: "Platformstatus, modules, omzetprojectie en auditlog zonder technische ruis.",
    },
  ];

  return pages.map((page) => ({
    ...page,
    href: getDashboardPageHref(page.key),
  }));
}
