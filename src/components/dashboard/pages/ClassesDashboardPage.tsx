"use client";

import { useState } from "react";
import { Card, Chip } from "@heroui/react";
import { ListView } from "@heroui-pro/react/list-view";
import { Segment } from "@heroui-pro/react/segment";
import { AttendanceButton } from "@/components/AttendanceButton";
import { BookingDialog } from "@/components/BookingDialog";
import { CancelBookingButton } from "@/components/CancelBookingButton";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import {
  EmptyPanel,
  PageSection,
  formatDateTime,
  statusChip,
  type DashboardPageProps,
} from "@/components/dashboard/shared";

export function ClassesDashboardPage({ snapshot }: DashboardPageProps) {
  const [classesView, setClassesView] = useState<"schedule" | "bookings">("schedule");
  const upcomingSessions = [...snapshot.classSessions].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  );
  const recentBookings = [...snapshot.bookings].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <div className="section-stack">
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
      </div>

      <LazyPlatformWorkbench sections={["classes"]} showLaunchHeader={false} snapshot={snapshot} />
    </div>
  );
}
