export const ALL_CLASS_TYPE_KEY = "all";

export interface ClassTypeSession {
  readonly focus: string;
  readonly title: string;
}

export interface ClassTypeTab {
  readonly key: string;
  readonly label: string;
  readonly focus: string;
  readonly defaultTitle: string;
  readonly description: string;
  readonly count: number;
}

const defaultClassTypes = [
  {
    focus: "HIIT",
    defaultTitle: "HIIT",
    description: "High intensity, engine en conditioning.",
  },
  {
    focus: "Strength",
    defaultTitle: "Strength Club",
    description: "Kracht, compound lifts en techniekblokken.",
  },
  {
    focus: "Boxing",
    defaultTitle: "Boxing",
    description: "Zaktraining, pads en cardio boxing.",
  },
  {
    focus: "Yoga",
    defaultTitle: "Yoga Flow",
    description: "Mobiliteit, ademhaling en herstel.",
  },
  {
    focus: "Pilates",
    defaultTitle: "Pilates",
    description: "Core, control en low-impact training.",
  },
  {
    focus: "PT",
    defaultTitle: "PT sessie",
    description: "Privé, intake of 1-op-1 coaching.",
  },
] as const;

export function normalizeClassTypeKey(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "overig"
  );
}

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function getCustomClassTypeLabel(labels: ReadonlyMap<string, string>, key: string) {
  return labels.get(key) || titleCase(key.replace(/-/g, " "));
}

export function getClassTypeKeyForSession(session: ClassTypeSession) {
  return normalizeClassTypeKey(session.focus || session.title);
}

export function buildClassTypeTabs(
  sessions: ReadonlyArray<ClassTypeSession>,
): ReadonlyArray<ClassTypeTab> {
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();

  for (const session of sessions) {
    const key = getClassTypeKeyForSession(session);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    labels.set(key, session.focus.trim() || session.title.trim());
  }

  const tabs: ClassTypeTab[] = [
    {
      key: ALL_CLASS_TYPE_KEY,
      label: "Alle lessen",
      focus: "",
      defaultTitle: "Nieuwe les",
      description: "Bekijk alle geplande lessen, ongeacht type.",
      count: sessions.length,
    },
    ...defaultClassTypes.map((classType) => {
      const key = normalizeClassTypeKey(classType.focus);

      return {
        key,
        label: classType.focus,
        focus: classType.focus,
        defaultTitle: classType.defaultTitle,
        description: classType.description,
        count: counts.get(key) ?? 0,
      };
    }),
  ];

  const defaultKeys = new Set(tabs.map((tab) => tab.key));
  const customTabs = [...counts.keys()]
    .filter((key) => !defaultKeys.has(key))
    .sort((left, right) =>
      getCustomClassTypeLabel(labels, left).localeCompare(
        getCustomClassTypeLabel(labels, right),
        "nl",
      ),
    )
    .map((key) => {
      const label = getCustomClassTypeLabel(labels, key);

      return {
        key,
        label,
        focus: label,
        defaultTitle: label,
        description: `Eigen lestype op basis van bestaande ${label}-lessen.`,
        count: counts.get(key) ?? 0,
      };
    });

  return [...tabs, ...customTabs];
}

export function filterClassSessionsByType<T extends ClassTypeSession>(
  sessions: ReadonlyArray<T>,
  selectedTypeKey: string,
) {
  if (!selectedTypeKey || selectedTypeKey === ALL_CLASS_TYPE_KEY) {
    return sessions;
  }

  return sessions.filter(
    (session) => getClassTypeKeyForSession(session) === selectedTypeKey,
  );
}

export function resolveSelectedClassType(
  tabs: ReadonlyArray<ClassTypeTab>,
  selectedTypeKey: string,
) {
  return (
    tabs.find((tab) => tab.key === selectedTypeKey) ??
    tabs.find((tab) => tab.key !== ALL_CLASS_TYPE_KEY) ??
    tabs[0]!
  );
}
