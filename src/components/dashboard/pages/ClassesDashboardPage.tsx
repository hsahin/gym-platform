"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input, Label } from "@heroui/react";
import { ListView } from "@/components/dashboard/HydrationSafeListView";
import { Segment } from "@heroui-pro/react/segment";
import { toast } from "sonner";
import { AttendanceButton } from "@/components/AttendanceButton";
import { BookingDialog } from "@/components/BookingDialog";
import { CancelBookingButton } from "@/components/CancelBookingButton";
import { DashboardEntityActions } from "@/components/DashboardEntityActions";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import {
  ALL_CLASS_TYPE_KEY,
  buildClassTypeTabs,
  filterClassSessionsByType,
  getClassTypeKeyForSession,
  resolveSelectedClassType,
} from "@/lib/class-types";
import { filterManagementRecords } from "@/lib/dashboard-management";
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

export function ClassesDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [classesView, setClassesView] = useState<"schedule" | "bookings">("schedule");
  const [classSearch, setClassSearch] = useState("");
  const [classStatusFilter, setClassStatusFilter] = useState("all");
  const [selectedClassTypeKey, setSelectedClassTypeKey] = useState("hiit");
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
  const [lateCancelFeeCents, setLateCancelFeeCents] = useState(
    snapshot.bookingPolicy.lateCancelFeeCents,
  );
  const [noShowFeeCents, setNoShowFeeCents] = useState(snapshot.bookingPolicy.noShowFeeCents);
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
  const recentBookings = [...snapshot.bookings].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const classSessionById = new Map(
    snapshot.classSessions.map((session) => [session.id, session]),
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

  function createTypedClassSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const rawStartsAt = String(formData.get("startsAt") ?? "");

    startTransition(async () => {
      try {
        await submitDashboardMutation("/api/platform/classes", {
          title: String(formData.get("title") ?? ""),
          locationId: String(formData.get("locationId") ?? ""),
          trainerId: String(formData.get("trainerId") ?? ""),
          startsAt: new Date(rawStartsAt).toISOString(),
          durationMinutes: Number(formData.get("durationMinutes") ?? "45"),
          capacity: Number(formData.get("capacity") ?? "16"),
          level: String(formData.get("level") ?? "mixed"),
          focus: selectedClassType.focus,
        });
        toast.success(`${selectedClassType.label} les gepland.`);
        form.reset();
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
    setLateCancelFeeCents(snapshot.bookingPolicy.lateCancelFeeCents);
    setNoShowFeeCents(snapshot.bookingPolicy.noShowFeeCents);
    setMaxDailyBookingsPerMember(snapshot.bookingPolicy.maxDailyBookingsPerMember);
    setMaxDailyWaitlistPerMember(snapshot.bookingPolicy.maxDailyWaitlistPerMember);
    setAutoPromoteWaitlist(snapshot.bookingPolicy.autoPromoteWaitlist);
  }, [snapshot.bookingPolicy, snapshot.bookingWorkspace]);

  useEffect(() => {
    if (!classTypeTabs.some((tab) => tab.key === selectedClassTypeKey)) {
      setSelectedClassTypeKey(classTypeTabs[0]?.key ?? ALL_CLASS_TYPE_KEY);
    }
  }, [classTypeTabs, selectedClassTypeKey]);

  return (
    <div className="section-stack">
      <PageSection
        title="Booking setup"
        description="Leg PT-booking, trial intake en credit packs vast zodat planners en frontdesk met dezelfde spelregels werken."
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
                  toast.success("Bookinginstellingen opgeslagen.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Bookinginstellingen opslaan mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Booking opslaan"}
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
              <Label>Trial booking URL</Label>
              <Input
                fullWidth
                placeholder="https://book.jegym.nl/trial"
                value={trialBookingUrl}
                onChange={(event) => setTrialBookingUrl(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Standaard credit pack</Label>
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
              <Input fullWidth readOnly value="Live scheduling actief" />
            </div>
          </Card.Content>
        </Card>
      </PageSection>

      <PageSection
        title="Booking policy"
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
                  toast.success("Booking policy opgeslagen.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Booking policy opslaan mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Policy opslaan"}
          </Button>
        }
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="field-stack">
              <Label>Annulering venster (uur)</Label>
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
              <Label>Late cancel fee (cent)</Label>
              <Input
                fullWidth
                min={0}
                type="number"
                value={String(lateCancelFeeCents)}
                onChange={(event) => setLateCancelFeeCents(Number(event.target.value || "0"))}
              />
            </div>
            <div className="field-stack">
              <Label>No-show fee (cent)</Label>
              <Input
                fullWidth
                min={0}
                type="number"
                value={String(noShowFeeCents)}
                onChange={(event) => setNoShowFeeCents(Number(event.target.value || "0"))}
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
              <Label>Auto-promote wachtlijst</Label>
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
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
                          : `Plan ${selectedClassType.label}`}
                      </p>
                      <p className="text-muted text-sm leading-6">
                        {selectedClassType.description}
                      </p>
                    </div>
                    <Chip size="sm" variant="tertiary">
                      {selectedClassType.count} gepland
                    </Chip>
                  </div>

                  {classesView === "schedule" && selectedClassType.key !== ALL_CLASS_TYPE_KEY ? (
                    snapshot.locations.length > 0 && snapshot.trainers.length > 0 ? (
                      <form
                        key={selectedClassType.key}
                        className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
                        onSubmit={createTypedClassSession}
                      >
                        <div className="field-stack xl:col-span-2">
                          <Label>Lesnaam</Label>
                          <Input
                            fullWidth
                            name="title"
                            defaultValue={selectedClassType.defaultTitle}
                            required
                          />
                        </div>
                        <div className="field-stack">
                          <Label>Soort / focus</Label>
                          <Input fullWidth readOnly value={selectedClassType.focus} />
                        </div>
                        <label className="field-stack">
                          <span className="text-sm font-medium">Niveau</span>
                          <select
                            className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                            name="level"
                            defaultValue="mixed"
                          >
                            <option value="beginner">Beginner</option>
                            <option value="mixed">Mixed</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </label>
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
                        <div className="field-stack">
                          <Label>Starttijd</Label>
                          <Input
                            fullWidth
                            name="startsAt"
                            defaultValue={defaultClassStartValue()}
                            required
                            type="datetime-local"
                          />
                        </div>
                        <div className="field-stack">
                          <Label>Duur</Label>
                          <Input
                            fullWidth
                            min={15}
                            name="durationMinutes"
                            defaultValue="45"
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
                            defaultValue="16"
                            required
                            type="number"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button isDisabled={isPending} type="submit" variant="primary">
                            {isPending ? "Plannen..." : `${selectedClassType.label} plannen`}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <p className="text-muted mt-3 text-sm leading-6">
                        Voeg eerst minimaal één vestiging en trainer toe via Instellingen voordat je lessen plant.
                      </p>
                    )
                  ) : classesView === "schedule" ? (
                    <p className="text-muted mt-3 text-sm leading-6">
                      Kies een specifiek lestype zoals HIIT, Boxing of Yoga om direct een les met dat type te plannen.
                    </p>
                  ) : null}
                </div>
              </Card.Content>
            </Card>

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
                  {(session) => (
                    <ListView.Item id={session.id} textValue={session.title}>
                      <ListView.ItemContent>
                        <ListView.Title>{session.title}</ListView.Title>
                        <ListView.Description>
                          {formatDateTime(session.startsAt)} · {session.focus} · {session.bookedCount}/
                          {session.capacity}
                        </ListView.Description>
                      </ListView.ItemContent>
                      <div className="flex flex-wrap gap-2">
                        <Chip size="sm" variant="tertiary">
                          {session.level}
                        </Chip>
                        <Chip size="sm" variant="tertiary">
                          {session.status}
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
                                  successMessage: `Recurring serie ${session.title} verwijderd.`,
                                  tone: "danger",
                                },
                              ]
                            : []
                        }
                        fields={[
                          { name: "title", label: "Lesnaam", defaultValue: session.title },
                          {
                            name: "locationId",
                            label: "Vestiging",
                            defaultValue: session.locationId,
                            type: "select",
                            options: snapshot.locations.map((location) => ({
                              value: location.id,
                              label: location.name,
                            })),
                          },
                          {
                            name: "trainerId",
                            label: "Trainer",
                            defaultValue: session.trainerId,
                            type: "select",
                            options: snapshot.trainers.map((trainer) => ({
                              value: trainer.id,
                              label: trainer.fullName,
                            })),
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
                              { value: "mixed", label: "Mixed" },
                              { value: "advanced", label: "Advanced" },
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
                  )}
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
                  description="Plan je eerste live les vanuit de workbench."
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
                              {booking.status}
                            </Chip>
                          </div>
                          <p className="text-muted text-sm">
                            {booking.phone} · {booking.source}
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

        <LazyPlatformWorkbench sections={["classes"]} showLaunchHeader={false} snapshot={snapshot} />
      </div>

      <PageSection
        title="Booking modules"
        description="Compact overzicht van rooster, groepsboekingen, trials en check-ins."
      >
        <FeatureModuleBoard features={classFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
