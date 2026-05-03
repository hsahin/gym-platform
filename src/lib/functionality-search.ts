import {
  DASHBOARD_FEATURE_CATALOG,
  type DashboardFeatureDefinition,
} from "@/features/dashboard-feature-catalog";
import {
  getDashboardFeatureCategoryLabel,
  getDashboardFeatureStatusLabel,
  getDashboardFeatureUiCopy,
} from "@/features/dashboard-feature-copy";
import {
  DASHBOARD_PAGE_KEYS,
  getDashboardPageHref,
  type DashboardPageKey,
} from "@/lib/dashboard-pages";

export type FunctionalitySearchKind = "page" | "feature" | "workflow" | "public";

export interface FunctionalitySearchEntry {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly kind: FunctionalitySearchKind;
  readonly dashboardPage?: DashboardPageKey;
  readonly sourceKey?: string;
  readonly keywords: ReadonlyArray<string>;
  readonly requiresSuperadmin?: boolean;
}

export interface FunctionalitySearchPermissions {
  readonly canManageFeatureFlags: boolean;
  readonly canManageOwnerAccounts: boolean;
}

const pageCopy = {
  overview: {
    title: "Overzicht",
    description: "Kerncijfers, planning, reserveringen en clubstatus.",
    keywords: ["dashboard", "cockpit", "kpi", "statistieken", "gezondheid"],
  },
  classes: {
    title: "Lessen",
    description: "Rooster, reserveringen, aanwezigheid, capaciteit en wachtlijstbeheer.",
    keywords: ["rooster", "planning", "booking", "boekingen", "attendance"],
  },
  members: {
    title: "Leden",
    description: "Ledenbeheer, intake, toestemmingen, tags en ledenportaaltoegang.",
    keywords: ["ledenbeheer", "ledenportaal", "portal toegang", "waiver", "intake"],
  },
  contracts: {
    title: "Lidmaatschappen",
    description: "Lidmaatschappen, rittenkaarten, prijzen en contractimports.",
    keywords: ["lidmaatschap", "lidmaatschappen", "ritten", "csv", "import"],
  },
  coaching: {
    title: "Coaching",
    description: "Trainingsschema's, voeding, voortgang, PT-pakketten en coachagenda.",
    keywords: ["pt", "personal training", "workout", "nutrition", "voeding"],
  },
  retention: {
    title: "Retentie",
    description: "Clubgroepen, uitdagingen, vragenlijsten en opvolgroutes.",
    keywords: ["community", "challenges", "vragenlijst", "loyaliteit", "churn"],
  },
  access: {
    title: "Toegang",
    description: "Toegang op afstand, smartdeuren, sloten en toegangslogs.",
    keywords: ["smartdeur", "deur", "slot", "nuki", "open deur"],
  },
  payments: {
    title: "Betalingen",
    description: "Mollie, incasso, betaalverzoeken, terugbetalingen en dagafsluiting.",
    keywords: ["mollie", "incasso", "factuur", "terugbetaling"],
  },
  mobile: {
    title: "Mobiele app",
    description: "Merkapp, mobiele aankomstregistratie en zelfservice voor leden.",
    keywords: ["app", "qr", "mobile", "self-service", "portal"],
  },
  marketing: {
    title: "Marketing",
    description: "Aanvragen, campagnes, automatische opvolging en uitgaande berichten.",
    keywords: ["leads", "campagne", "email", "promoties", "whatsapp"],
  },
  integrations: {
    title: "Integraties",
    description: "Apparaten, software, meetapparatuur, statuschecks en migraties.",
    keywords: ["hardware", "software", "koppelingen", "virtuagym", "equipment"],
  },
  settings: {
    title: "Gym instellingen",
    description: "Vestigingen, trainers, medewerkers, juridische status en systeemstatus.",
    keywords: ["vestiging", "medewerkers", "juridisch", "status"],
  },
  superadmin: {
    title: "Superadmin",
    description: "Eigenaarsaccounts en clubmodules beheren.",
    keywords: ["eigenaar", "clubmodules", "modulebeheer", "beschikbaarheid"],
  },
} satisfies Record<
  DashboardPageKey,
  {
    readonly title: string;
    readonly description: string;
    readonly keywords: ReadonlyArray<string>;
  }
>;

