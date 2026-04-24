"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, Card, Chip, TextArea } from "@heroui/react";
import { Segment } from "@heroui-pro/react/segment";
import { toast } from "sonner";
import { ThemeModeSwitch } from "@/components/theme/ThemeModeSwitch";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";
import type { MemberReservationSnapshot } from "@/server/types";

type BookingStep = "club" | "classes" | "confirm" | "done";

function formatSessionMoment(startsAt: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(startsAt));
}

function formatClubCount(count: number) {
  return `${count} club${count === 1 ? "" : "s"}`;
}

export function PublicReservationPortal({
  snapshot,
}: {
  snapshot: MemberReservationSnapshot;
}) {
  const [bookingStep, setBookingStep] = useState<BookingStep>(
    snapshot.tenantSlug ? "classes" : "club",
  );
  const [notes, setNotes] = useState("");
  const [selectedClassSessionId, setSelectedClassSessionId] = useState(
    snapshot.classSessions[0]?.id ?? "",
  );
  const [lastResult, setLastResult] = useState<{
    bookingId: string;
    status: string;
    messagePreview: string;
    alreadyExisted: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setBookingStep(snapshot.tenantSlug ? "classes" : "club");
    setSelectedClassSessionId(snapshot.classSessions[0]?.id ?? "");
    setLastResult(null);
    setNotes("");
  }, [snapshot.classSessions, snapshot.tenantSlug]);

  const selectedClass = useMemo(
    () =>
      snapshot.classSessions.find(
        (classSession) => classSession.id === selectedClassSessionId,
      ) ?? snapshot.classSessions[0],
    [selectedClassSessionId, snapshot.classSessions],
  );

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
  const remainingSpots = selectedClass
    ? Math.max(selectedClass.capacity - selectedClass.bookedCount, 0)
    : 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedClassSessionId) {
      toast.error("Kies eerst een les.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/public/reservations", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
            "x-idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            tenantSlug: snapshot.tenantSlug ?? undefined,
            classSessionId: selectedClassSessionId,
            notes: notes || undefined,
          }),
        });

        const payload = (await response.json()) as {
          ok: boolean;
          data?: {
            booking: {
              id: string;
              status: string;
            };
            messagePreview: string;
            alreadyExisted: boolean;
          };
          error?: {
            message: string;
          };
        };

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(
            payload.error?.message ?? "Reserveren is op dit moment niet gelukt.",
          );
        }

        setLastResult({
          bookingId: payload.data.booking.id,
          status: payload.data.booking.status,
          messagePreview: payload.data.messagePreview,
          alreadyExisted: payload.data.alreadyExisted,
        });
        setBookingStep("done");

        toast.success(
          payload.data.alreadyExisted
            ? "Je reservering bestond al en is opnieuw geladen."
            : payload.data.booking.status === "waitlisted"
              ? "Je staat nu op de wachtlijst."
              : "Je reservering is bevestigd.",
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Reserveren is op dit moment niet gelukt.",
        );
      }
    });
  }

  return (
    <div className="section-stack py-6 md:py-8">
      <header className="app-header">
        <div className="app-header__brand-copy">
          <p className="text-sm font-semibold">Club reservations</p>
          <p className="text-muted text-sm">
            {snapshot.tenantSlug
              ? snapshot.tenantName
              : snapshot.hasEligibleMembership
                ? "Kies een club"
                : "Alleen voor bestaande leden"}
          </p>
        </div>

        <div className="app-header__actions">
          {snapshot.hasEligibleMembership ? (
            <Chip size="sm" variant="soft">
              {formatClubCount(snapshot.availableClubs.length)}
            </Chip>
          ) : null}
          <nav className="app-header__nav text-sm">
            <Link href="/" className="text-muted transition hover:text-foreground">
              Home
            </Link>
            <Link href="/dashboard" className="text-muted transition hover:text-foreground">
              Dashboard
            </Link>
          </nav>
          <ThemeModeSwitch />
        </div>
      </header>

      {!snapshot.hasEligibleMembership ? (
        <Card className="rounded-[28px] border-border/80">
          <Card.Header className="space-y-3">
            <Card.Title>Geen actief lidmaatschap gevonden</Card.Title>
            <Card.Description>
              Dit account kan alleen reserveren bij clubs waar hetzelfde e-mailadres
              al als actief of trial lid is gekoppeld.
            </Card.Description>
          </Card.Header>
          <Card.Content className="section-stack">
            <div className="flex flex-wrap gap-2">
              <Chip size="sm" variant="soft">
                {snapshot.memberDisplayName}
              </Chip>
              {snapshot.memberEmail ? (
                <Chip size="sm" variant="tertiary">
                  {snapshot.memberEmail}
                </Chip>
              ) : null}
            </div>
            <p className="text-muted text-sm leading-6">
              Laat je club je memberprofiel koppelen aan dit e-mailadres of log in
              met het account dat al op je lidmaatschap staat.
            </p>
          </Card.Content>
        </Card>
      ) : null}

      {snapshot.hasEligibleMembership && snapshot.tenantSlug ? (
        <Segment selectedKey={bookingStep === "done" ? "confirm" : bookingStep} size="sm">
          <Segment.Item id="classes">Lessen</Segment.Item>
          <Segment.Item id="confirm">Bevestigen</Segment.Item>
        </Segment>
      ) : null}

      {snapshot.hasEligibleMembership && bookingStep === "club" ? (
        <section className="section-stack">
          <div className="max-w-2xl space-y-3">
            <h1 className="text-4xl font-semibold leading-tight">Kies je club</h1>
            <p className="text-muted text-base leading-7">
              Je ziet alleen clubs waar dit account al als lid bekend is.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.availableClubs.map((club) => (
              <Link key={club.id} href={`/reserve?gym=${club.slug}`}>
                <Card className="h-full rounded-[28px] border-border/80 transition hover:border-accent/30">
                  <Card.Header>
                    <Card.Title>{club.name}</Card.Title>
                    <Card.Description>
                      Open direct het rooster van deze club.
                    </Card.Description>
                  </Card.Header>
                  <Card.Content>
                    <Chip size="sm" variant="tertiary">
                      Alleen voor leden
                    </Chip>
                  </Card.Content>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {snapshot.hasEligibleMembership && bookingStep === "classes" ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="section-stack">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Lessen", value: snapshot.classSessions.length },
                { label: "Capaciteit", value: totalCapacity },
                { label: "Bezetting", value: `${occupancy}%` },
              ].map((metric) => (
                <Card key={metric.label} className="rounded-2xl border-border/80">
                  <Card.Content className="metric-stack">
                    <p className="text-muted text-sm">{metric.label}</p>
                    <p className="text-3xl font-semibold tabular-nums">{metric.value}</p>
                  </Card.Content>
                </Card>
              ))}
            </div>

            {snapshot.classSessions.length > 0 ? (
              <div className="grid gap-4">
                {snapshot.classSessions.map((classSession) => {
                  const isSelected = classSession.id === selectedClassSessionId;
                  const spotsLeft = Math.max(
                    classSession.capacity - classSession.bookedCount,
                    0,
                  );

                  return (
                    <button
                      key={classSession.id}
                      type="button"
                      className="text-left"
                      onClick={() => setSelectedClassSessionId(classSession.id)}
                    >
                      <Card
                        className={`rounded-[28px] border-border/80 transition ${
                          isSelected ? "ring-2 ring-accent/20" : ""
                        }`}
                      >
                        <Card.Header className="items-start justify-between gap-4">
                          <div className="space-y-2">
                            <Card.Title>{classSession.title}</Card.Title>
                            <Card.Description>
                              {formatSessionMoment(classSession.startsAt)} ·{" "}
                              {classSession.locationName}
                            </Card.Description>
                          </div>
                          <Chip
                            color={spotsLeft > 0 ? "success" : "warning"}
                            size="sm"
                            variant="soft"
                          >
                            {spotsLeft > 0 ? `${spotsLeft} plekken vrij` : "Wachtlijst"}
                          </Chip>
                        </Card.Header>
                        <Card.Content className="flex flex-wrap gap-2">
                          <Chip size="sm" variant="tertiary">
                            {classSession.trainerName}
                          </Chip>
                          <Chip size="sm" variant="tertiary">
                            {classSession.focus}
                          </Chip>
                          <Chip size="sm" variant="tertiary">
                            {classSession.level}
                          </Chip>
                        </Card.Content>
                      </Card>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Card className="rounded-[28px] border-border/80">
                <Card.Content>
                  <p className="text-muted text-sm">
                    Voor deze club staan nog geen actieve lessen live.
                  </p>
                </Card.Content>
              </Card>
            )}
          </div>

          <Card className="rounded-[28px] border-border/80">
            <Card.Header className="space-y-3">
              <Card.Title>Jouw reservering</Card.Title>
              <Card.Description>
                Je boekt als bestaand lid van {snapshot.tenantName}.
              </Card.Description>
            </Card.Header>
            <Card.Content className="section-stack">
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="soft">
                  {snapshot.memberDisplayName}
                </Chip>
                <Chip size="sm" variant="tertiary">
                  {snapshot.memberEmail}
                </Chip>
              </div>

              {selectedClass ? (
                <>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold">{selectedClass.title}</p>
                    <p className="text-muted text-sm">
                      {formatSessionMoment(selectedClass.startsAt)}
                    </p>
                    <p className="text-muted text-sm">
                      {selectedClass.locationName} · {selectedClass.trainerName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Chip size="sm" variant="soft">
                      {remainingSpots} vrij
                    </Chip>
                    <Chip size="sm" variant="tertiary">
                      {selectedClass.waitlistCount} wachtlijst
                    </Chip>
                  </div>
                  <Button
                    isDisabled={!selectedClassSessionId}
                    onPress={() => setBookingStep("confirm")}
                  >
                    Doorgaan
                  </Button>
                </>
              ) : (
                <p className="text-muted text-sm">Er is nog geen les beschikbaar.</p>
              )}
            </Card.Content>
          </Card>
        </section>
      ) : null}

      {snapshot.hasEligibleMembership && bookingStep === "confirm" ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-[28px] border-border/80">
            <Card.Header className="space-y-3">
              <Card.Title>Bevestig je plek</Card.Title>
              <Card.Description>
                Je membergegevens komen uit je bestaande clubprofiel.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <form className="section-stack" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="field-stack">
                    <p className="text-muted text-xs font-medium uppercase tracking-[0.08em]">
                      Lid
                    </p>
                    <p className="text-sm font-medium">{snapshot.memberDisplayName}</p>
                  </div>
                  <div className="field-stack">
                    <p className="text-muted text-xs font-medium uppercase tracking-[0.08em]">
                      Account
                    </p>
                    <p className="text-sm font-medium">{snapshot.memberEmail}</p>
                  </div>
                </div>

                <div className="field-stack">
                  <p className="text-muted text-xs font-medium uppercase tracking-[0.08em]">
                    Notities
                  </p>
                  <TextArea
                    fullWidth
                    rows={4}
                    placeholder="Optioneel"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>

                <div className="flex flex-wrap justify-between gap-3">
                  <Button variant="secondary" onPress={() => setBookingStep("classes")}>
                    Terug
                  </Button>
                  <Button isDisabled={isPending || !selectedClassSessionId} type="submit">
                    {isPending ? "Verwerken..." : "Reserveer"}
                  </Button>
                </div>
              </form>
            </Card.Content>
          </Card>

          <Card className="rounded-[28px] border-border/80">
            <Card.Header>
              <Card.Title>Samenvatting</Card.Title>
            </Card.Header>
            <Card.Content className="section-stack">
              {selectedClass ? (
                <>
                  <div className="space-y-2">
                    <p className="font-semibold">{selectedClass.title}</p>
                    <p className="text-muted text-sm">
                      {formatSessionMoment(selectedClass.startsAt)}
                    </p>
                    <p className="text-muted text-sm">
                      {selectedClass.locationName} · {selectedClass.trainerName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Chip size="sm" variant="soft">
                      {remainingSpots} vrij
                    </Chip>
                    <Chip size="sm" variant="tertiary">
                      {selectedClass.waitlistCount} wachtlijst
                    </Chip>
                  </div>
                </>
              ) : (
                <p className="text-muted text-sm">Kies eerst een les.</p>
              )}
            </Card.Content>
          </Card>
        </section>
      ) : null}

      {bookingStep === "done" && lastResult ? (
        <Card className="rounded-[28px] border-border/80">
          <Card.Header className="space-y-3">
            <div className="flex items-center gap-2">
              <Chip
                color={lastResult.status === "waitlisted" ? "warning" : "success"}
                size="sm"
                variant="soft"
              >
                {lastResult.status}
              </Chip>
              {lastResult.alreadyExisted ? (
                <Chip size="sm" variant="tertiary">
                  Bestond al
                </Chip>
              ) : null}
            </div>
            <Card.Title>Reservering opgeslagen</Card.Title>
            <Card.Description>{lastResult.messagePreview}</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-wrap gap-3">
            <Button onPress={() => setBookingStep("classes")}>
              Nog een les kiezen
            </Button>
            <Link
              href="/dashboard"
              className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium"
            >
              Naar dashboard
            </Link>
          </Card.Content>
        </Card>
      ) : null}
    </div>
  );
}
