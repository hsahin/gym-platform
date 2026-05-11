"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Filter,
  MapPin,
  Plus,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Users,
} from "lucide-react";
import { Card, Chip, Label, Separator } from "@heroui/react";
import { Widget } from "@heroui-pro/react";
import { HoverCard } from "@heroui-pro/react/hover-card";
import { CalendarDatePicker } from "@/components/CalendarDatePicker";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { NativeSelect } from "@/components/dashboard/HydrationSafeNativeSelect";
import { Segment } from "@/components/dashboard/HydrationSafeSegment";
import {
  getBookingKindLabel,
  getClassLevelLabel,
  getEntityStatusLabel,
} from "@/lib/ui-labels";
import type { ClassSession, GymLocation, GymTrainer } from "@/server/types";

type SchedulerMode = "week" | "day";
type TimeBand = "morning" | "afternoon" | "evening";

interface ClassSchedulerProps {
  readonly sessions: ReadonlyArray<ClassSession>;
  readonly locations: ReadonlyArray<GymLocation>;
  readonly trainers: ReadonlyArray<GymTrainer>;
  readonly selectedSessionId?: string | null;
  readonly onPlanClass?: (dateValue: string) => void;
  readonly onSelectSession?: (sessionId: string) => void;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildWeekDays(anchorDate: Date) {
  const firstDay = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(firstDay, index));
}

function isSameLocalDay(left: Date, right: Date) {
  return formatDateInput(left) === formatDateInput(right);
}

function formatWeekRange(anchorDate: Date) {
  const days = buildWeekDays(anchorDate);
  const first = days[0]!;
  const last = days[6]!;
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
  });

  return `${formatter.format(first)} - ${formatter.format(last)}`;
}

function formatLongDayLabel(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatWeekdayShort(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", { weekday: "short" }).format(date);
}

function formatDayNumber(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric" }).format(date);
}

function formatMonthShort(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", { month: "short" }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTimeRange(session: ClassSession) {
  const start = new Date(session.startsAt);
  const end = new Date(start.getTime() + session.durationMinutes * 60 * 1000);
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function getInitialDateValue(sessions: ReadonlyArray<ClassSession>) {
  const firstSession = [...sessions].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  )[0];

  return firstSession
    ? formatDateInput(new Date(firstSession.startsAt))
    : formatDateInput(new Date());
}

function getOccupancyTone(session: ClassSession) {
  const ratio = session.capacity > 0 ? session.bookedCount / session.capacity : 0;

  if (ratio >= 1) {
    return "danger" as const;
  }

  if (ratio >= 0.85) {
    return "warning" as const;
  }

  return "success" as const;
}

function compactCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getTimeBand(date: Date): TimeBand {
  const hour = date.getHours();

  if (hour < 12) {
    return "morning";
  }

  if (hour < 17) {
    return "afternoon";
  }

  return "evening";
}

const TIME_BAND_LABEL: Record<TimeBand, string> = {
  morning: "Ochtend",
  afternoon: "Middag",
  evening: "Avond",
};

const TIME_BAND_ICON: Record<TimeBand, typeof Sun> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
};

function groupSessionsByTimeBand(sessions: ReadonlyArray<ClassSession>) {
  const groups = new Map<TimeBand, ClassSession[]>();

  for (const session of sessions) {
    const band = getTimeBand(new Date(session.startsAt));
    const bucket = groups.get(band);

    if (bucket) {
      bucket.push(session);
    } else {
      groups.set(band, [session]);
    }
  }

  return (["morning", "afternoon", "evening"] as const)
    .map((band) => ({ band, items: groups.get(band) ?? [] }))
    .filter((entry) => entry.items.length > 0);
}

function summarizeDayOccupancy(sessions: ReadonlyArray<ClassSession>) {
  const capacity = sessions.reduce((total, session) => total + session.capacity, 0);
  const booked = sessions.reduce((total, session) => total + session.bookedCount, 0);
  const ratio = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

  return { booked, capacity, ratio };
}

function getOccupancyChipColor(ratio: number) {
  if (ratio >= 100) {
    return "danger" as const;
  }

  if (ratio >= 85) {
    return "warning" as const;
  }

  return "default" as const;
}