const featureKeywords: Partial<Record<string, ReadonlyArray<string>>> = {
  "membership.management": [
    "leden",
    "ledenbeheer",
    "lidmaatschappen",
    "waivers",
    "ledenportaal",
    "ledenportaal toegang",
    "portal toegang",
  ],
  "staff.management": ["medewerkers", "rollen", "trainers", "balie"],
  "access.24_7": ["24/7", "toegang", "smartdeur", "slimme sloten", "nuki"],
  "checkin.studio": ["check-in", "qr", "attendance", "aanwezigheid"],
  "analytics.advanced": ["analytics", "rapportage", "bezetting", "omzet", "signalen"],
  "clubs.multi_location": ["multi gym", "vestigingen", "clubs"],
  "commerce.webshop_pos": ["webshop", "pos", "retail", "checkout"],
  "booking.scheduling": ["rooster", "planning", "lessen plannen", "schedule"],
  "booking.group_classes": ["groepsles", "reserveren", "wachtlijst"],
  "booking.one_to_one": ["pt", "1-op-1", "afspraak", "appointment"],
  "booking.online_trial": ["trial", "proefles", "public booking"],
  "booking.credit_system": ["ritten", "strippenkaart", "lesbundels"],
  "coaching.workout_plans": ["workout", "schema", "training plan"],
  "coaching.nutrition": ["voeding", "nutrition", "check-ins"],
  "coaching.on_demand_videos": ["video", "library", "content"],
  "coaching.progress_tracking": ["voortgang", "milestones", "progress"],
  "coaching.heart_rate": ["hartslag", "wearables", "zones"],
  "coaching.ai_max": ["ai", "coach", "suggesties"],
  "retention.planner": ["retentie", "churn", "follow-up"],
  "retention.community_groups": ["community", "groepen", "accountability"],
  "retention.challenges_rewards": ["challenges", "beloningen", "streak"],
  "retention.questionnaire": ["vragenlijst", "feedback", "intake"],
  "retention.pro_content": ["content", "pro", "educatie"],
  "retention.fitzone": ["fitzone", "lifestyle", "recovery"],
  "billing.processing": ["mollie", "betalingen", "settlement"],
  "billing.credit_cards": ["creditcard", "kaartbetaling", "checkout"],
  "billing.direct_debit": ["incasso", "sepa", "automatische incasso"],
  "billing.autocollect": ["collecties", "retry", "achterstand"],
  "mobile.white_label": ["white label", "mobiele app", "brand"],
  "mobile.fitness_coaching": ["fitness app", "coaching app", "schema"],
  "mobile.nutrition_coaching": ["nutrition app", "voeding app"],
  "mobile.checkin": ["qr", "mobile check-in", "aankomst"],
  "marketing.email": ["email", "campagne", "nurture"],
  "marketing.promotions": ["promoties", "banner", "upsell"],
  "marketing.leads": ["leads", "pipeline", "trial"],
  "integrations.hardware": ["hardware", "smartdeur", "scanner", "sloten"],
  "integrations.software": ["software", "crm", "bi", "koppeling"],
  "integrations.equipment": ["equipment", "apparatuur", "training equipment"],
  "integrations.virtuagym_connect": ["virtuagym", "migratie", "roster"],
  "integrations.body_composition": ["body composition", "meting", "scan"],
};

