"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, Chip, Input, Label, Switch, TextArea } from "@heroui/react";
import { ListView } from "@/components/dashboard/HydrationSafeListView";
import { CheckboxButtonGroup } from "@heroui-pro/react/checkbox-button-group";
import { Segment } from "@/components/dashboard/HydrationSafeSegment";
import { toast } from "sonner";
import { AttendanceButton } from "@/components/AttendanceButton";
import { BookingDialog } from "@/components/BookingDialog";
import { CancelBookingButton } from "@/components/CancelBookingButton";
import { DashboardEntityActions } from "@/components/DashboardEntityActions";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import {
  ALL_CLASS_TYPE_KEY,
  OPEN_GYM_CLASS_TYPE_KEY,
  buildClassTypeTabs,
  filterClassSessionsByType,
  getClassTypeKeyForSession,
  resolveSelectedClassType,
} from "@/lib/class-types";
import {
  buildWeeklyRecurringLocalStarts,
  CLASS_WEEKDAY_OPTIONS,
  getWeekdayKeyForLocalDateTime,
  type ClassWeekdayKey,
} from "@/lib/class-recurrence";
import { formatEuroFromCents, parseEuroInputToCents } from "@/lib/currency";
import { filterManagementRecords } from "@/lib/dashboard-management";
import {
  getBookingKindLabel,
  getBookingSourceLabel,
  getBookingStatusLabel,
  getClassLevelLabel,
  getEntityStatusLabel,
} from "@/lib/ui-labels";
import {
  EmptyPanel,
  PageSection,
  formatDateTime,
  statusChip,
  type DashboardPageProps,
} from "@/components/dashboard/shared";

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function defaultClassStartValue() {
  const nextMorning = new Date();
  nextMorning.setDate(nextMorning.getDate() + 1);
  nextMorning.setHours(9, 0, 0, 0);
  return toDateTimeLocalValue(nextMorning);
}

function buildLocationFieldOptions(
  currentLocationId: string,
  locations: DashboardPageProps["snapshot"]["locations"],
) {
  const normalizedCurrentLocationId = currentLocationId.trim();
  const currentLocationExists =
    normalizedCurrentLocationId.length > 0 &&
    locations.some((location) => location.id === normalizedCurrentLocationId);
  const fallbackOptions =
    normalizedCurrentLocationId.length === 0
      ? [{ value: "", label: "Vestiging ontbreekt" }]
      : currentLocationExists
        ? []
        : [
            {
              value: normalizedCurrentLocationId,
              label: `Onbekende vestiging (${normalizedCurrentLocationId})`,
            },
          ];

  return [
    ...fallbackOptions,
    ...locations.map((location) => ({
      value: location.id,
      label: location.name,
    })),
  ];
}

function buildTrainerFieldOptions(
  currentTrainerId: string,
  bookingKind: string,
  trainers: DashboardPageProps["snapshot"]["trainers"],
) {
  const normalizedCurrentTrainerId = currentTrainerId.trim();

  if (bookingKind === "open_gym") {
    return [
      { value: "", label: "Geen trainer nodig" },
      ...trainers.map((trainer) => ({
        value: trainer.id,
        label: trainer.fullName,
      })),
    ];
  }

  const currentTrainerExists =
    normalizedCurrentTrainerId.length > 0 &&
    trainers.some((trainer) => trainer.id === normalizedCurrentTrainerId);
  const fallbackOptions =
    normalizedCurrentTrainerId.length === 0
      ? [{ value: "", label: "Trainer ontbreekt" }]
      : currentTrainerExists
        ? []
        : [
            {
              value: normalizedCurrentTrainerId,
              label: `Onbekende trainer (${normalizedCurrentTrainerId})`,
            },
          ];

  return [
    ...fallbackOptions,
    ...trainers.map((trainer) => ({
      value: trainer.id,
      label: trainer.fullName,
    })),
  ];
}

