"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input, Label } from "@heroui/react";
import { ListView } from "@heroui-pro/react/list-view";
import { Segment } from "@heroui-pro/react/segment";
import { toast } from "sonner";
import { AttendanceButton } from "@/components/AttendanceButton";
import { BookingDialog } from "@/components/BookingDialog";
import { CancelBookingButton } from "@/components/CancelBookingButton";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import {
  EmptyPanel,
  PageSection,
  formatDateTime,
  statusChip,
  type DashboardPageProps,
} from "@/components/dashboard/shared";

export function ClassesDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [classesView, setClassesView] = useState<"schedule" | "bookings">("schedule");
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
  const recentBookings = [...snapshot.bookings].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const classFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "classes",
  );

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

  return (
    <div className="section-stack">
      <PageSection
        title="Booking stack"
        description="Rooster, groepsboekingen, trials en check-ins blijven per club afzonderlijk beheersbaar."
      >
        <FeatureModuleBoard features={classFeatures} snapshot={snapshot} />
      </PageSection>

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
          actions={<BookingDialog classSessions={snapshot.classSessions} members={snapshot.members} />}
          title="Classes and bookings"
          description="Switch between schedule and booking operations."
        >
          <div className="grid content-start gap-3">
            <Segment
              className="w-full max-w-[22rem]"
              selectedKey={classesView}
              size="sm"
              onSelectionChange={(key) => setClassesView(String(key) as typeof classesView)}
            >
              <Segment.Item id="schedule">Schedule</Segment.Item>
              <Segment.Item id="bookings">Bookings</Segment.Item>
            </Segment>

            {classesView === "schedule" ? (
              upcomingSessions.length > 0 ? (
                <ListView aria-label="Classes" items={upcomingSessions}>
                  {(session) => (
                    <ListView.Item id={session.id} textValue={session.title}>
                      <ListView.ItemContent>
                        <ListView.Title>{session.title}</ListView.Title>
                        <ListView.Description>
                          {formatDateTime(session.startsAt)} · {session.focus} · {session.bookedCount}/
                          {session.capacity}
                        </ListView.Description>
                      </ListView.ItemContent>
                      <Chip size="sm" variant="tertiary">
                        {session.level}
                      </Chip>
                    </ListView.Item>
                  )}
                </ListView>
              ) : (
                <EmptyPanel
                  title="No classes yet"
                  description="Schedule the first live class from the workbench."
                />
              )
            ) : recentBookings.length > 0 ? (
              <div className="grid gap-3">
                {recentBookings.map((booking) => {
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
                title="No bookings yet"
                description="Bookings will populate here once members start reserving."
              />
            )}
          </div>
        </PageSection>

        <LazyPlatformWorkbench sections={["classes"]} showLaunchHeader={false} snapshot={snapshot} />
      </div>
    </div>
  );
}