const workflowEntries = [
  {
    key: "workflow.add-location",
    title: "Vestiging toevoegen",
    description: "Nieuwe gymvestiging met capaciteit, manager en voorzieningen vastleggen.",
    href: "/dashboard/settings",
    dashboardPage: "settings",
    keywords: ["vestiging", "club", "filiaal", "manager"],
  },
  {
    key: "workflow.add-membership",
    title: "Lidmaatschap toevoegen",
    description: "Nieuw abonnement met prijs, duur en voordelen aanmaken.",
    href: "/dashboard/contracts",
    dashboardPage: "contracts",
    keywords: ["lidmaatschap", "prijs", "plan"],
  },
  {
    key: "workflow.add-trainer",
    title: "Trainer toevoegen",
    description: "Trainerprofiel met specialisaties en certificeringen beheren.",
    href: "/dashboard/settings",
    dashboardPage: "settings",
    keywords: ["coach", "medewerkers", "certificaten"],
  },
  {
    key: "workflow.plan-class",
    title: "Les plannen",
    description: "Losse of terugkerende lessen met trainer, vestiging en capaciteit plannen.",
    href: "/dashboard/classes",
    dashboardPage: "classes",
    keywords: ["rooster", "recurring", "wekelijks", "class"],
  },
  {
    key: "workflow.add-member",
    title: "Lid toevoegen",
    description: "Nieuw lid met lidmaatschap, vestiging, tags en portaltoegang aanmaken.",
    href: "/dashboard/members",
    dashboardPage: "members",
    keywords: ["lid", "intake", "portal", "lidaccount"],
  },
  {
    key: "workflow.import-contracts",
    title: "Lidmaatschappen en leden importeren",
    description: "Bestaande lidmaatschappen en leden via CSV naar de gymdataset brengen.",
    href: "/dashboard/contracts",
    dashboardPage: "contracts",
    keywords: ["csv", "migratie", "import", "leden"],
  },
  {
    key: "workflow.invite-staff",
    title: "Medewerker uitnodigen",
    description: "Eigenaar, manager, trainer of baliemedewerker toevoegen.",
    href: "/dashboard/settings",
    dashboardPage: "settings",
    keywords: ["medewerker", "rol", "account"],
  },
  {
    key: "workflow.connect-smart-door",
    title: "Smartdeur koppelen",
    description: "Nuki of andere slimme sloten verbinden en openen op afstand testen.",
    href: "/dashboard/access",
    dashboardPage: "access",
    keywords: ["smartdeur", "deur", "slot", "nuki", "open deur"],
  },
  {
    key: "workflow.connect-payments",
    title: "Betalingen koppelen",
    description: "Mollie-profiel, betaalroutes, supportmail en uitbetalingen instellen.",
    href: "/dashboard/payments",
    dashboardPage: "payments",
    keywords: ["mollie", "incasso", "sepa", "checkout", "betaalverzoek"],
  },
  {
    key: "workflow.test-payment-flow",
    title: "Testbetaling starten",
    description: "Betaallink of betaalverzoek previewen voor een lid of intakepakket.",
    href: "/dashboard/payments",
    dashboardPage: "payments",
    keywords: ["betaallink", "checkout", "invoice", "preview"],
  },
  {
    key: "workflow.legal-settings",
    title: "Juridische instellingen",
    description: "Voorwaarden, privacy, SEPA-incassantnummer, contracttemplate en toestemmingen beheren.",
    href: "/dashboard/settings",
    dashboardPage: "settings",
    keywords: ["voorwaarden", "privacy", "sepa", "waiver", "contract pdf"],
  },
  {
    key: "workflow.credit-pack",
    title: "Strippenkaart verkopen",
    description: "Ritten aan leden koppelen voor PT, afspraken en lesbundels.",
    href: "/dashboard/contracts",
    dashboardPage: "contracts",
    keywords: ["ritten", "pt", "strippenkaart", "afspraken"],
  },
  {
    key: "workflow.booking-policy",
    title: "Reserveringsregels instellen",
    description: "Proeflesreserveringen, wachtlijst, annuleringsvenster en reserveringsregels beheren.",
    href: "/dashboard/classes",
    dashboardPage: "classes",
    keywords: ["beleid", "wachtlijst", "annuleren", "proefles"],
  },
  {
    key: "workflow.lead-intake",
    title: "Nieuwe aanvragen beheren",
    description: "Nieuwe aanvragen, proeflesinteresse, bron en opvolging bijhouden.",
    href: "/dashboard/marketing",
    dashboardPage: "marketing",
    keywords: ["aanvragen", "pipeline", "proefles", "opvolging"],
  },
  {
    key: "workflow.owner-accounts",
    title: "Eigenaren beheren",
    description: "Eigenaarsaccounts aanmaken, archiveren en per club controleren.",
    href: "/dashboard/superadmin",
    dashboardPage: "superadmin",
    keywords: ["eigenaar", "superadmin", "tenant", "account"],
    requiresSuperadmin: true,
  },
  {
    key: "workflow.feature-flags",
    title: "Clubmodules beheren",
    description: "Modules per club of gebruiker aanzetten en beschikbaarheid controleren.",
    href: "/dashboard/superadmin",
    dashboardPage: "superadmin",
    keywords: ["clubmodules", "modules", "beschikbaarheid"],
    requiresSuperadmin: true,
  },
] satisfies ReadonlyArray<
  Omit<FunctionalitySearchEntry, "kind"> & {
    readonly dashboardPage: DashboardPageKey;
  }
>;

const publicEntries = [
  {
    key: "public.home",
    title: "Publieke website",
    description: "Landingspagina met gympositionering en routes naar reserveren of lid worden.",
    href: "/",
    keywords: ["home", "website", "landing"],
  },
  {
    key: "public.reserve",
    title: "Publiek reserveren",
    description: "Leden en prospects laten lessen of open-gym momenten boeken.",
    href: "/reserve",
    keywords: ["reserveren", "booking", "proefles", "les boeken"],
  },
  {
    key: "public.join",
    title: "Lid worden",
    description: "Publieke aanmeldroute voor lidmaatschappen, contractacceptatie en intake.",
    href: "/join",
    keywords: ["aanmelden", "inschrijven", "lid worden"],
  },
  {
    key: "public.pricing",
    title: "Prijzen",
    description: "Pakketten en prijsstelling voor de gymsoftware bekijken.",
    href: "/pricing",
    keywords: ["pricing", "tarieven", "abonnement"],
  },
  {
    key: "public.login",
    title: "Inloggen",
    description: "Eigenaar, medewerkers en platformaccounts laten inloggen.",
    href: "/login",
    keywords: ["login", "signin", "account", "setup"],
  },
] satisfies ReadonlyArray<
  Omit<FunctionalitySearchEntry, "kind" | "dashboardPage">
