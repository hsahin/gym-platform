"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  DumbbellIcon,
  GymOsBadge,
  GymOsLogo,
  MapPinIcon,
  UsersIcon,
} from "@/components/GymOsPrimitives";
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

function formatShortTime(startsAt: string) {
  return new Intl.DateTimeFormat("nl-NL", {
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
  }, [snapshot.tenantSlug, snapshot.classSessions]);

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
    <div className="relative z-10">
      <nav className="mb-10 flex items-center justify-between">
        <GymOsLogo />
        <Link href="/login" className="gym-os-button-secondary">
          Team login
        </Link>
      </nav>

      {bookingStep !== "gym" && bookingStep !== "done" ? (
        <button
          type="button"
          onClick={() => {
            if (bookingStep === "classes") {
              setBookingStep("gym");
            }

            if (bookingStep === "confirm") {
              setBookingStep("classes");
            }
          }}
          className="mb-8 flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Terug
        </button>
      ) : null}

      {bookingStep === "gym" ? (
        <section>
          <div className="mb-12 max-w-2xl">
            <GymOsBadge>Boek een les</GymOsBadge>
            <h1 className="mb-4 mt-5 text-4xl font-bold leading-tight text-white md:text-5xl">
              Kies je sportschool
            </h1>
            <p className="text-xl leading-8 text-white/50">
              Dit platform is multi-gym. Elke gym heeft een eigen rooster,
              capaciteit en member flow.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {snapshot.availableGyms.length > 0 ? (
              snapshot.availableGyms.map((gym) => (
                <Link
                  key={gym.id}
                  href={`/reserve?gym=${gym.slug}`}
                  className="glass-card-hover group p-8 text-left"
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 transition-colors group-hover:bg-orange-500/15">
                      <DumbbellIcon className="h-6 w-6 text-orange-400" />
                    </div>
                    <ArrowRightIcon className="h-5 w-5 text-white/20 transition-colors group-hover:text-orange-400" />
                  </div>
                  <h2 className="mb-2 text-xl font-semibold text-white">{gym.name}</h2>
                  <p className="mb-6 text-sm leading-6 text-white/40">
                    Open het live rooster en reserveer direct binnen deze gym.
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm text-white/40">
                    <MapPinIcon className="h-4 w-4" />
                    Eigen tenant en reserveringsflow
                  </span>
                </Link>
              ))
            ) : (
              <div className="glass-card p-8 text-white/45">
                Er is nog geen gym aangemaakt. Meld eerst een gym owner aan.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {bookingStep === "classes" ? (
        <section>
          <div className="mb-12 max-w-3xl">
            <GymOsBadge>{snapshot.tenantName}</GymOsBadge>
            <h1 className="mb-4 mt-5 text-4xl font-bold leading-tight text-white md:text-5xl">
              Kies je les
            </h1>
            <p className="text-xl leading-8 text-white/50">
              Zie direct coach, locatie, focus en beschikbaarheid. Geen account
              nodig: reserveren moet snel voelen.
            </p>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="glass-card p-5">
              <p className="text-sm text-white/40">Lessen</p>
              <p className="mt-2 text-3xl font-bold text-white">{snapshot.classSessions.length}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-sm text-white/40">Plekken totaal</p>
              <p className="mt-2 text-3xl font-bold text-white">{totalCapacity}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-sm text-white/40">Al geboekt</p>
              <p className="mt-2 text-3xl font-bold text-white">{bookedSpots}</p>
            </div>
          </div>

          <div className="space-y-4">
            {snapshot.classSessions.length > 0 ? (
              snapshot.classSessions.map((classSession) => {
                const freeSpots = Math.max(
                  classSession.capacity - classSession.bookedCount,
                  0,
                );

                return (
                  <button
                    key={classSession.id}
                    type="button"
                    onClick={() => {
                      setSelectedClassSessionId(classSession.id);
                      setBookingStep("confirm");
                    }}
                    className="glass-card-hover w-full p-5 text-left"
                  >
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-orange-500/10 text-orange-300">
                          <ClockIcon className="mb-1 h-4 w-4" />
                          <span className="text-xs font-semibold">
                            {formatShortTime(classSession.startsAt)}
                          </span>
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold text-white">
                            {classSession.title}
                          </h2>
                          <p className="mt-1 text-sm leading-6 text-white/45">
                            {formatSessionMoment(classSession.startsAt)} · {classSession.locationName}
                          </p>
                          <p className="mt-2 text-sm text-white/35">
                            Coach {classSession.trainerName} · {classSession.focus} · {classSession.level}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`rounded-full border px-3 py-1.5 text-sm ${
                            freeSpots > 0
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {freeSpots > 0
                            ? `${freeSpots} plek${freeSpots === 1 ? "" : "ken"} vrij`
                            : "Wachtlijst"}
                        </span>
                        <ArrowRightIcon className="h-5 w-5 text-white/20" />
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="glass-card p-8">
                <h2 className="mb-2 text-2xl font-semibold text-white">
                  Nog geen lessen live
                </h2>
                <p className="leading-7 text-white/45">
                  De gym is aangemaakt, maar er staat nog geen rooster klaar.
                  Plan een les vanuit het dashboard zodat leden direct kunnen boeken.
                </p>
                <Link href="/login" className="gym-os-button mt-6">
                  Naar owner login
                </Link>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {bookingStep === "confirm" && selectedClass ? (
        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="glass-card h-fit p-6">
            <GymOsBadge>{snapshot.tenantName}</GymOsBadge>
            <h1 className="mb-4 mt-5 text-3xl font-bold leading-tight text-white">
              Bevestig je plek
            </h1>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="font-semibold text-white">{selectedClass.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  {formatSessionMoment(selectedClass.startsAt)} · {selectedClass.locationName}
                </p>
                <p className="mt-2 text-sm text-white/35">
                  Coach {selectedClass.trainerName} · {selectedClass.durationMinutes} min
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-sm text-white/40">Beschikbaar</p>
                  <p className="mt-2 text-2xl font-bold text-white">{remainingSpots}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-sm text-white/40">Wachtlijst</p>
                  <p className="mt-2 text-2xl font-bold text-white">{selectedClass.waitlistCount}</p>
                </div>
              </div>
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="glass-card p-6 md:p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">Jouw gegevens</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Je reservering wordt direct opgeslagen en is beheerbaar in het
                dashboard van de gym.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium text-white/70 md:col-span-2">
                <span>Naam</span>
                <input
                  className="gym-os-input"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Bijvoorbeeld: Noor Bakker"
                  required
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-white/70">
                <span>E-mailadres</span>
                <input
                  className="gym-os-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="jij@voorbeeld.nl"
                  required
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-white/70">
                <span>Landcode</span>
                <select
                  className="gym-os-select"
                  value={phoneCountry}
                  onChange={(event) => setPhoneCountry(event.target.value)}
                  required
                >
                  <option value="NL">NL +31</option>
                  <option value="BE">BE +32</option>
                  <option value="DE">DE +49</option>
                </select>
              </label>

              <label className="block space-y-2 text-sm font-medium text-white/70 md:col-span-2">
                <span>Mobiel nummer</span>
                <input
                  className="gym-os-input"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="06 12345678"
                  required
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-white/70 md:col-span-2">
                <span>Opmerking voor de club (optioneel)</span>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/30"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Bijvoorbeeld: eerste proefles of ik kom 5 minuten later binnen."
                />
              </label>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="submit"
                className="gym-os-button h-12"
                disabled={isPending || !selectedClassSessionId}
              >
                {isPending ? "Bezig met reserveren..." : "Reserveer les"}
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setBookingStep("classes")}
                className="gym-os-button-secondary h-12"
              >
                Andere les kiezen
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {bookingStep === "done" ? (
        <section className="mx-auto max-w-2xl">
          <div className="glass-card p-8 text-center md:p-12">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckIcon className="h-8 w-8 text-emerald-400" />
            </div>
            <GymOsBadge tone="green">Reservering ontvangen</GymOsBadge>
            <h1 className="mb-4 mt-5 text-4xl font-bold text-white">
              Je plek is geregeld
            </h1>
            <p className="text-lg leading-8 text-white/50">
              {lastResult?.alreadyExisted
                ? "Deze reservering bestond al; we hebben dezelfde booking opnieuw opgehaald."
                : lastResult?.status === "waitlisted"
                  ? "De les is vol, daarom sta je automatisch op de wachtlijst."
                  : "De club ziet je reservering nu direct in het beheerportaal."}
            </p>

            {lastResult ? (
              <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-left">
                <p className="text-sm font-medium text-white">Bevestiging</p>
                <p className="mt-2 break-words text-sm leading-6 text-white/45">
                  {lastResult.messagePreview}
                </p>
                <p className="mt-3 text-xs text-white/25">Booking ID: {lastResult.bookingId}</p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setBookingStep("classes")}
                className="gym-os-button"
              >
                Nog een les boeken
              </button>
              <Link href="/" className="gym-os-button-secondary">
                Terug naar homepage
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Direct bevestigd",
            copy: "Beschikbare plekken worden meteen gecontroleerd en opgeslagen.",
            icon: CheckIcon,
          },
          {
            title: "Realtime capaciteit",
            copy: "Vol is vol: daarna kom je automatisch op de wachtlijst.",
            icon: UsersIcon,
          },
          {
            title: "Beheerbaar voor de gym",
            copy: "Owner, manager en frontdesk zien de booking in hun dashboard.",
            icon: DumbbellIcon,
          },
        ].map((item) => (
          <div key={item.title} className="glass-card p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
              <item.icon className="h-5 w-5 text-orange-400" />
            </div>
            <h2 className="mb-2 font-semibold text-white">{item.title}</h2>
            <p className="text-sm leading-6 text-white/40">{item.copy}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
