"use client";

import Link from "next/link";
import { Card, Chip, ProgressBar } from "@heroui/react";
import { ThemeModeSwitch } from "@/components/theme/ThemeModeSwitch";
import type { PublicReservationSnapshot } from "@/server/types";

function formatSessionMoment(startsAt: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(startsAt));
}

export function PublicLandingPage({
  snapshot,
}: {
  snapshot: PublicReservationSnapshot;
}) {
  const activeGymCount = snapshot.availableGyms.length || (snapshot.tenantSlug ? 1 : 0);
  const totalCapacity = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.capacity,
    0,
  );
  const bookedSpots = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.bookedCount,
    0,
  );
  const occupancy =
    totalCapacity > 0 ? Math.round((bookedSpots / totalCapacity) * 100) : 0;

  return (
    <main className="app-page section-stack py-8 md:py-10">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-surface flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold">
            G
          </div>
          <div className="app-header__brand-copy">
            <p className="text-sm font-semibold">GymOS</p>
            <p className="text-muted text-sm">Operations for multi-location gyms</p>
          </div>
        </div>

        <div className="app-header__actions">
          <nav className="app-header__nav text-sm">
            <Link href="/pricing" className="text-muted transition hover:text-foreground">
              Prijzen
            </Link>
            <Link href="/reserve" className="text-muted transition hover:text-foreground">
              Reserveren
            </Link>
            <Link href="/login" className="text-muted transition hover:text-foreground">
              Team login
            </Link>
          </nav>
          <ThemeModeSwitch />
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <Card className="rounded-[28px] border-border/80 subtle-grid">
          <Card.Header className="flex-col items-start gap-4">
            <div className="flex flex-wrap gap-2">
              <Chip size="sm" variant="soft">
                Multi-gym
              </Chip>
              <Chip size="sm" variant="tertiary">
                Live booking data
              </Chip>
            </div>
            <div className="space-y-3">
              <Card.Title className="text-4xl leading-tight md:text-5xl">
                Run bookings, members, payments, and access from one calm surface.
              </Card.Title>
              <Card.Description className="max-w-3xl text-base">
                The product is focused on actual gym operations: schedule fill, member state,
                revenue readiness, and launch setup. No marketing-shell dashboard.
              </Card.Description>
            </div>
          </Card.Header>

          <Card.Content className="section-stack">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Gyms", value: String(activeGymCount) },
                { label: "Classes live", value: String(snapshot.classSessions.length) },
                { label: "Occupancy", value: `${occupancy}%` },
              ].map((metric) => (
                <Card key={metric.label} className="rounded-2xl border-border/70 bg-surface">
                  <Card.Content className="metric-stack">
                    <p className="text-muted text-sm">{metric.label}</p>
                    <p className="text-3xl font-semibold tabular-nums">{metric.value}</p>
                  </Card.Content>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login?mode=signup"
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground"
              >
                Nieuwe gym starten
              </Link>
              <Link
                href="/reserve"
                className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium"
              >
                Lessen bekijken
              </Link>
            </div>
          </Card.Content>
        </Card>

        <Card className="rounded-[28px] border-border/80">
          <Card.Header className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Card.Title>Live demand</Card.Title>
              <Chip color={occupancy >= 75 ? "success" : "default"} size="sm" variant="soft">
                {occupancy}% gevuld
              </Chip>
            </div>
            <Card.Description>
              The public flow exposes what is actually available, not a static brochure.
            </Card.Description>
          </Card.Header>

          <Card.Content className="section-stack">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Booked</span>
                <span className="tabular-nums">
                  {bookedSpots} / {totalCapacity || 0}
                </span>
              </div>
              <ProgressBar value={occupancy} />
            </div>

            <div className="section-stack">
              {snapshot.classSessions.slice(0, 4).map((classSession) => (
                <Card
                  key={classSession.id}
                  className="rounded-2xl border-border/70 bg-surface-secondary"
                >
                  <Card.Content className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{classSession.title}</p>
                      <Chip size="sm" variant="tertiary">
                        {classSession.bookedCount}/{classSession.capacity}
                      </Chip>
                    </div>
                    <p className="text-muted text-sm">
                      {formatSessionMoment(classSession.startsAt)} · {classSession.locationName}
                    </p>
                    <p className="text-muted text-sm">{classSession.trainerName}</p>
                  </Card.Content>
                </Card>
              ))}
            </div>
          </Card.Content>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Operations first",
            copy: "Pages are organized by work: classes, members, contracts, access, payments, settings.",
          },
          {
            title: "Real setup flows",
            copy: "The workbench creates locations, memberships, trainers, staff, payments, and legal setup.",
          },
          {
            title: "Consumer flow included",
            copy: "Every gym gets its own reservation flow and live schedule without separate tooling.",
          },
        ].map((item) => (
          <Card key={item.title} className="rounded-2xl border-border/80">
            <Card.Header>
              <Card.Title>{item.title}</Card.Title>
            </Card.Header>
            <Card.Content>
              <p className="text-muted text-sm leading-6">{item.copy}</p>
            </Card.Content>
          </Card>
        ))}
      </section>
    </main>
  );
}