>;

function pageEntry(key: DashboardPageKey): FunctionalitySearchEntry {
  const copy = pageCopy[key];

  return {
    key: `page.${key}`,
    title: copy.title,
    description: copy.description,
    href: getDashboardPageHref(key),
    kind: "page",
    dashboardPage: key,
    keywords: copy.keywords,
    requiresSuperadmin: key === "superadmin",
  };
}

function featureEntry(feature: DashboardFeatureDefinition): FunctionalitySearchEntry {
  const copy = getDashboardFeatureUiCopy(feature);

  return {
    key: `feature.${feature.key}`,
    title: copy.title,
    description: copy.description,
    href: getDashboardPageHref(feature.dashboardPage),
    kind: "feature",
    dashboardPage: feature.dashboardPage,
    sourceKey: feature.key,
    keywords: [
      feature.title,
      feature.categoryTitle,
      getDashboardFeatureCategoryLabel(feature),
      getDashboardFeatureStatusLabel(feature.statusLabel),
      ...(featureKeywords[feature.key] ?? []),
    ],
  };
}

export const FUNCTIONALITY_SEARCH_ENTRIES: ReadonlyArray<FunctionalitySearchEntry> = [
  ...DASHBOARD_PAGE_KEYS.map(pageEntry),
  ...DASHBOARD_FEATURE_CATALOG.map(featureEntry),
  ...workflowEntries.map((entry) => ({ ...entry, kind: "workflow" as const })),
  ...publicEntries.map((entry) => ({ ...entry, kind: "public" as const })),
];

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("nl-NL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchableParts(entry: FunctionalitySearchEntry) {
  return [
    entry.title,
    entry.description,
    entry.href,
    entry.kind,
    entry.dashboardPage ?? "",
    entry.sourceKey ?? "",
    ...entry.keywords,
  ];
}

function scoreEntry(entry: FunctionalitySearchEntry, normalizedQuery: string) {
  const normalizedTitle = normalizeSearchText(entry.title);
  const normalizedKeywords = entry.keywords.map(normalizeSearchText);
  const normalizedDescription = normalizeSearchText(entry.description);
  const searchable = searchableParts(entry).map(normalizeSearchText).join(" ");
  const tokens = normalizedQuery.split(" ").filter(Boolean);

  if (normalizedTitle === normalizedQuery) {
    return 120;
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 105;
  }

  if (normalizedTitle.includes(normalizedQuery)) {
    return 95;
  }

  if (normalizedKeywords.some((keyword) => keyword === normalizedQuery)) {
    return 90;
  }

  if (normalizedKeywords.some((keyword) => keyword.includes(normalizedQuery))) {
    return 80;
  }

  if (normalizedDescription.includes(normalizedQuery)) {
    return 70;
  }

  if (tokens.length > 0 && tokens.every((token) => searchable.includes(token))) {
    return 55 + tokens.length;
  }

  return 0;
}

export function getVisibleFunctionalitySearchEntries(
  permissions: FunctionalitySearchPermissions,
  entries: ReadonlyArray<FunctionalitySearchEntry> = FUNCTIONALITY_SEARCH_ENTRIES,
) {
  const canOpenSuperadmin = permissions.canManageOwnerAccounts;

  return entries.filter((entry) => !entry.requiresSuperadmin || canOpenSuperadmin);
}

export function searchFunctionality(
  query: string,
  options?: {
    readonly entries?: ReadonlyArray<FunctionalitySearchEntry>;
    readonly limit?: number;
  },
) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  return (options?.entries ?? FUNCTIONALITY_SEARCH_ENTRIES)
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, normalizedQuery),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, "nl"))
    .slice(0, options?.limit ?? 8)
    .map((match) => match.entry);
}

export function resolveFunctionalitySearchHref(
  entry: FunctionalitySearchEntry,
  tenantId?: string,
) {
  if (!tenantId || (entry.href !== "/reserve" && entry.href !== "/join")) {
    return entry.href;
  }

  return `${entry.href}?gym=${encodeURIComponent(tenantId)}`;
}
