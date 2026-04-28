"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, Card, Chip, Input, Label, TextArea } from "@heroui/react";
import { Segment } from "@heroui-pro/react/segment";
import { toast } from "sonner";
import { HeroPhoneNumberField } from "@/components/HeroPhoneNumberField";
import { LazyThemeModeSwitch } from "@/components/theme/LazyThemeModeSwitch";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";
import type {
  MemberReservationSnapshot,
  PublicReservationSnapshot,
} from "@/server/types";

type BookingStep = "club" | "classes" | "confirm" | "done";
type ReservationPortalSnapshot =
  | MemberReservationSnapshot
  | PublicReservationSnapshot;

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

function getRequestStatusLabel(status: string) {
  switch (status) {
    case "approved":
      return "Goedgekeurd";
    case "rejected":
      return "Afgewezen";
    case "pending":
      return "Open";
    default:
      return status;
  }
}

function getBookingStatusLabel(status: string) {
  switch (status) {
    case "waitlisted":
      return "Wachtlijst";
    case "confirmed":
      return "Bevestigd";
    default:
      return status;
  }
}

function isMemberReservationSnapshot(
  snapshot: ReservationPortalSnapshot,
): snapshot is MemberReservationSnapshot {
  return "hasEligibleMembership" in snapshot;
}