interface SessionHoverDetailsProps {
  readonly session: ClassSession;
  readonly locationName: string;
  readonly trainerName: string;
  readonly isSelected: boolean;
  readonly onSelect?: (sessionId: string) => void;
}

function SessionHoverDetails({
  session,
  locationName,
  trainerName,
  isSelected,
  onSelect,
}: SessionHoverDetailsProps) {
  return (
    <div className="grid w-72 gap-3 p-3">
      <div className="grid gap-1">
        <p className="text-foreground text-sm font-semibold leading-tight">
          {session.title}
        </p>
        <p className="text-muted flex items-center gap-1.5 text-xs tabular-nums">
          <Clock className="size-3.5" aria-hidden="true" />
          {formatTimeRange(session)}
        </p>
      </div>

      <Separator />

      <div className="text-muted grid gap-1.5 text-xs">
        <span className="flex min-w-0 items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{locationName}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Users className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{trainerName}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Dumbbell className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {getBookingKindLabel(session.bookingKind ?? "class")} ·{" "}
            {getClassLevelLabel(session.level)}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip color={getOccupancyTone(session)} size="sm" variant="soft">
          {session.bookedCount}/{session.capacity}
        </Chip>
        <Chip size="sm" variant="tertiary">
          {getEntityStatusLabel(session.status)}
        </Chip>
        {session.waitlistCount > 0 ? (
          <Chip color="warning" size="sm" variant="soft">
            {session.waitlistCount} wachtlijst
          </Chip>
        ) : null}
      </div>

      {onSelect ? (
        <Button
          fullWidth
          size="sm"
          type="button"
          variant={isSelected ? "primary" : "outline"}
          onPress={() => onSelect(session.id)}
        >
          {isSelected ? (
            <>
              <CheckCheck className="size-3.5" aria-hidden="true" />
              In beheer
            </>
          ) : (
            "Beheer deze les"
          )}
        </Button>
      ) : null}
    </div>
  );
}

interface CompactSessionPillProps {
  readonly session: ClassSession;
  readonly locationName: string;
  readonly trainerName: string;
  readonly isSelected: boolean;
  readonly onSelect?: (sessionId: string) => void;
}

