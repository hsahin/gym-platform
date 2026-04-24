"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, Card, Chip, Input, Label, TextArea } from "@heroui/react";
import { Segment } from "@heroui-pro/react/segment";
import { toast } from "sonner";
import { HeroPhoneNumberField } from "@/components/HeroPhoneNumberField";
import { ThemeModeSwitch } from "@/components/theme/ThemeModeSwitch";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";
import type { PublicReservationSnapshot } from "@/server/types";

type BookingStep = "gym" | "classes" | "confirm" | "done";

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

export function PublicReservationPortal({
  snapshot,
}: {
  snapshot: PublicReservationSnapshot;
}) {
  const [bookingStep, setBookingStep] = useState<BookingStep>(
    snapshot.tenantSlug ? "classes" : "gym",
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("NL");
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
    setBookingStep(snapshot.tenantSlug ? "classes" : "gym");
    setSelectedClassSessionId(snapshot.classSessions[0]?.id ?? "");
    setLastResult(null);
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
            fullName,
            email,
            phone,
            phoneCountry,
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
          <p className="text-sm font-semibold">GymOS Reservations</p>
          <p className="text-muted text-sm">
            {snapshot.tenantSlug ? snapshot.tenantName : "Kies eerst je gym"}
          </p>
        </div>

        <div className="app-header__actions">
          {snapshot.tenantSlug ? (
            <Chip size="sm" variant="soft">
              {snapshot.classSessions.length} lessen live
            </Chip>
          ) : null}
          <nav className="app-header__nav text-sm">
            <Link href="/" className="text-muted transition hover:text-foreground">
              Home
            </Link>
            <Link href="/login" className="text-muted transition hover:text-foreground">
              Team login
            </Link>
          </nav>
          <ThemeModeSwitch />
        </div>
      </header>

      {snapshot.tenantSlug ? (
        <Segment selectedKey={bookingStep === "done" ? "confirm" : bookingStep}>
          <Segment.Item id="classes">Lessen</Segment.Item>
          <Segment.Item id="confirm">Gegevens</Segment.Item>
        </Segment>
      ) : null}

      {bookingStep === "gym" ? (
        <section className="section-stack">
          <div className="max-w-2xl space-y-3">
            <h1 className="text-4xl font-semibold leading-tight">Kies je sportschool</h1>
            <p className="text-muted text-base leading-7">
              Elke gym heeft een eigen roster, capaciteit en bevestigingsflow.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.availableGyms.length > 0 ? (
              snapshot.availableGyms.map((gym) => (
                <Link key={gym.id} href={`/reserve?gym=${gym.slug}`}>
                  <Card className="h-full rounded-[28px] border-border/80 transition hover:border-accent/30">
                    <Card.Header>
                      <Card.Title>{gym.name}</Card.Title>
                      <Card.Description>
                        Open direct het live rooster van deze gym.
                      </Card.Description>
                    </Card.Header>
                    <Card.Content>
                      <Chip size="sm" variant="tertiary">
                        Eigen reserveringsflow
                      </Chip>
                    </Card.Content>
                  </Card>
                </Link>
              ))
            ) : (
              <Card className="rounded-[28px] border-border/80 md:col-span-2 xl:col-span-3">
                <Card.Content>
                  <p className="text-muted text-sm">
                    Er is nog geen gym aangemaakt. Meld eerst een gym owner aan.
                  </p>
                </Card.Content>
              </Card>
            )}
          </div>
        </section>
      ) : null}

      {bookingStep === "classes" ? (
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
                            {formatSessionMoment(classSession.startsAt)} · {classSession.locationName}
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
          </div>

          <Card className="rounded-[28px] border-border/80">
            <Card.Header className="space-y-3">
              <Card.Title>Geselecteerde les</Card.Title>
              <Card.Description>
                Controleer de les en ga door naar je gegevens.
              </Card.Description>
            </Card.Header>
            <Card.Content className="section-stack">
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

      {bookingStep === "confirm" ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-[28px] border-border/80">
            <Card.Header className="space-y-3">
              <Card.Title>Je gegevens</Card.Title>
              <Card.Description>
                Alleen de gegevens die nodig zijn voor je reservering.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <form className="section-stack" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="field-stack">
                    <Label>Naam</Label>
                    <Input
                      fullWidth
                      autoComplete="name"
                      placeholder="Voor- en achternaam"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </div>
                  <div className="field-stack">
                    <Label>E-mail</Label>
                    <Input
                      fullWidth
                      autoComplete="email"
                      placeholder="naam@voorbeeld.nl"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </div>

                <HeroPhoneNumberField
                  country={phoneCountry}
                  onCountryChange={setPhoneCountry}
                  phone={phone}
                  onPhoneChange={setPhone}
                />

                <div className="field-stack">
                  <Label>Notities</Label>
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
                  <Button isDisabled={isPending} type="submit">
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
              ) : null}
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
            <Link href="/" className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium">
              Naar homepage
            </Link>
          </Card.Content>
        </Card>
      ) : null}
    </div>
  );
}
