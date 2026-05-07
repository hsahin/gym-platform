export type ClassWeekdayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const CLASS_WEEKDAY_OPTIONS: ReadonlyArray<{
  readonly key: ClassWeekdayKey;
  readonly label: string;
}> = [
  { key: "monday", label: "Ma" },
  { key: "tuesday", label: "Di" },
  { key: "wednesday", label: "Wo" },
  { key: "thursday", label: "Do" },
  { key: "friday", label: "Vr" },
  { key: "saturday", label: "Za" },
  { key: "sunday", label: "Zo" },
];

const weekdayByJsDay: ReadonlyArray<ClassWeekdayKey> = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const localDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const localTimePattern = /^(\d{2}):(\d{2})$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseLocalDate(value: string) {
  const match = localDatePattern.exec(value);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseLocalDateTime(value: string) {
  const match = localDateTimePattern.exec(value);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function parseLocalTime(value: string) {
  const match = localTimePattern.exec(value);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour > 23 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

function toUtcDate(parts: { year: number; month: number; day: number }) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function formatLocalDateTime(
  date: Date,
  time: { hour: number; minute: number },
) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(time.hour)}:${pad(time.minute)}`;
}

function formatLocalDateTimeFromMinutes(date: Date, minutesAfterMidnight: number) {
  return formatLocalDateTime(date, {
    hour: Math.floor(minutesAfterMidnight / 60),
    minute: minutesAfterMidnight % 60,
  });
}

export function getWeekdayKeyForLocalDateTime(
  value: string,
): ClassWeekdayKey | null {
  const parsed = parseLocalDateTime(value);

  if (!parsed) {
    return null;
  }

  return weekdayByJsDay[toUtcDate(parsed).getUTCDay()] as ClassWeekdayKey;
}

export function buildWeeklyRecurringLocalStarts(input: {
  readonly anchorLocalStart: string;
  readonly weekdays: ReadonlyArray<ClassWeekdayKey>;
  readonly untilDate: string;
}) {
  const anchor = parseLocalDateTime(input.anchorLocalStart);
  const until = parseLocalDate(input.untilDate);

  if (!anchor || !until || input.weekdays.length === 0) {
    return [] as string[];
  }

  const selectedWeekdays = new Set(input.weekdays);
  const anchorDate = toUtcDate(anchor);
  const untilDate = toUtcDate(until);

  if (untilDate < anchorDate) {
    return [] as string[];
  }

  const starts: string[] = [];

  for (
    const cursor = new Date(anchorDate);
    cursor <= untilDate;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const weekday = weekdayByJsDay[cursor.getUTCDay()];

    if (!weekday || !selectedWeekdays.has(weekday)) {
      continue;
    }

    starts.push(
      formatLocalDateTime(cursor, {
        hour: anchor.hour,
        minute: anchor.minute,
      }),
    );
  }

  return starts;
}

export function buildOpenGymCapacityLocalStarts(input: {
  readonly anchorDate: string;
  readonly weekdays?: ReadonlyArray<ClassWeekdayKey>;
  readonly untilDate?: string;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly slotMinutes: number;
}) {
  const anchor = parseLocalDate(input.anchorDate);
  const opensAtMinutes = parseLocalTime(input.opensAt);
  const closesAtMinutes = parseLocalTime(input.closesAt);

  if (
    !anchor ||
    opensAtMinutes === null ||
    closesAtMinutes === null ||
    input.slotMinutes <= 0 ||
    closesAtMinutes <= opensAtMinutes
  ) {
    return [] as string[];
  }

  const anchorDate = toUtcDate(anchor);
  const until = input.untilDate ? parseLocalDate(input.untilDate) : null;
  const untilDate = until ? toUtcDate(until) : anchorDate;

  if (untilDate < anchorDate) {
    return [] as string[];
  }

  const selectedWeekdays = input.weekdays?.length ? new Set(input.weekdays) : null;
  const starts: string[] = [];

  for (
    const cursor = new Date(anchorDate);
    cursor <= untilDate;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const weekday = weekdayByJsDay[cursor.getUTCDay()];

    if (selectedWeekdays && (!weekday || !selectedWeekdays.has(weekday))) {
      continue;
    }

    for (
      let startMinutes = opensAtMinutes;
      startMinutes + input.slotMinutes <= closesAtMinutes;
      startMinutes += input.slotMinutes
    ) {
      starts.push(formatLocalDateTimeFromMinutes(cursor, startMinutes));
    }
  }

  return starts;
}