function CompactSessionPill({
  session,
  locationName,
  trainerName,
  isSelected,
  onSelect,
}: CompactSessionPillProps) {
  return (
    <HoverCard>
      <HoverCard.Trigger>
        <button
          aria-current={isSelected ? "true" : undefined}
          aria-label={`Beheer ${session.title}, ${formatTimeRange(session)}, ${locationName}`}
          className={`focus-visible:outline-accent grid w-full gap-0.5 rounded-lg border px-2 py-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
            isSelected
              ? "border-accent bg-accent/10 shadow-sm"
              : "border-border bg-surface hover:border-accent/40 hover:bg-surface-tertiary"
          }`}
          type="button"
          onClick={() => onSelect?.(session.id)}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-foreground truncate text-[0.7rem] font-semibold tabular-nums">
              {formatTime(new Date(session.startsAt))}
            </span>
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${
                getOccupancyTone(session) === "danger"
                  ? "bg-danger"
                  : getOccupancyTone(session) === "warning"
                    ? "bg-warning"
                    : "bg-success"
              }`}
            />
          </div>
          <p className="text-muted truncate text-[0.7rem] leading-tight">
            {session.title}
          </p>
        </button>
      </HoverCard.Trigger>
      <HoverCard.Content
        className="bg-overlay border-border rounded-xl border shadow-overlay"
        offset={6}
        placement="top"
      >
        <SessionHoverDetails
          isSelected={isSelected}
          locationName={locationName}
          session={session}
          trainerName={trainerName}
          onSelect={onSelect}
        />
      </HoverCard.Content>
    </HoverCard>
  );
}

export function ClassScheduler({
  sessions,
  locations,
  trainers,
  selectedSessionId,
  onPlanClass,
  onSelectSession,
}: ClassSchedulerProps) {
  const [mode, setMode] = useState<SchedulerMode>("week");
  const [dateValue, setDateValue] = useState(() => getInitialDateValue(sessions));
  const [locationFilter, setLocationFilter] = useState("all");
  const [trainerFilter, setTrainerFilter] = useState("all");
  const selectedDate = parseDateInput(dateValue);
  const visibleDays = mode === "week" ? buildWeekDays(selectedDate) : [selectedDate];
  const today = useMemo(() => new Date(), []);
  const locationNameById = useMemo(
    () => new Map(locations.map((location) => [location.id, location.name] as const)),
    [locations],
  );
  const trainerNameById = useMemo(
    () => new Map(trainers.map((trainer) => [trainer.id, trainer.fullName] as const)),
    [trainers],
  );
  const filteredSessions = useMemo(
    () =>
      [...sessions]
        .filter((session) =>
          locationFilter === "all" ? true : session.locationId === locationFilter,
        )
        .filter((session) =>
          trainerFilter === "all" ? true : session.trainerId === trainerFilter,
        )
        .sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    [locationFilter, sessions, trainerFilter],
  );
  const visibleSessions = filteredSessions.filter((session) =>
    visibleDays.some((day) => isSameLocalDay(new Date(session.startsAt), day)),
  );
  const totalReservations = visibleSessions.reduce(
    (total, session) => total + session.bookedCount,
    0,
  );
  const totalCapacity = visibleSessions.reduce(
    (total, session) => total + session.capacity,
    0,
  );
  const overallOccupancy =
    totalCapacity > 0 ? Math.round((totalReservations / totalCapacity) * 100) : 0;
  const activeFilterCount =
    (locationFilter === "all" ? 0 : 1) + (trainerFilter === "all" ? 0 : 1);

  const shiftDate = useCallback((days: number) => {
    setDateValue((current) => formatDateInput(addDays(parseDateInput(current), days)));
  }, []);

  const jumpToToday = useCallback(() => {
    setDateValue(formatDateInput(new Date()));
  }, []);

  const handlePlanClass = useCallback(
    (day: Date) => {
      onPlanClass?.(formatDateInput(day));
    },
    [onPlanClass],
  );

  const clearFilters = useCallback(() => {
    setLocationFilter("all");
    setTrainerFilter("all");
  }, []);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const tag = target.tagName.toLowerCase();

      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target.isContentEditable
      );
    }

    function handleKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const stride = mode === "week" ? 7 : 1;

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          shiftDate(-stride);
          break;
        case "ArrowRight":
          event.preventDefault();
          shiftDate(stride);
          break;
        case "t":
        case "T":
          event.preventDefault();
          jumpToToday();
          break;
        case "w":
        case "W":
          event.preventDefault();
          setMode("week");
          break;
        case "d":
        case "D":
          event.preventDefault();
          setMode("day");
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [jumpToToday, mode, shiftDate]);

  return (
    <Widget className="w-full">
      <Widget.Header className="flex-col items-start gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid min-w-0 gap-1.5">
          <Widget.Title className="flex items-center gap-2 leading-tight">
            <CalendarDays className="text-accent size-5" aria-hidden="true" />
            Leskalender
          </Widget.Title>
          <Widget.Description className="text-foreground/70 text-sm leading-relaxed">
            Plan, hover en beheer lessen per week of dag.
          </Widget.Description>
        </div>
        <div className="flex w-full flex-wrap items-center gap-1.5 lg:w-auto lg:justify-end">
          <Chip size="sm" variant="tertiary">
            {compactCount(visibleSessions.length, "les", "lessen")}
          </Chip>
          <Chip size="sm" variant="soft">
            {compactCount(totalReservations, "boeking", "boekingen")}
          </Chip>
          {totalCapacity > 0 ? (
            <Chip
              color={overallOccupancy >= 90 ? "warning" : "default"}
              size="sm"
              variant="tertiary"
            >
              {overallOccupancy}% gevuld
            </Chip>
          ) : null}
          {activeFilterCount > 0 ? (
            <Chip color="accent" size="sm" variant="soft">
              <Filter className="mr-1 size-3" aria-hidden="true" />
              {compactCount(activeFilterCount, "filter", "filters")}
            </Chip>
          ) : null}
        </div>
      </Widget.Header>

      <Widget.Content className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_minmax(160px,200px)_minmax(160px,200px)] xl:items-end">
          <div className="field-stack">
            <Label>Weergave</Label>
            <Segment
              aria-label="Kalenderweergave"
              className="w-fit"
              selectedKey={mode}
              size="sm"
              onSelectionChange={(key) => setMode(String(key) as SchedulerMode)}
            >
              <Segment.Item id="week">Week</Segment.Item>
              <Segment.Item id="day">Dag</Segment.Item>
            </Segment>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-1.5">
              <Button
                aria-label={mode === "week" ? "Vorige week" : "Vorige dag"}
                isIconOnly
                size="sm"
                type="button"
                variant="outline"
                onPress={() => shiftDate(mode === "week" ? -7 : -1)}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <Button
                aria-label={mode === "week" ? "Volgende week" : "Volgende dag"}
                isIconOnly
                size="sm"
                type="button"
                variant="outline"
                onPress={() => shiftDate(mode === "week" ? 7 : 1)}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="field-stack min-w-[10rem] max-w-[14rem] flex-1">
              <Label>Datum</Label>
              <CalendarDatePicker
                ariaLabel="Datum"
                value={dateValue}
                onChange={setDateValue}
              />
            </div>
            <Button size="sm" type="button" variant="secondary" onPress={jumpToToday}>
              Vandaag
            </Button>
          </div>

          <NativeSelect fullWidth variant="secondary">
            <Label>Vestiging</Label>
            <NativeSelect.Trigger
              aria-label="Vestiging filter"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            >
              <NativeSelect.Option value="all">Alle vestigingen</NativeSelect.Option>
              {locations.map((location) => (
                <NativeSelect.Option key={location.id} value={location.id}>
                  {location.name}
                </NativeSelect.Option>
              ))}
              <NativeSelect.Indicator />
            </NativeSelect.Trigger>
          </NativeSelect>

          <NativeSelect fullWidth variant="secondary">
            <Label>Trainer</Label>
            <NativeSelect.Trigger
              aria-label="Trainer filter"
              value={trainerFilter}
              onChange={(event) => setTrainerFilter(event.target.value)}
            >
              <NativeSelect.Option value="all">Alle trainers</NativeSelect.Option>
              {trainers.map((trainer) => (
                <NativeSelect.Option key={trainer.id} value={trainer.id}>
                  {trainer.fullName}
                </NativeSelect.Option>
              ))}
              <NativeSelect.Indicator />
            </NativeSelect.Trigger>
          </NativeSelect>
        </div>

        <div className="bg-surface-secondary flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2">
          <p className="text-foreground text-sm font-medium">
            {mode === "week" ? formatWeekRange(selectedDate) : formatLongDayLabel(selectedDate)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterCount > 0 ? (
              <Button size="sm" type="button" variant="ghost" onPress={clearFilters}>
                Filters wissen
              </Button>
            ) : null}
            <span
              aria-hidden="true"
              className="text-muted hidden text-xs tabular-nums sm:inline-flex"
            >
              ←/→ · T · W/D
            </span>
          </div>
        </div>

        {mode === "week" ? (
          <div
            aria-label={`Weekoverzicht ${formatWeekRange(selectedDate)}`}
            className="grid auto-rows-min items-start gap-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7"
            role="grid"
          >
            {visibleDays.map((day) => {
              const daySessions = filteredSessions.filter((session) =>
                isSameLocalDay(new Date(session.startsAt), day),
              );
              const isToday = isSameLocalDay(day, today);
              const summary = summarizeDayOccupancy(daySessions);

              return (
                <div
                  key={formatDateInput(day)}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={formatLongDayLabel(day)}
                  className={`bg-surface flex min-w-0 flex-col gap-1.5 rounded-xl border p-2 ${
                    isToday
                      ? "border-accent/60 ring-accent/20 ring-1"
                      : "border-border/70"
                  }`}
                  role="gridcell"
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <div className="grid leading-tight">
                      <span className="text-muted text-[0.65rem] font-medium uppercase tracking-wide">
                        {formatWeekdayShort(day).replace(".", "")}
                      </span>
                      <span className="text-foreground text-base font-semibold tabular-nums leading-none">
                        {formatDayNumber(day)}
                      </span>
                      <span className="text-muted text-[0.65rem]">
                        {formatMonthShort(day).replace(".", "")}
                      </span>
                    </div>
                    {isToday ? (
                      <Chip color="accent" size="sm" variant="soft">
                        Nu
                      </Chip>
                    ) : null}
                  </div>

                  {daySessions.length > 0 ? (
                    <>
                      <div className="grid gap-1">
                        {daySessions.map((session) => {
                          const isSelected = selectedSessionId === session.id;
                          const locationName =
                            locationNameById.get(session.locationId) ??
                            (session.locationId
                              ? `Onbekende vestiging`
                              : "Vestiging ontbreekt");
                          const trainerName =
                            (session.bookingKind ?? "class") === "open_gym"
                              ? "Geen trainer nodig"
                              : trainerNameById.get(session.trainerId) ??
                                (session.trainerId
                                  ? `Onbekende trainer`
                                  : "Trainer ontbreekt");

                          return (
                            <CompactSessionPill
                              key={session.id}
                              isSelected={isSelected}
                              locationName={locationName}
                              session={session}
                              trainerName={trainerName}
                              onSelect={onSelectSession}
                            />
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between gap-1.5 pt-0.5">
                        <Chip
                          color={getOccupancyChipColor(summary.ratio)}
                          size="sm"
                          variant="tertiary"
                        >
                          {summary.ratio}%
                        </Chip>
                        {onPlanClass ? (
                          <Button
                            aria-label={`Les inplannen op ${formatLongDayLabel(day)}`}
                            isIconOnly
                            size="sm"
                            type="button"
                            variant="ghost"
                            onPress={() => handlePlanClass(day)}
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : onPlanClass ? (
                    <Button
                      aria-label={`Geen lessen gepland — les inplannen op ${formatLongDayLabel(day)}`}
                      className="border-border/60 text-muted hover:border-accent/50 hover:bg-surface-secondary hover:text-foreground h-10 w-full justify-center rounded-lg border border-dashed text-xs"
                      type="button"
                      variant="ghost"
                      onPress={() => handlePlanClass(day)}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">Geen lessen gepland</span>
                    </Button>
                  ) : (
                    <p className="text-muted py-1 text-center text-xs">
                      Geen lessen gepland
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            aria-label={`Dagoverzicht ${formatLongDayLabel(selectedDate)}`}
            className="grid gap-3 md:grid-cols-2"
            role="grid"
          >
            {visibleDays.map((day) => {
              const daySessions = filteredSessions.filter((session) =>
                isSameLocalDay(new Date(session.startsAt), day),
              );
              const isToday = isSameLocalDay(day, today);
              const summary = summarizeDayOccupancy(daySessions);
              const groupedSessions = groupSessionsByTimeBand(daySessions);

              return (
                <Card
                  key={formatDateInput(day)}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={formatLongDayLabel(day)}
                  className={`bg-surface-secondary min-w-0 rounded-2xl border shadow-none ${
                    isToday
                      ? "border-accent/60 ring-accent/20 ring-1"
                      : "border-border/80"
                  }`}
                  role="gridcell"
                >
                  <Card.Header className="items-start justify-between gap-3">
                    <div className="grid min-w-0 gap-1">
                      <Card.Title className="text-base">
                        {formatLongDayLabel(day)}
                      </Card.Title>
                      <Card.Description>
                        {daySessions.length > 0
                          ? `${compactCount(daySessions.length, "les", "lessen")} · ${summary.booked}/${summary.capacity}`
                          : "Nog leeg"}
                      </Card.Description>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {isToday ? (
                        <Chip color="accent" size="sm" variant="soft">
                          Vandaag
                        </Chip>
                      ) : null}
                      {daySessions.length > 0 ? (
                        <Chip
                          color={getOccupancyChipColor(summary.ratio)}
                          size="sm"
                          variant="tertiary"
                        >
                          {summary.ratio}% gevuld
                        </Chip>
                      ) : null}
                      {onPlanClass ? (
                        <Button
                          aria-label={`Les inplannen op ${formatLongDayLabel(day)}`}
                          size="sm"
                          type="button"
                          variant="outline"
                          onPress={() => handlePlanClass(day)}
                        >
                          <CalendarPlus className="size-3.5" aria-hidden="true" />
                          Les inplannen
                        </Button>
                      ) : null}
                    </div>
                  </Card.Header>
                  <Card.Content className="grid gap-3">
                    {daySessions.length > 0 ? (
                      groupedSessions.map(({ band, items }) => {
                        const BandIcon = TIME_BAND_ICON[band];

                        return (
                          <div key={band} className="grid gap-2">
                            <p className="text-muted flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
                              <BandIcon className="size-3.5" aria-hidden="true" />
                              {TIME_BAND_LABEL[band]}
                            </p>
                            {items.map((session) => {
                              const isSelected = selectedSessionId === session.id;
                              const locationName =
                                locationNameById.get(session.locationId) ??
                                (session.locationId
                                  ? `Onbekende vestiging`
                                  : "Vestiging ontbreekt");
                              const trainerName =
                                (session.bookingKind ?? "class") === "open_gym"
                                  ? "Geen trainer nodig"
                                  : trainerNameById.get(session.trainerId) ??
                                    (session.trainerId
                                      ? `Onbekende trainer`
                                      : "Trainer ontbreekt");

                              return (
                                <button
                                  key={session.id}
                                  aria-current={isSelected ? "true" : undefined}
                                  aria-label={`Beheer ${session.title}, ${formatTimeRange(session)}, ${locationName}`}
                                  className={`focus-visible:outline-accent grid w-full gap-2 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                                    isSelected
                                      ? "border-accent bg-accent/10 shadow-sm"
                                      : "border-border bg-surface hover:border-accent/40 hover:bg-surface-tertiary"
                                  }`}
                                  type="button"
                                  onClick={() => onSelectSession?.(session.id)}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-foreground truncate text-sm font-semibold">
                                        {session.title}
                                      </p>
                                      <p className="text-muted mt-0.5 flex items-center gap-1 text-xs tabular-nums">
                                        <Clock className="size-3.5" aria-hidden="true" />
                                        {formatTimeRange(session)}
                                      </p>
                                    </div>
                                    <Chip
                                      color={getOccupancyTone(session)}
                                      size="sm"
                                      variant="soft"
                                    >
                                      {session.bookedCount}/{session.capacity}
                                    </Chip>
                                  </div>

                                  <div className="text-muted grid gap-1 text-xs">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                      <MapPin
                                        className="size-3.5 shrink-0"
                                        aria-hidden="true"
                                      />
                                      <span className="truncate">{locationName}</span>
                                    </span>
                                    <span className="flex min-w-0 items-center gap-1.5">
                                      <Users
                                        className="size-3.5 shrink-0"
                                        aria-hidden="true"
                                      />
                                      <span className="truncate">{trainerName}</span>
                                    </span>
                                    <span className="flex min-w-0 items-center gap-1.5">
                                      <Dumbbell
                                        className="size-3.5 shrink-0"
                                        aria-hidden="true"
                                      />
                                      <span className="truncate">
                                        {getBookingKindLabel(session.bookingKind ?? "class")}{" "}
                                        · {getClassLevelLabel(session.level)}
                                      </span>
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Chip size="sm" variant="tertiary">
                                      {getEntityStatusLabel(session.status)}
                                    </Chip>
                                    {session.waitlistCount > 0 ? (
                                      <Chip color="warning" size="sm" variant="soft">
                                        {session.waitlistCount} wachtlijst
                                      </Chip>
                                    ) : null}
                                    {isSelected ? (
                                      <Chip color="accent" size="sm" variant="soft">
                                        <CheckCheck
                                          className="mr-1 size-3"
                                          aria-hidden="true"
                                        />
                                        In beheer
                                      </Chip>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })
                    ) : (
                      <Button
                        aria-label={`Geen lessen gepland — les inplannen op ${formatLongDayLabel(day)}`}
                        className="border-border bg-surface hover:border-accent/50 hover:bg-surface-tertiary h-auto w-full justify-center rounded-xl border border-dashed px-3 py-4 text-center"
                        type="button"
                        variant="ghost"
                        onPress={() => handlePlanClass(day)}
                      >
                        <span className="grid gap-1.5">
                          <Sparkles
                            className="text-muted mx-auto size-4"
                            aria-hidden="true"
                          />
                          <span className="text-sm font-medium">Geen lessen gepland</span>
                          <span className="text-muted text-xs">
                            Druk om op deze dag een les in te plannen.
                          </span>
                        </span>
                      </Button>
                    )}
                  </Card.Content>
                </Card>
              );
            })}
          </div>
        )}
      </Widget.Content>
    </Widget>
  );
}