export function ClassesDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [classesView, setClassesView] = useState<"schedule" | "bookings">("schedule");
  const [classSearch, setClassSearch] = useState("");
  const [classStatusFilter, setClassStatusFilter] = useState("all");
  const [selectedClassTypeKey, setSelectedClassTypeKey] = useState("hiit");
  const [classStartsAt, setClassStartsAt] = useState(defaultClassStartValue);
  const [classRepeatsWeekly, setClassRepeatsWeekly] = useState(false);
  const [classRecurringWeekdays, setClassRecurringWeekdays] = useState<
    ReadonlyArray<ClassWeekdayKey>
  >([]);
  const [classRecurringUntil, setClassRecurringUntil] = useState("");
  const [oneToOneSessionName, setOneToOneSessionName] = useState(
    snapshot.bookingWorkspace.oneToOneSessionName,
  );
  const [oneToOneDurationMinutes, setOneToOneDurationMinutes] = useState(
    snapshot.bookingWorkspace.oneToOneDurationMinutes,
  );
  const [trialBookingUrl, setTrialBookingUrl] = useState(
    snapshot.bookingWorkspace.trialBookingUrl,
  );
  const [defaultCreditPackSize, setDefaultCreditPackSize] = useState(
    snapshot.bookingWorkspace.defaultCreditPackSize,
  );
  const [schedulingWindowDays, setSchedulingWindowDays] = useState(
    snapshot.bookingWorkspace.schedulingWindowDays,
  );
  const [cancellationWindowHours, setCancellationWindowHours] = useState(
    snapshot.bookingPolicy.cancellationWindowHours,
  );
  const [lateCancelFeeInput, setLateCancelFeeInput] = useState(
    formatEuroFromCents(snapshot.bookingPolicy.lateCancelFeeCents),
  );
  const [noShowFeeInput, setNoShowFeeInput] = useState(
    formatEuroFromCents(snapshot.bookingPolicy.noShowFeeCents),
  );
  const [maxDailyBookingsPerMember, setMaxDailyBookingsPerMember] = useState(
    snapshot.bookingPolicy.maxDailyBookingsPerMember,
  );
  const [maxDailyWaitlistPerMember, setMaxDailyWaitlistPerMember] = useState(
    snapshot.bookingPolicy.maxDailyWaitlistPerMember,
  );
  const [autoPromoteWaitlist, setAutoPromoteWaitlist] = useState(
    snapshot.bookingPolicy.autoPromoteWaitlist,
  );
  const upcomingSessions = [...snapshot.classSessions].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  );
  const classTypeTabs = buildClassTypeTabs(upcomingSessions);
  const selectedClassType = resolveSelectedClassType(classTypeTabs, selectedClassTypeKey);
  const typeFilteredClassSessions = filterClassSessionsByType(
    upcomingSessions,
    selectedClassTypeKey,
  );
  const filteredClassSessions = filterManagementRecords(typeFilteredClassSessions, {
    query: classSearch,
    searchKeys: ["title", "focus", "level", "status"],
    filterKey: "status",
    filterValue: classStatusFilter,
  });
  const lateCancelFeeCents = parseEuroInputToCents(lateCancelFeeInput);
  const noShowFeeCents = parseEuroInputToCents(noShowFeeInput);
  const recentBookings = [...snapshot.bookings].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const classSessionById = new Map(
    snapshot.classSessions.map((session) => [session.id, session]),
  );
  const locationNameById = new Map(
    snapshot.locations.map((location) => [location.id, location.name]),
  );
  const trainerNameById = new Map(
    snapshot.trainers.map((trainer) => [trainer.id, trainer.fullName]),
  );
  const typeFilteredBookings =
    selectedClassTypeKey === ALL_CLASS_TYPE_KEY
      ? recentBookings
      : recentBookings.filter((booking) => {
          const classSession = classSessionById.get(booking.classSessionId);
          return classSession
            ? getClassTypeKeyForSession(classSession) === selectedClassTypeKey
            : false;
        });
  const classFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "classes",
  );
  const planningClassType =
    selectedClassType.key === ALL_CLASS_TYPE_KEY
      ? {
          key: "custom-class",
          label: "Les",
          focus: "Algemeen",
          defaultTitle: "Nieuwe les",
          description: "Plan een losse les of wekelijkse reeks en geef zelf de focus op.",
          count: selectedClassType.count,
        }
      : selectedClassType;
  const isOpenGymClassType = planningClassType.key === OPEN_GYM_CLASS_TYPE_KEY;
  const recurringClassStarts = classRepeatsWeekly
    ? buildWeeklyRecurringLocalStarts({
        anchorLocalStart: classStartsAt,
        weekdays: classRecurringWeekdays,
        untilDate: classRecurringUntil,
      })
    : [];
  const classCreateCount = classRepeatsWeekly
    ? recurringClassStarts.length
    : classStartsAt
      ? 1
      : 0;

  function createTypedClassSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const rawStartsAt = String(formData.get("startsAt") ?? "");
    const startsToCreate = classRepeatsWeekly
      ? buildWeeklyRecurringLocalStarts({
          anchorLocalStart: rawStartsAt,
          weekdays: classRecurringWeekdays,
          untilDate: classRecurringUntil,
        })
      : rawStartsAt
        ? [rawStartsAt]
        : [];

    if (startsToCreate.length === 0) {
      toast.error(
        classRepeatsWeekly
          ? "Kies minstens één dag en een geldige einddatum voor de herhaling."
          : "Kies eerst een geldige startdatum en tijd.",
      );
      return;
    }

    const seriesId = classRepeatsWeekly ? `series_${crypto.randomUUID()}` : undefined;
    const title = String(formData.get("title") ?? "").trim();
    const focus =
      String(formData.get("focus") ?? planningClassType.focus).trim() ||
      planningClassType.focus ||
      "Algemeen";

    startTransition(async () => {
      try {
        await submitDashboardMutation("/api/platform/classes", {
          classes: startsToCreate.map((localStart) => ({
            title,
            ...(seriesId ? { seriesId } : {}),
            bookingKind: isOpenGymClassType ? "open_gym" : "class",
            locationId: String(formData.get("locationId") ?? ""),
            trainerId: isOpenGymClassType ? "" : String(formData.get("trainerId") ?? ""),
            startsAt: new Date(localStart).toISOString(),
            durationMinutes: Number(
              formData.get("durationMinutes") ?? (isOpenGymClassType ? "60" : "45"),
            ),
            capacity: Number(formData.get("capacity") ?? "16"),
            level: String(formData.get("level") ?? "mixed"),
            focus,
          })),
        });
        toast.success(
          startsToCreate.length === 1
            ? isOpenGymClassType
              ? "Boekbare gymplek gepland."
              : `${planningClassType.label} gepland.`
            : `${startsToCreate.length} lessen toegevoegd.`,
        );
        form.reset();
        setClassStartsAt(defaultClassStartValue());
        setClassRepeatsWeekly(false);
        setClassRecurringWeekdays([]);
        setClassRecurringUntil("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Les plannen mislukt.");
      }
    });
  }

  useEffect(() => {
    setOneToOneSessionName(snapshot.bookingWorkspace.oneToOneSessionName);
    setOneToOneDurationMinutes(snapshot.bookingWorkspace.oneToOneDurationMinutes);
    setTrialBookingUrl(snapshot.bookingWorkspace.trialBookingUrl);
    setDefaultCreditPackSize(snapshot.bookingWorkspace.defaultCreditPackSize);
    setSchedulingWindowDays(snapshot.bookingWorkspace.schedulingWindowDays);
    setCancellationWindowHours(snapshot.bookingPolicy.cancellationWindowHours);
    setLateCancelFeeInput(formatEuroFromCents(snapshot.bookingPolicy.lateCancelFeeCents));
    setNoShowFeeInput(formatEuroFromCents(snapshot.bookingPolicy.noShowFeeCents));
    setMaxDailyBookingsPerMember(snapshot.bookingPolicy.maxDailyBookingsPerMember);
    setMaxDailyWaitlistPerMember(snapshot.bookingPolicy.maxDailyWaitlistPerMember);
    setAutoPromoteWaitlist(snapshot.bookingPolicy.autoPromoteWaitlist);
  }, [snapshot.bookingPolicy, snapshot.bookingWorkspace]);

  useEffect(() => {
    if (!classTypeTabs.some((tab) => tab.key === selectedClassTypeKey)) {
      setSelectedClassTypeKey(classTypeTabs[0]?.key ?? ALL_CLASS_TYPE_KEY);
    }
  }, [classTypeTabs, selectedClassTypeKey]);

  useEffect(() => {
    if (!classRepeatsWeekly || !classStartsAt) {
      return;
    }

    const anchorWeekday = getWeekdayKeyForLocalDateTime(classStartsAt);

    if (anchorWeekday && classRecurringWeekdays.length === 0) {
      setClassRecurringWeekdays([anchorWeekday]);
    }

    if (!classRecurringUntil) {
      setClassRecurringUntil(classStartsAt.slice(0, 10));
    }
  }, [
    classRecurringUntil,
    classRecurringWeekdays,
    classRepeatsWeekly,
    classStartsAt,
  ]);

  return (
    <div className="section-stack">
      <PageSection
        title="Boekingsinstellingen"
        description="Leg PT-afspraken, proeflessen en strippenkaarten vast zodat planners en balie met dezelfde spelregels werken."
        actions={
          <Button
            isDisabled={isPending}
            variant="outline"
            onPress={() =>
              startTransition(async () => {
                try {
                  await submitDashboardMutation("/api/platform/booking-settings", {
                    oneToOneSessionName,
                    oneToOneDurationMinutes,
                    trialBookingUrl,
                    defaultCreditPackSize,
                    schedulingWindowDays,
                  });
                  toast.success("Boekingsinstellingen opgeslagen.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Boekingsinstellingen opslaan mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Boekingsinstellingen bewaren"}
          </Button>
        }
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2">
            <div className="field-stack">
              <Label>1-op-1 sessienaam</Label>
              <Input
                fullWidth
                value={oneToOneSessionName}
                onChange={(event) => setOneToOneSessionName(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Duur 1-op-1 sessie (minuten)</Label>
              <Input
                fullWidth
                min={15}
                type="number"
                value={String(oneToOneDurationMinutes)}
                onChange={(event) =>
                  setOneToOneDurationMinutes(Number(event.target.value || "0"))
                }
              />
            </div>
            <div className="field-stack">
              <Label>Proefleslink</Label>
              <Input
                fullWidth
                placeholder="https://jouwgym.nl/proefles"
                value={trialBookingUrl}
                onChange={(event) => setTrialBookingUrl(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Standaard strippenkaart</Label>
              <Input
                fullWidth
                min={1}
                type="number"
                value={String(defaultCreditPackSize)}
                onChange={(event) =>
                  setDefaultCreditPackSize(Number(event.target.value || "0"))
                }
              />
            </div>
            <div className="field-stack">
              <Label>Boekingsvenster (dagen)</Label>
              <Input
                fullWidth
                min={1}
                type="number"
                value={String(schedulingWindowDays)}
                onChange={(event) =>
                  setSchedulingWindowDays(Number(event.target.value || "0"))
                }
              />
            </div>
            <div className="field-stack">
              <Label>Planner status</Label>
              <Input fullWidth readOnly value="Roosterplanning actief" />
            </div>
          </Card.Content>
        </Card>
      </PageSection>

      <PageSection
        title="Boekingsregels"
        description="Dwing reserveringsregels af voor drukke dagen, wachtlijstdruk en late annuleringen."
        actions={
          <Button
            isDisabled={isPending}
            variant="outline"
            onPress={() =>
              startTransition(async () => {
                try {
                  await submitDashboardMutation("/api/platform/booking-policy", {
                    cancellationWindowHours,
                    lateCancelFeeCents,
                    noShowFeeCents,
                    maxDailyBookingsPerMember,
                    maxDailyWaitlistPerMember,
                    autoPromoteWaitlist,
                  });
                  toast.success("Boekingsregels opgeslagen.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Boekingsregels opslaan mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Boekingsregels bewaren"}
          </Button>
        }
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="field-stack">
              <Label>Annuleringstermijn (uur)</Label>
              <Input
                fullWidth
                min={0}
                type="number"
                value={String(cancellationWindowHours)}
                onChange={(event) =>
                  setCancellationWindowHours(Number(event.target.value || "0"))
                }
              />
            </div>
            <div className="field-stack">
              <Label>Annuleringskosten (€)</Label>
              <Input
                fullWidth
                inputMode="decimal"
                placeholder="€ 7,50"
                type="text"
                value={lateCancelFeeInput}
                onBlur={() => setLateCancelFeeInput(formatEuroFromCents(lateCancelFeeCents))}
                onChange={(event) => setLateCancelFeeInput(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>No-showkosten (€)</Label>
              <Input
                fullWidth
                inputMode="decimal"
                placeholder="€ 10,00"
                type="text"
                value={noShowFeeInput}
                onBlur={() => setNoShowFeeInput(formatEuroFromCents(noShowFeeCents))}
                onChange={(event) => setNoShowFeeInput(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Daglimiet boekingen per lid</Label>
              <Input
                fullWidth
                min={1}
                type="number"
                value={String(maxDailyBookingsPerMember)}
                onChange={(event) =>
                  setMaxDailyBookingsPerMember(Number(event.target.value || "1"))
                }
              />
            </div>
            <div className="field-stack">
              <Label>Daglimiet wachtlijst per lid</Label>
              <Input
                fullWidth
                min={1}
                type="number"
                value={String(maxDailyWaitlistPerMember)}
                onChange={(event) =>
                  setMaxDailyWaitlistPerMember(Number(event.target.value || "1"))
                }
              />
            </div>
            <div className="field-stack">
              <Label>Wachtlijst automatisch doorschuiven</Label>
              <Segment
                selectedKey={autoPromoteWaitlist ? "yes" : "no"}
                size="sm"
                onSelectionChange={(key) => setAutoPromoteWaitlist(String(key) === "yes")}
              >
                <Segment.Item id="yes">Aan</Segment.Item>
                <Segment.Item id="no">Uit</Segment.Item>
              </Segment>
            </div>
          </Card.Content>
        </Card>
      </PageSection>

      <PageSection
        actions={<BookingDialog classSessions={typeFilteredClassSessions} members={snapshot.members} />}
        title="Lessen en reserveringen"
        description="Schakel tussen roosterbeheer en reserveringsbeheer."
      >
        <div className="grid content-start gap-3">
            <Segment
              className="w-full max-w-[22rem]"
              selectedKey={classesView}
              size="sm"
              onSelectionChange={(key) => setClassesView(String(key) as typeof classesView)}
            >
              <Segment.Item id="schedule">Rooster</Segment.Item>
              <Segment.Item id="bookings">Reserveringen</Segment.Item>
            </Segment>

            <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Header className="space-y-2">
                <Card.Title>Soort les kiezen</Card.Title>
                <Card.Description>
                  Gebruik tabs per lestype. De lijst, reserveringen en nieuwe planning volgen automatisch het gekozen type.
                </Card.Description>
              </Card.Header>
              <Card.Content className="grid gap-4">
                <Segment
                  className="w-full overflow-x-auto"
                  selectedKey={selectedClassTypeKey}
                  size="sm"
                  onSelectionChange={(key) => {
                    setSelectedClassTypeKey(String(key));
                    setClassSearch("");
                  }}
                >
                  {classTypeTabs.map((tab) => (
                    <Segment.Item key={tab.key} id={tab.key}>
                      {tab.label} ({tab.count})
                    </Segment.Item>
                  ))}
                </Segment>

                <div className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        {selectedClassType.key === ALL_CLASS_TYPE_KEY
                          ? "Alle lessen"
                          : selectedClassType.label}
                      </p>
                      <p className="text-muted text-sm leading-6">
                        {selectedClassType.description}
                      </p>
                    </div>
                    <Chip size="sm" variant="tertiary">
                      {selectedClassType.count} gepland
                    </Chip>
                  </div>
                </div>
              </Card.Content>
            </Card>

            {classesView === "schedule" ? (
              <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
                <Card.Header className="items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Card.Title>Les plannen</Card.Title>
                    <Card.Description>
                      Plan een losse les, wekelijkse reeks of gymplek direct tussen je lessen.
                    </Card.Description>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Chip size="sm" variant="soft">
                      {classRepeatsWeekly ? "Reeks" : "Los"}
                    </Chip>
                    <span className="text-muted text-sm">
                      {classCreateCount} {classCreateCount === 1 ? "les" : "lessen"}
                    </span>
                  </div>
                </Card.Header>
                <Card.Content>
                  {snapshot.locations.length === 0 ||
                  (!isOpenGymClassType && snapshot.trainers.length === 0) ? (
                    <p className="text-muted text-sm leading-6">
                      {isOpenGymClassType
                        ? "Voeg eerst minimaal één vestiging toe via Gym instellingen voordat je gymplekken plant."
                        : "Voeg eerst minimaal één vestiging en trainer toe via Gym instellingen voordat je lessen plant."}
                    </p>
                  ) : (
                    <form
                      key={planningClassType.key}
                      className="grid gap-4 md:grid-cols-2"
                      onSubmit={createTypedClassSession}
                    >
                      <div className="field-stack">
                        <Label>Titel</Label>
                        <Input
                          fullWidth
                          name="title"
                          defaultValue={planningClassType.defaultTitle}
                          required
                        />
                      </div>
                      <div className="field-stack">
                        <Label>Start</Label>
                        <Input
                          fullWidth
                          name="startsAt"
                          required
                          type="datetime-local"
                          value={classStartsAt}
                          onChange={(event) => setClassStartsAt(event.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="grid gap-4 rounded-2xl border border-border/70 bg-surface px-4 py-4">
                          <Switch
                            isSelected={classRepeatsWeekly}
                            onChange={setClassRepeatsWeekly}
                          >
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                            <Switch.Content>
                              <Label>Wekelijks herhalen</Label>
                            </Switch.Content>
                          </Switch>

                          {classRepeatsWeekly ? (
                            <div className="grid gap-4">
                              <div className="field-stack">
                                <Label>Dagen</Label>
                                <CheckboxButtonGroup
                                  className="w-full grid-cols-4 gap-2 md:grid-cols-7"
                                  layout="grid"
                                  value={[...classRecurringWeekdays]}
                                  onChange={(value) =>
                                    setClassRecurringWeekdays(value as ClassWeekdayKey[])
                                  }
                                >
                                  {CLASS_WEEKDAY_OPTIONS.map((weekday) => (
                                    <CheckboxButtonGroup.Item
                                      key={weekday.key}
                                      value={weekday.key}
                                    >
                                      <CheckboxButtonGroup.ItemContent className="items-center justify-center text-center">
                                        <span className="text-sm font-medium">
                                          {weekday.label}
                                        </span>
                                      </CheckboxButtonGroup.ItemContent>
                                    </CheckboxButtonGroup.Item>
                                  ))}
                                </CheckboxButtonGroup>
                              </div>

                              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                <div className="field-stack">
                                  <Label>Herhaal t/m</Label>
                                  <Input
                                    fullWidth
                                    type="date"
                                    value={classRecurringUntil}
                                    onChange={(event) =>
                                      setClassRecurringUntil(event.target.value)
                                    }
                                  />
                                </div>
                                {classCreateCount > 0 ? (
                                  <Chip size="sm" variant="soft" className="w-fit">
                                    {classCreateCount}{" "}
                                    {classCreateCount === 1 ? "les" : "lessen"}
                                  </Chip>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <label className="field-stack">
                        <span className="text-sm font-medium">Vestiging</span>
                        <select
                          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                          name="locationId"
                          required
                        >
                          {snapshot.locations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {isOpenGymClassType ? (
                        <div className="field-stack">
                          <input name="trainerId" type="hidden" value="" />
                          <Label>Boekbare gymplek</Label>
                          <div className="rounded-2xl border border-border bg-surface p-3 text-sm">
                            <p className="font-medium">Geen trainer nodig</p>
                            <p className="text-muted mt-1 leading-6">
                              Leden en proeflessers boeken zelfstandig één uur op capaciteit.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <label className="field-stack">
                          <span className="text-sm font-medium">Trainer</span>
                          <select
                            className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                            name="trainerId"
                            required
                          >
                            {snapshot.trainers.map((trainer) => (
                              <option key={trainer.id} value={trainer.id}>
                                {trainer.fullName}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="field-stack">
                        <Label>Duur (minuten)</Label>
                        <Input
                          fullWidth
                          min={15}
                          name="durationMinutes"
                          defaultValue={isOpenGymClassType ? "60" : "45"}
                          required
                          type="number"
                        />
                      </div>
                      <div className="field-stack">
                        <Label>Capaciteit</Label>
                        <Input
                          fullWidth
                          min={1}
                          name="capacity"
                          defaultValue={isOpenGymClassType ? "12" : "16"}
                          required
                          type="number"
                        />
                      </div>
                      <label className="field-stack">
                        <span className="text-sm font-medium">Niveau</span>
                        <select
                          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                          name="level"
                          defaultValue="mixed"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="mixed">Gemengd</option>
                          <option value="advanced">Gevorderd</option>
                        </select>
                      </label>
                      <div className="field-stack">
                        <Label>Focus</Label>
                        <TextArea
                          fullWidth
                          name="focus"
                          rows={4}
                          defaultValue={planningClassType.focus}
                          placeholder="techniek, conditie, mobiliteit"
                        />
                      </div>
                      <div className="flex justify-end md:col-span-2">
                        <Button isDisabled={isPending} type="submit" variant="primary">
                          {isPending
                            ? "Opslaan..."
                            : classCreateCount > 1
                              ? "Lessen toevoegen"
                              : isOpenGymClassType
                                ? "Gymplek toevoegen"
                                : "Les toevoegen"}
                        </Button>
                      </div>
                    </form>
                  )}
                </Card.Content>
              </Card>
            ) : null}

            {classesView === "schedule" ? (
              upcomingSessions.length > 0 ? (
                <>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="field-stack">
                    <Label>Zoeken</Label>
                    <Input
                      fullWidth
                      placeholder="Zoek op lesnaam, focus of niveau"
                      value={classSearch}
                      onChange={(event) => setClassSearch(event.target.value)}
                    />
                  </div>
                  <label className="field-stack">
                    <span className="text-sm font-medium">Filter</span>
                    <select
                      className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                      value={classStatusFilter}
                      onChange={(event) => setClassStatusFilter(event.target.value)}
                    >
                      <option value="all">Alle statussen</option>
                      <option value="active">Actief</option>
                      <option value="paused">Gepauzeerd</option>
                      <option value="archived">Gearchiveerd</option>
                    </select>
                  </label>
                </div>
                {filteredClassSessions.length > 0 ? (
                <ListView aria-label="Lessen" items={filteredClassSessions}>
                  {(session) => {
                    const bookingKind = session.bookingKind ?? "class";
                    const locationName =
                      locationNameById.get(session.locationId) ??
                      (session.locationId
                        ? `Onbekende vestiging (${session.locationId})`
                        : "Vestiging ontbreekt");
                    const trainerName =
                      bookingKind === "open_gym"
                        ? "Geen trainer nodig"
                        : trainerNameById.get(session.trainerId) ??
                          (session.trainerId
                            ? `Onbekende trainer (${session.trainerId})`
                            : "Trainer ontbreekt");

                    return (
                    <ListView.Item id={session.id} textValue={session.title}>
                      <ListView.ItemContent>
                        <ListView.Title>{session.title}</ListView.Title>
                        <ListView.Description>
                          <span className="block">
                            {formatDateTime(session.startsAt)} · Vestiging: {locationName} ·
                            Trainer: {trainerName}
                          </span>
                          <span className="block">
                            Duur: {session.durationMinutes} min · Capaciteit:{" "}
                            {session.bookedCount}/{session.capacity} · Focus: {session.focus}
                          </span>
                        </ListView.Description>
                      </ListView.ItemContent>
                      <div className="flex flex-wrap gap-2">
                        <Chip size="sm" variant="tertiary">
                          {getBookingKindLabel(bookingKind)}
                        </Chip>
                        <Chip size="sm" variant="tertiary">
                          {getClassLevelLabel(session.level)}
                        </Chip>
                        <Chip size="sm" variant="tertiary">
                          {getEntityStatusLabel(session.status)}
                        </Chip>
                        {session.seriesId ? (
                          <Chip size="sm" variant="soft">
                            Serie
                          </Chip>
                        ) : null}
                      </div>
                      <DashboardEntityActions
                        endpoint="/api/platform/classes"
                        entityLabel={`Les ${session.title}`}
                        updatePayloadBase={{
                          id: session.id,
                          expectedVersion: session.version,
                        }}
                        archivePayload={{
                          id: session.id,
                          expectedVersion: session.version,
                        }}
                        deletePayload={{
                          id: session.id,
                          expectedVersion: session.version,
                        }}
                        extraActions={
                          session.seriesId
                            ? [
                                {
                                  label: "Verwijder serie",
                                  method: "DELETE",
                                  payload: {
                                    operation: "delete_series",
                                    id: session.id,
                                    expectedVersion: session.version,
                                  },
                                  successMessage: `Serie ${session.title} verwijderd.`,
                                  tone: "danger",
                                },
                              ]
                            : []
                        }
                        fields={[
                          { name: "title", label: "Lesnaam", defaultValue: session.title },
                          {
                            name: "bookingKind",
                            label: "Boekingstype",
                            defaultValue: bookingKind,
                            type: "select",
                            options: [
                              { value: "class", label: "Les met trainer" },
                              { value: "open_gym", label: "Boekbare gymplek" },
                            ],
                          },
                          {
                            name: "locationId",
                            label: "Vestiging",
                            defaultValue: session.locationId,
                            type: "select",
                            options: buildLocationFieldOptions(session.locationId, snapshot.locations),
                          },
                          {
                            name: "trainerId",
                            label: "Trainer",
                            defaultValue: session.trainerId,
                            type: "select",
                            options: buildTrainerFieldOptions(
                              session.trainerId,
                              bookingKind,
                              snapshot.trainers,
                            ),
                          },
                          {
                            name: "startsAt",
                            label: "Starttijd",
                            defaultValue: session.startsAt.slice(0, 16),
                            type: "datetime-local",
                          },
                          {
                            name: "durationMinutes",
                            label: "Duur minuten",
                            defaultValue: session.durationMinutes,
                            type: "number",
                          },
                          {
                            name: "capacity",
                            label: "Capaciteit",
                            defaultValue: session.capacity,
                            type: "number",
                          },
                          {
                            name: "level",
                            label: "Niveau",
                            defaultValue: session.level,
                            type: "select",
                            options: [
                              { value: "beginner", label: "Beginner" },
                              { value: "mixed", label: "Gemengd" },
                              { value: "advanced", label: "Gevorderd" },
                            ],
                          },
                          { name: "focus", label: "Focus", defaultValue: session.focus },
                          {
                            name: "status",
                            label: "Status",
                            defaultValue: session.status,
                            type: "select",
                            options: [
                              { value: "active", label: "Actief" },
                              { value: "paused", label: "Gepauzeerd" },
                              { value: "archived", label: "Gearchiveerd" },
                            ],
                          },
                        ]}
                      />
                    </ListView.Item>
                    );
                  }}
                </ListView>
                ) : (
                  <EmptyPanel
                    title="Geen lessen gevonden"
                    description="Pas je zoekterm of statusfilter aan om meer lessen te tonen."
                  />
                )}
                </>
              ) : (
                <EmptyPanel
                  title="Nog geen lessen"
                  description="Plan je eerste les via lesplanning."
                />
              )
            ) : typeFilteredBookings.length > 0 ? (
              <div className="grid gap-3">
                {typeFilteredBookings.map((booking) => {
                  const chip = statusChip(booking.status);

                  return (
                    <Card key={booking.id} className="rounded-2xl border-border/80">
                      <Card.Content className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{booking.memberName}</p>
                            <Chip color={chip.color} size="sm" variant={chip.variant}>
                              {getBookingStatusLabel(booking.status)}
                            </Chip>
                          </div>
                          <p className="text-muted text-sm">
                            {booking.phone} · {getBookingSourceLabel(booking.source)}
                          </p>
                          {booking.notes ? (
                            <p className="text-muted text-sm">{booking.notes}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {snapshot.uiCapabilities.canRecordAttendance &&
                          booking.status !== "checked_in" ? (
                            <AttendanceButton
                              bookingId={booking.id}
                              expectedVersion={booking.version}
                            />
                          ) : null}
                          {snapshot.uiCapabilities.canCreateBooking &&
                          booking.status !== "cancelled" ? (
                            <CancelBookingButton
                              bookingId={booking.id}
                              expectedVersion={booking.version}
                            />
                          ) : null}
                        </div>
                      </Card.Content>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel
                title="Nog geen reserveringen"
                description="Reserveringen verschijnen hier zodra leden lessen boeken."
              />
            )}
        </div>
      </PageSection>

      <PageSection
        title="Reserveringsmodules"
        description="Compact overzicht van rooster, groepsreserveringen, proeflessen en aanwezigheid."
      >
        <FeatureModuleBoard currentPage="classes" features={classFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
