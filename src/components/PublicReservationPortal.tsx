"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, PhoneNumberField } from "@claimtech/ui";
import { getReservationExperience } from "@/lib/reservation-experience";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";
import type { PublicReservationSnapshot } from "@/server/types";

function fieldClassName() {
  return "brand-input mt-2 h-12 w-full rounded-2xl px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400";
}

function textareaClassName() {
  return "brand-textarea mt-2 min-h-24 w-full rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400";
}

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
  const experience = getReservationExperience(snapshot);
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

  const selectedClass = useMemo(
    () =>
      snapshot.classSessions.find(
        (classSession) => classSession.id === selectedClassSessionId,
      ) ?? snapshot.classSessions[0],
    [selectedClassSessionId, snapshot.classSessions],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="spotlight-shell overflow-hidden">
        <div className="relative space-y-6">
          <div className="flex flex-wrap gap-2">
            {experience.heroBadges.map((badge) => (
              <span key={badge} className="metric-chip">
                {badge}
              </span>
            ))}
          </div>

          <div className="space-y-3">
            <p className="eyebrow">Leden reserveren</p>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-6xl">
              {snapshot.tenantSlug
                ? `Reserveer je volgende les bij ${snapshot.tenantName}`
                : "Kies eerst welke gym je wilt openen"}
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-700 md:text-lg">
              {snapshot.tenantSlug
                ? "Deze flow moet voelen als een high-end studio: helder rooster, directe bevestiging en nul ruis tussen zien en boeken."
                : "Het platform ondersteunt meerdere gyms. Kies eerst de juiste club, daarna openen we het rooster en de reserveringsflow van die sportschool."}
            </p>
          </div>

          {snapshot.availableGyms.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {snapshot.availableGyms.map((gym) => (
                <Link
                  key={gym.id}
                  href={`/reserve?gym=${gym.slug}`}
                  className={`signal-card transition ${
                    snapshot.tenantSlug === gym.slug
                      ? "border-teal-200 bg-teal-50/90"
                      : ""
                  }`}
                >
                  <p className="eyebrow">Gym</p>
                  <p className="mt-3 text-xl font-semibold text-slate-950">{gym.name}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Open deze club als owner, manager, trainer of lidflow.
                  </p>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-[1.35fr_0.8fr_0.8fr]">
            <div className="signal-card md:col-span-2">
              <p className="eyebrow">{experience.rosterSummary.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {experience.rosterSummary.value}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {experience.rosterSummary.helper}
              </p>
            </div>
            {experience.insightCards.map((card) => (
              <div key={card.label} className="signal-card">
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">
                  {card.value}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {card.helper}
                </p>
              </div>
            ))}
          </div>

          {selectedClass ? (
            <div className="stage-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Nu geselecteerd</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {selectedClass.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {formatSessionMoment(selectedClass.startsAt)} ·{" "}
                    {selectedClass.locationName} · coach {selectedClass.trainerName}
                  </p>
                </div>
                <Badge
                  variant={
                    selectedClass.capacity - selectedClass.bookedCount > 0
                      ? "success"
                      : "warning"
                  }
                >
                  {selectedClass.capacity - selectedClass.bookedCount > 0
                    ? `${selectedClass.capacity - selectedClass.bookedCount} plekken vrij`
                    : "Wachtlijst actief"}
                </Badge>
              </div>
            </div>
          ) : null}

          {snapshot.classSessions.length > 0 && snapshot.tenantSlug ? (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="text-sm font-medium text-slate-800">
                Kies een les
                <select
                  className={`${fieldClassName()} brand-select`}
                  value={selectedClassSessionId}
                  onChange={(event) => setSelectedClassSessionId(event.target.value)}
                  required
                >
                  {snapshot.classSessions.map((classSession) => (
                    <option key={classSession.id} value={classSession.id}>
                      {classSession.title} · {formatSessionMoment(classSession.startsAt)} · {classSession.locationName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-800">
                  E-mailadres
                  <input
                    className={fieldClassName()}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="jij@voorbeeld.nl"
                    required
                  />
                </label>

                <PhoneNumberField
                  country={phoneCountry as never}
                  onCountryChange={(value) => setPhoneCountry(value)}
                  phone={phone}
                  onPhoneChange={setPhone}
                  language="nl"
                  countryLabel="Landcode"
                  phoneLabel="Mobiel nummer"
                />
              </div>

              <label className="text-sm font-medium text-slate-800">
                Opmerking voor de club (optioneel)
                <textarea
                  className={textareaClassName()}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Bijvoorbeeld: eerste proefles of ik kom 5 minuten later binnen."
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  size="lg"
                  className="bg-teal-700 hover:bg-teal-800"
                  disabled={isPending || !selectedClassSessionId}
                >
                  {isPending ? "Bezig met reserveren..." : "Reserveer les"}
                </Button>

                <Button asChild variant="outline" size="lg" className="bg-white/90">
                  <Link href="/login">Terug naar teamlogin</Link>
                </Button>
              </div>
            </form>
          ) : (
            <div className="stage-card space-y-4 text-sm leading-6 text-slate-600">
              <div className="space-y-2">
                <p className="eyebrow">Pre-launch member flow</p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {snapshot.tenantSlug
                    ? experience.emptyState?.title ?? "Nieuwe class drops openen hier als eerste."
                    : "Kies een gym om het rooster en de reserveringsflow te openen."}
                </h2>
                <p>
                  {snapshot.tenantSlug
                    ? experience.emptyState?.description ??
                      "Deze member-ervaring staat al klaar in premium vorm."
                    : "Zodra je een gym kiest, tonen we alleen de lessen, coaches en beschikbaarheid van die club."}
                </p>
              </div>

              <div className="grid gap-3">
                {(snapshot.tenantSlug
                  ? experience.emptyState?.highlights ?? []
                  : snapshot.availableGyms.map(
                      (gym) => `${gym.name} · open via /reserve?gym=${gym.slug}`,
                    )
                ).map((highlight) => (
                  <div
                    key={highlight}
                    className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3"
                  >
                    {highlight}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/login" className="cta-primary">
                  Open owner launch
                </Link>
                <Link href="/" className="cta-secondary">
                  Terug naar homepage
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-5">
        <section className="section-shell space-y-4">
          <div className="space-y-2">
            <p className="eyebrow">Beschikbare lessen</p>
            <h2 className="text-2xl font-semibold text-slate-950">
              {experience.hasClasses
                ? "Wat staat er op het rooster?"
                : "Wat leden straks als eerste gaan zien"}
            </h2>
          </div>

          <div className="grid gap-3">
            {snapshot.classSessions.length > 0 ? (
              snapshot.classSessions.map((classSession) => {
              const remainingSpots = Math.max(
                classSession.capacity - classSession.bookedCount,
                0,
              );

              return (
                <div
                  key={classSession.id}
                  className="live-class-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{classSession.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {formatSessionMoment(classSession.startsAt)} · {classSession.locationName}
                      </p>
                    </div>
                    <Badge
                      variant={remainingSpots > 0 ? "success" : "warning"}
                    >
                      {remainingSpots > 0
                        ? `${remainingSpots} plek${remainingSpots === 1 ? "" : "ken"} vrij`
                        : "Wachtlijst actief"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {classSession.focus} · {classSession.level} · coach {classSession.trainerName}
                  </p>
                </div>
              );
              })
            ) : (
              <div className="stage-card text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slate-950">Founder preview</p>
                <p className="mt-2">
                  Zodra je eerste les is ingepland verschijnen hier direct je class
                  cards, plekken vrij, coachinformatie en locatiecontext in dezelfde
                  premium stijl.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="section-shell space-y-4">
          <div className="space-y-2">
            <p className="eyebrow">Waarom dit werkt</p>
            <h2 className="text-2xl font-semibold text-slate-950">
              Consumentvriendelijk zonder vaag te worden
            </h2>
          </div>

          <div className="grid gap-3">
            {experience.promiseCards.map((card) => (
              <div key={card.title} className="signal-card">
                <p className="text-lg font-semibold text-slate-950">{card.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {card.copy}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="section-shell space-y-4">
          <div className="space-y-2">
            <p className="eyebrow">Na je reservering</p>
            <h2 className="text-2xl font-semibold text-slate-950">
              Bevestiging en status
            </h2>
          </div>

          {selectedClass ? (
            <div className="stage-card text-sm leading-6 text-slate-600">
              <p className="font-medium text-slate-900">{selectedClass.title}</p>
              <p className="mt-2">
                Je reservering komt direct in het beheerportaal van de club terecht.
                Balie, operations en eigenaar kunnen hem daar zien en beheren.
              </p>
            </div>
          ) : null}

          {lastResult ? (
            <div className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 text-sm leading-6 text-teal-950 shadow-[0_18px_55px_-40px_rgba(15,118,110,0.65)]">
              <p className="font-medium">
                {lastResult.alreadyExisted
                  ? "Deze reservering bestond al."
                  : `Status: ${lastResult.status}`}
              </p>
              <p className="mt-2 break-words">{lastResult.messagePreview}</p>
              <p className="mt-2 text-xs text-teal-700">
                Booking ID: {lastResult.bookingId}
              </p>
            </div>
          ) : (
            <div className="stage-card text-sm leading-6 text-slate-600">
              {experience.hasClasses
                ? "Na versturen tonen we hier direct of je reservering bevestigd is of op de wachtlijst staat."
                : "Zodra de eerste les live staat, zie je hier direct bevestiging, wachtlijst of herhaalde boeking terug."}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
