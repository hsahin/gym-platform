"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  MapPin,
  Users,
} from "lucide-react";
import { Card, Chip, Label } from "@heroui/react";
import { Widget } from "@heroui-pro/react";
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

function formatDayTitle(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(date);
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

  return firstSession ? formatDateInput(new Date(firstSession.startsAt)) : formatDateInput(new Date());
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

  function shiftDate(days: number) {
    const nextDate = addDays(selectedDate, days);
    setDateValue(formatDateInput(nextDate));
  }

  function jumpToToday() {
    setDateValue(formatDateInput(new Date()));
  }

  function handlePlanClass(day: Date) {
    onPlanClass?.(formatDateInput(day));
  }

  return (
    <Widget className="w-full">
      <Widget.Header className="flex-col items-start gap-4 lg:flex-row lg:items-center">
        <div className="grid gap-1">
          <Widget.Title className="flex items-center gap-2">
            <CalendarDays className="size-5 text-accent" />
            Leskalender
          </Widget.Title>
          <Widget.Description>
            Bekijk alle lessen per week of dag, filter op vestiging en beheer direct de gekozen les.
          </Widget.Description>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <Chip size="sm" variant="tertiary">
            {compactCount(visibleSessions.length, "les", "lessen")}
          </Chip>
          <Chip size="sm" variant="soft">
            {compactCount(totalReservations, "boeking", "boekingen")}
          </Chip>
        </div>
      </Widget.Header>

      <Widget.Content className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[auto_minmax(0,1fr)_minmax(180px,220px)_minmax(180px,220px)] xl:items-end">
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

          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onPress={() => shiftDate(mode === "week" ? -7 : -1)}
              >
                <ChevronLeft className="size-4" />
                Terug
              </Button>
              <Button
                type="button"
                variant="outline"
                onPress={() => shiftDate(mode === "week" ? 7 : 1)}
              >
                Verder
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="field-stack">
              <Label>Datum</Label>
              <CalendarDatePicker
                ariaLabel="Datum"
                value={dateValue}
                onChange={setDateValue}
              />
            </div>
            <Button type="button" variant="secondary" onPress={jumpToToday}>
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

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-secondary px-4 py-3">
          <p className="text-sm font-medium">
            {mode === "week" ? formatWeekRange(selectedDate) : formatDayTitle(selectedDate)}
          </p>
          <p className="text-muted text-sm">
            {locationFilter === "all"
              ? "Alle vestigingen"
              : locationNameById.get(locationFilter) ?? "Onbekende vestiging"}
          </p>
        </div>

        <div
          className={
            mode === "week"
              ? "grid gap-3 lg:grid-cols-7"
              : "grid gap-3 md:grid-cols-2"
          }
        >
            {visibleDays.map((day) => {
              const daySessions = filteredSessions.filter((session) =>
                isSameLocalDay(new Date(session.startsAt), day),
              );

              return (
                <Card
                  key={formatDateInput(day)}
                  className="min-w-0 rounded-2xl border border-border/80 bg-surface-secondary shadow-none"
                >
                  <Card.Header className="items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <Card.Title className="text-sm">{formatDayTitle(day)}</Card.Title>
                      <Card.Description>
                        {compactCount(daySessions.length, "les", "lessen")}
                      </Card.Description>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {isSameLocalDay(day, new Date()) ? (
                        <Chip size="sm" variant="soft">
                          Vandaag
                        </Chip>
                      ) : null}
                      {onPlanClass ? (
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onPress={() => handlePlanClass(day)}
                        >
                          Les inplannen
                        </Button>
                      ) : null}
                    </div>
                  </Card.Header>
                  <Card.Content className="grid gap-2">
                    {daySessions.length > 0 ? (
                      daySessions.map((session) => {
                        const isSelected = selectedSessionId === session.id;
                        const locationName =
                          locationNameById.get(session.locationId) ??
                          (session.locationId
                            ? `Onbekende vestiging (${session.locationId})`
                            : "Vestiging ontbreekt");
                        const trainerName =
                          (session.bookingKind ?? "class") === "open_gym"
                            ? "Geen trainer nodig"
                            : trainerNameById.get(session.trainerId) ??
                              (session.trainerId
                                ? `Onbekende trainer (${session.trainerId})`
                                : "Trainer ontbreekt");

                        return (
                          <div
                            key={session.id}
                            className={`grid gap-3 rounded-2xl border p-3 ${
                              isSelected
                                ? "border-accent bg-accent/10"
                                : "border-border bg-surface"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{session.title}</p>
                                <p className="text-muted mt-1 flex items-center gap-1 text-xs">
                                  <Clock className="size-3.5" />
                                  {formatTimeRange(session)}
                                </p>
                              </div>
                              <Chip color={getOccupancyTone(session)} size="sm" variant="soft">
                                {session.bookedCount}/{session.capacity}
                              </Chip>
                            </div>

                            <div className="grid gap-1 text-xs text-muted">
                              <span className="flex min-w-0 items-center gap-1">
                                <MapPin className="size-3.5 shrink-0" />
                                <span className="truncate">{locationName}</span>
                              </span>
                              <span className="flex min-w-0 items-center gap-1">
                                <Users className="size-3.5 shrink-0" />
                                <span className="truncate">{trainerName}</span>
                              </span>
                              <span className="flex min-w-0 items-center gap-1">
                                <Dumbbell className="size-3.5 shrink-0" />
                                <span className="truncate">
                                  {getBookingKindLabel(session.bookingKind ?? "class")} ·{" "}
                                  {getClassLevelLabel(session.level)}
                                </span>
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Chip size="sm" variant="tertiary">
                                {getEntityStatusLabel(session.status)}
                              </Chip>
                              {session.waitlistCount > 0 ? (
                                <Chip size="sm" variant="soft">
                                  {session.waitlistCount} wachtlijst
                                </Chip>
                              ) : null}
                              <Button
                                className="ml-auto"
                                size="sm"
                                type="button"
                                variant={isSelected ? "primary" : "outline"}
                                onPress={() => onSelectSession?.(session.id)}
                              >
                                Beheer
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <Button
                        className="h-auto w-full justify-center rounded-2xl border border-dashed border-border bg-surface px-3 py-6 text-center"
                        type="button"
                        variant="ghost"
                        onPress={() => handlePlanClass(day)}
                      >
                        <span className="grid gap-1">
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
      </Widget.Content>
    </Widget>
  );
}