export function PublicReservationPortal({
  snapshot,
}: {
  snapshot: ReservationPortalSnapshot;
}) {
  const isMemberFlow = isMemberReservationSnapshot(snapshot);
  const availableClubs = isMemberFlow ? snapshot.availableClubs : snapshot.availableGyms;
  const canReserve = !isMemberFlow || snapshot.hasEligibleMembership;
  const selfService = isMemberFlow ? snapshot.selfService : null;
  const [bookingStep, setBookingStep] = useState<BookingStep>(
    snapshot.tenantSlug ? "classes" : "club",
  );
  const [isSelfServicePending, startSelfServiceTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [publicFullName, setPublicFullName] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [publicPhoneCountry, setPublicPhoneCountry] = useState("NL");
  const [publicPhone, setPublicPhone] = useState("");
  const [selectedClassSessionId, setSelectedClassSessionId] = useState(
    snapshot.classSessions[0]?.id ?? "",
  );
  const [requestedMethodLabel, setRequestedMethodLabel] = useState("Nieuwe SEPA IBAN");
  const [paymentMethodNote, setPaymentMethodNote] = useState("");
  const [pauseStartsAt, setPauseStartsAt] = useState("");
  const [pauseEndsAt, setPauseEndsAt] = useState("");
  const [pauseReason, setPauseReason] = useState("");
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
    setPublicFullName("");
    setPublicEmail("");
    setPublicPhoneCountry("NL");
    setPublicPhone("");
    setRequestedMethodLabel("Nieuwe SEPA IBAN");
    setPaymentMethodNote("");
    setPauseStartsAt("");
    setPauseEndsAt("");
    setPauseReason("");
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
  const primaryContract = selfService?.contracts[0] ?? null;
  const paymentMethodRequestReady = Boolean(
    primaryContract && requestedMethodLabel.trim(),
  );
  const pauseRequestReady = Boolean(
    primaryContract && pauseStartsAt && pauseEndsAt && pauseReason.trim(),
  );
  const publicReservationReady =
    isMemberFlow ||
    Boolean(publicFullName.trim() && publicEmail.trim() && publicPhone.trim());

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedClassSessionId) {
      toast.error("Kies eerst een les.");
      return;
    }

    if (!publicReservationReady) {
      toast.error("Vul naam, e-mail en telefoonnummer in voordat je reserveert.");
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
            fullName: isMemberFlow ? undefined : publicFullName,
            email: isMemberFlow ? undefined : publicEmail,
            phone: isMemberFlow ? undefined : publicPhone,
            phoneCountry: isMemberFlow ? undefined : publicPhoneCountry,
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

  async function handleMemberSelfServiceSubmit(input: {
    readonly operation: "request_payment_method_update" | "request_pause";
    readonly body: Record<string, unknown>;
    readonly successMessage: string;
  }) {
    startSelfServiceTransition(async () => {
      try {
        const response = await fetch("/api/member/mobile-self-service", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
            "x-idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            operation: input.operation,
            ...input.body,
          }),
        });
        const payload = (await response.json()) as {
          ok: boolean;
          error?: { message?: string };
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error?.message ?? "Zelfserviceaanvraag mislukt.");
        }

        if (input.operation === "request_payment_method_update") {
          setRequestedMethodLabel("Nieuwe SEPA IBAN");
          setPaymentMethodNote("");
        } else {
          setPauseStartsAt("");
          setPauseEndsAt("");
          setPauseReason("");
        }

        toast.success(input.successMessage);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Zelfserviceaanvraag mislukt.",
        );
      }
    });
  }

  return (
    <div className="section-stack py-6 md:py-8">
      <header className="app-header">
        <div className="app-header__brand-copy">
          <p className="text-sm font-semibold">Lesreserveringen</p>
          <p className="text-muted text-sm">
            {snapshot.tenantSlug
              ? snapshot.tenantName
              : canReserve
                ? "Kies een club"
                : "Alleen voor gekoppelde leden"}
          </p>
        </div>

        <div className="app-header__actions">
          {availableClubs.length > 0 ? (
            <Chip size="sm" variant="soft">
              {formatClubCount(availableClubs.length)}
            </Chip>
          ) : null}
          <nav className="app-header__nav text-sm">
            <Link href="/" prefetch={false} className="text-muted transition hover:text-foreground">
              Start
            </Link>
            <Link
              href="/login"
              prefetch={false}
              className="text-muted transition hover:text-foreground"
            >
              Team login
            </Link>
          </nav>
          <LazyThemeModeSwitch />
        </div>
      </header>

      {isMemberFlow && !snapshot.hasEligibleMembership ? (
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
              Laat je club je lidprofiel koppelen aan dit e-mailadres of log in
              met het account dat al op je lidmaatschap staat.
            </p>
          </Card.Content>
        </Card>
      ) : null}

      {canReserve && snapshot.tenantSlug ? (
        <Segment selectedKey={bookingStep === "done" ? "confirm" : bookingStep} size="sm">
          <Segment.Item id="classes">Lessen</Segment.Item>
          <Segment.Item id="confirm">Bevestigen</Segment.Item>
        </Segment>
      ) : null}

      {canReserve && bookingStep === "club" ? (
        <section className="section-stack">
          <div className="max-w-2xl space-y-3">
            <h1 className="text-4xl font-semibold leading-tight">Kies je club</h1>
            <p className="text-muted text-base leading-7">
              Kies de sportschool waar je een les wilt boeken.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableClubs.map((club) => (
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
                      Open rooster
                    </Chip>
                  </Card.Content>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {canReserve && bookingStep === "classes" ? (
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
                <Card.Title>Kies je les</Card.Title>
                <Card.Description>
                  {isMemberFlow
                    ? `Je boekt als bestaand lid van ${snapshot.tenantName}.`
                    : `Je reserveert direct bij ${snapshot.tenantName}.`}
                </Card.Description>
            </Card.Header>
            <Card.Content className="section-stack">
              {isMemberFlow ? (
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="soft">
                    {snapshot.memberDisplayName}
                  </Chip>
                  <Chip size="sm" variant="tertiary">
                    {snapshot.memberEmail}
                  </Chip>
                </div>
              ) : (
                <p className="text-muted text-sm leading-6">
                  Je vult je gegevens in bij de bevestiging. De club ziet je reservering direct.
                </p>
              )}

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

      {canReserve && bookingStep === "confirm" ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-[28px] border-border/80">
            <Card.Header className="space-y-3">
              <Card.Title>Bevestig je plek</Card.Title>
              <Card.Description>
                {isMemberFlow
                  ? "Je lidgegevens komen uit je bestaande clubprofiel."
                  : "Laat je gegevens achter zodat de club je reservering kan bevestigen."}
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <form className="section-stack" onSubmit={handleSubmit}>
                {isMemberFlow ? (
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
                ) : (
                  <div className="section-stack">
                    <p className="text-muted text-xs font-medium uppercase tracking-[0.08em]">
                      Je gegevens
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="field-stack">
                        <Label>Naam</Label>
                        <Input
                          fullWidth
                          autoComplete="name"
                          value={publicFullName}
                          onChange={(event) => setPublicFullName(event.target.value)}
                        />
                      </div>
                      <div className="field-stack">
                        <Label>E-mail</Label>
                        <Input
                          fullWidth
                          autoComplete="email"
                          inputMode="email"
                          type="email"
                          value={publicEmail}
                          onChange={(event) => setPublicEmail(event.target.value)}
                        />
                      </div>
                    </div>
                    <HeroPhoneNumberField
                      country={publicPhoneCountry}
                      onCountryChange={setPublicPhoneCountry}
                      phone={publicPhone}
                      onPhoneChange={setPublicPhone}
                      phoneLabel="Mobiel nummer"
                    />
                  </div>
                )}

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
                  <Button
                    isDisabled={
                      isPending || !selectedClassSessionId || !publicReservationReady
                    }
                    type="submit"
                  >
                    {isPending ? "Verwerken..." : "Reserveer"}
                  </Button>
                </div>
                {!publicReservationReady ? (
                  <p className="text-muted text-sm">
                    Vul eerst alle velden in voordat je reserveert.
                  </p>
                ) : null}
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
                 {getBookingStatusLabel(lastResult.status)}
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
              href="/login"
              className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium"
            >
              Team login
            </Link>
          </Card.Content>
        </Card>
      ) : null}

      {isMemberFlow && snapshot.hasEligibleMembership && snapshot.tenantSlug && selfService ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="rounded-[28px] border-border/80">
            <Card.Header className="space-y-3">
              <Card.Title>Ledenservice</Card.Title>
              <Card.Description>
                Dien hier zelf een betaalmethode-update of pauzeverzoek in. Je club ziet de
                aanvraag direct in het dashboard.
              </Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-6 md:grid-cols-2">
              <form
                className="section-stack"
                onSubmit={(event) => {
                  event.preventDefault();

                    const contract = primaryContract;

                  if (!contract) {
                    toast.error("Er is nog geen contract gekoppeld aan dit lidprofiel.");
                    return;
                  }

                  void handleMemberSelfServiceSubmit({
                    operation: "request_payment_method_update",
                    body: {
                      memberId: contract.memberId,
                      memberName: snapshot.memberDisplayName,
                      requestedMethodLabel,
                      note: paymentMethodNote || undefined,
                    },
                    successMessage: "Betaalmethode-update is verstuurd naar je club.",
                  });
                }}
              >
                <div className="space-y-1">
                  <p className="text-base font-semibold">Betaalmethode aanpassen</p>
                  <p className="text-muted text-sm leading-6">
                    Bijvoorbeeld een nieuwe SEPA-machtiging of betaalverzoek.
                  </p>
                </div>
                <div className="field-stack">
                  <Label>Nieuwe methode</Label>
                  <Input
                    fullWidth
                    value={requestedMethodLabel}
                    onChange={(event) => setRequestedMethodLabel(event.target.value)}
                  />
                </div>
                <div className="field-stack">
                  <Label>Notitie</Label>
                  <TextArea
                    fullWidth
                    rows={4}
                    value={paymentMethodNote}
                    onChange={(event) => setPaymentMethodNote(event.target.value)}
                  />
                </div>
                 {!paymentMethodRequestReady ? (
                   <p className="text-muted text-sm">
                     Vul eerst alle velden in voordat je het verzoek verstuurt.
                   </p>
                 ) : null}
                 <Button isDisabled={isSelfServicePending || !paymentMethodRequestReady} type="submit">
                   {isSelfServicePending ? "Versturen..." : "Vraag update aan"}
                 </Button>
              </form>

              <form
                className="section-stack"
                onSubmit={(event) => {
                  event.preventDefault();

                    const contract = primaryContract;

                  if (!contract) {
                    toast.error("Er is nog geen contract gekoppeld aan dit lidprofiel.");
                    return;
                  }

                  void handleMemberSelfServiceSubmit({
                    operation: "request_pause",
                    body: {
                      memberId: contract.memberId,
                      memberName: snapshot.memberDisplayName,
                      startsAt: pauseStartsAt,
                      endsAt: pauseEndsAt,
                      reason: pauseReason,
                    },
                    successMessage: "Pauzeverzoek is verstuurd naar je club.",
                  });
                }}
              >
                <div className="space-y-1">
                  <p className="text-base font-semibold">Pauze aanvragen</p>
                  <p className="text-muted text-sm leading-6">
                    Handig voor vakantie, herstel of een geplande stop.
                  </p>
                </div>
                <div className="field-stack">
                  <Label>Start</Label>
                  <Input
                    fullWidth
                    type="date"
                    value={pauseStartsAt}
                    onChange={(event) => setPauseStartsAt(event.target.value)}
                  />
                </div>
                <div className="field-stack">
                  <Label>Einde</Label>
                  <Input
                    fullWidth
                    type="date"
                    value={pauseEndsAt}
                    onChange={(event) => setPauseEndsAt(event.target.value)}
                  />
                </div>
                <div className="field-stack">
                  <Label>Reden</Label>
                  <TextArea
                    fullWidth
                    rows={4}
                    value={pauseReason}
                    onChange={(event) => setPauseReason(event.target.value)}
                  />
                </div>
                 {!pauseRequestReady ? (
                   <p className="text-muted text-sm">
                     Vul eerst alle velden in voordat je het verzoek verstuurt.
                   </p>
                 ) : null}
                 <Button isDisabled={isSelfServicePending || !pauseRequestReady} type="submit" variant="secondary">
                   {isSelfServicePending ? "Versturen..." : "Vraag pauze aan"}
                 </Button>
              </form>
            </Card.Content>
          </Card>

          <Card className="rounded-[28px] border-border/80">
            <Card.Header className="space-y-3">
              <Card.Title>Jouw contracten en betalingen</Card.Title>
              <Card.Description>
                 Bekijk contractdocumenten, recente betalingsbewijzen en de status van open verzoeken.
              </Card.Description>
            </Card.Header>
            <Card.Content className="section-stack">
              <div className="space-y-3">
                <p className="text-sm font-medium">Contracten</p>
                {selfService.contracts.length > 0 ? (
                  selfService.contracts.map((contract) => (
                    <div key={contract.id} className="rounded-2xl border border-border/70 p-4">
                      <p className="font-medium">{contract.contractName}</p>
                      <p className="text-muted text-sm">{contract.documentLabel}</p>
                      <a
                        href={contract.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-sm font-medium text-accent"
                      >
                         Document openen
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-muted text-sm">Nog geen contractdocument beschikbaar.</p>
                )}
              </div>

              <div className="space-y-3">
                 <p className="text-sm font-medium">Betalingsbewijzen</p>
                {selfService.receipts.length > 0 ? (
                  selfService.receipts.map((receipt) => (
                    <div key={receipt.invoiceId} className="rounded-2xl border border-border/70 p-4">
                      <p className="font-medium">{receipt.description}</p>
                      <p className="text-muted text-sm">
                        EUR {(receipt.amountCents / 100).toFixed(2)} · {receipt.paidAt.slice(0, 10)}
                      </p>
                    </div>
                  ))
                ) : (
                   <p className="text-muted text-sm">Nog geen betalingsbewijzen beschikbaar.</p>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Open verzoeken</p>
                {[...selfService.paymentMethodRequests, ...selfService.pauseRequests]
                  .slice(0, 4)
                  .map((request) => (
                    <div key={request.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 p-4">
                      <div className="min-w-0">
                        <p className="font-medium">{request.memberName}</p>
                        <p className="text-muted text-sm">
                          {"requestedMethodLabel" in request
                            ? request.requestedMethodLabel
                            : `${request.startsAt.slice(0, 10)} tot ${request.endsAt.slice(0, 10)}`}
                        </p>
                      </div>
                      <Chip size="sm" variant="soft">
                         {getRequestStatusLabel(request.status)}
                      </Chip>
                    </div>
                  ))}
                {selfService.paymentMethodRequests.length === 0 &&
                selfService.pauseRequests.length === 0 ? (
                   <p className="text-muted text-sm">Er staan nog geen open zelfserviceverzoeken.</p>
                ) : null}
              </div>
            </Card.Content>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
