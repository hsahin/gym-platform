"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Badge,
  Button,
  PhoneNumberField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@claimtech/ui";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";
import type { ClassSession, GymMember } from "@/server/types";

interface BookingDialogProps {
  readonly members: ReadonlyArray<GymMember>;
  readonly classSessions: ReadonlyArray<ClassSession>;
}

export function BookingDialog({
  members,
  classSessions,
}: BookingDialogProps) {
  const canCreateBooking = members.length > 0 && classSessions.length > 0;
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [classSessionId, setClassSessionId] = useState(classSessions[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState(members[0]?.phone ?? "");
  const [phoneCountry, setPhoneCountry] = useState(members[0]?.phoneCountry ?? "NL");

  const selectedMember =
    members.find((member) => member.id === memberId) ?? members[0];

  useEffect(() => {
    if (members.length === 0) {
      setMemberId("");
      return;
    }

    if (!members.some((member) => member.id === memberId)) {
      setMemberId(members[0]!.id);
    }
  }, [memberId, members]);

  useEffect(() => {
    if (classSessions.length === 0) {
      setClassSessionId("");
      return;
    }

    if (!classSessions.some((classSession) => classSession.id === classSessionId)) {
      setClassSessionId(classSessions[0]!.id);
    }
  }, [classSessionId, classSessions]);

  useEffect(() => {
    if (!selectedMember) {
      return;
    }

    setPhone(selectedMember.phone);
    setPhoneCountry(selectedMember.phoneCountry);
  }, [selectedMember]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: 0 });
    });

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreateBooking) {
      toast.error("Voeg eerst minstens één lid en één les toe.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/platform/bookings", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
            "x-idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            memberId,
            classSessionId,
            phone,
            phoneCountry,
            notes: notes || undefined,
            source: "frontdesk",
          }),
        });

        const payload = (await response.json()) as {
          ok: boolean;
          data?: {
            alreadyExisted: boolean;
            booking: {
              id: string;
              status: string;
            };
          };
          error?: {
            message: string;
          };
        };

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error?.message ?? "Boeking kon niet worden aangemaakt.");
        }

        toast.success(
          payload.data.alreadyExisted
            ? "Deze booking bestond al en is hergebruikt."
            : `Boeking opgeslagen als ${payload.data.booking.status}.`,
        );

        setOpen(false);
        setNotes("");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Onbekende fout tijdens boeken.",
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        className="bg-teal-700 hover:bg-teal-800"
        disabled={!canCreateBooking}
        onClick={() => setOpen(true)}
      >
        Nieuwe booking
      </Button>
      {!canCreateBooking ? (
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Voeg eerst een lid en een les toe om boekingen te kunnen aanmaken.
        </p>
      ) : null}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <div
                ref={scrollContainerRef}
                className="flex min-h-[100dvh] items-center justify-center overflow-y-auto p-4"
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="booking-dialog-title"
                  className="w-full max-w-xl rounded-[28px] border border-white/70 bg-white shadow-glow"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <h2
                          id="booking-dialog-title"
                          className="text-xl font-semibold text-slate-950"
                        >
                          Nieuwe booking
                        </h2>
                        <p className="text-sm leading-6 text-slate-600">
                          Kies alleen lid, les en contactgegevens. De rest wordt op
                          de achtergrond veilig afgehandeld.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
                        onClick={() => setOpen(false)}
                      >
                        Sluit
                      </button>
                    </div>

                    <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-800">
                            Lid
                          </p>
                          <Select value={memberId} onValueChange={setMemberId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecteer lid" />
                            </SelectTrigger>
                            <SelectContent>
                              {members.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.fullName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-800">
                            Les
                          </p>
                          <Select
                            value={classSessionId}
                            onValueChange={setClassSessionId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecteer les" />
                            </SelectTrigger>
                            <SelectContent>
                              {classSessions.map((classSession) => (
                                <SelectItem
                                  key={classSession.id}
                                  value={classSession.id}
                                >
                                  {classSession.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <PhoneNumberField
                          country={phoneCountry as never}
                          onCountryChange={(value) => setPhoneCountry(value)}
                          phone={phone}
                          onPhoneChange={setPhone}
                          language="nl"
                          countryLabel="Landcode"
                          phoneLabel="Mobiel nummer"
                        />

                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-800">
                            Notitie (optioneel)
                          </p>
                          <Textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Bijvoorbeeld: eerste proefles, liever een rack aan het raam."
                          />
                        </div>
                      </div>

                      {selectedMember ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-950/[0.03] p-4 text-sm text-slate-600">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">
                              {selectedMember.fullName}
                            </span>
                            <Badge
                              variant={
                                selectedMember.waiverStatus === "complete"
                                  ? "success"
                                  : "warning"
                              }
                            >
                              waiver {selectedMember.waiverStatus}
                            </Badge>
                          </div>
                          <p className="mt-2">
                            De booking-API stuurt een previewbericht terug en
                            bewaart de mutatie idempotent.
                          </p>
                        </div>
                      ) : null}

                      <div className="-mx-5 sticky bottom-0 mt-6 border-t border-slate-200 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-4 backdrop-blur sm:-mx-6 sm:px-6">
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setOpen(false)}
                        >
                          Annuleren
                        </Button>
                        <Button
                          type="submit"
                          disabled={isPending || !memberId || !classSessionId}
                        >
                          {isPending ? "Opslaan..." : "Boeking opslaan"}
                        </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
