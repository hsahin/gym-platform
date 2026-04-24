"use client";

import { Card } from "@heroui/react";
import { PageSection, type DashboardPageProps } from "@/components/dashboard/shared";

export function MarketingDashboardPage({ snapshot }: DashboardPageProps) {
  const totalCapacity = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.capacity,
    0,
  );
  const confirmedBookings = snapshot.bookings.filter((booking) =>
    ["confirmed", "checked_in"].includes(booking.status),
  );
  const occupancy =
    totalCapacity === 0
      ? 0
      : Math.round((confirmedBookings.length / totalCapacity) * 100);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PageSection
        title="Growth signals"
        description="Operational growth inputs pulled from actual bookings and member state."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-2">
              <p className="text-muted text-sm">Occupancy</p>
              <p className="text-3xl font-semibold">{occupancy}%</p>
              <p className="text-muted text-sm">
                Use this to spot fill pressure and class timing issues.
              </p>
            </Card.Content>
          </Card>
          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-2">
              <p className="text-muted text-sm">Trials</p>
              <p className="text-3xl font-semibold">
                {snapshot.members.filter((member) => member.status === "trial").length}
              </p>
              <p className="text-muted text-sm">
                Trial members are the clearest short-term conversion queue.
              </p>
            </Card.Content>
          </Card>
        </div>
      </PageSection>

      <PageSection
        title="Member messaging"
        description="Keep the outbound copy anchored to actual supply and member state."
      >
        <Card className="rounded-2xl border-border/80 bg-surface-secondary">
          <Card.Content className="space-y-2">
            <p className="text-sm leading-6">{snapshot.notificationPreview}</p>
          </Card.Content>
        </Card>
      </PageSection>
    </div>
  );
}
