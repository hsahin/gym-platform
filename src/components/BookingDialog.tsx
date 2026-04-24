"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Button, Card, Chip, Label, TextArea } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react/native-select";
import { toast } from "sonner";
import { HeroPhoneNumberField } from "@/components/HeroPhoneNumberField";
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

  const selectedMember = useMemo(
    () => members.find((member) => member.id === memberId) ?? members[0],
    [memberId, members],
  );

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
        isDisabled={!canCreateBooking}
        variant="outline"
        onPress={() => setOpen(true)}
      >
        Nieuwe booking
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <div
                ref={scrollContainerRef}
                className="flex min-h-[100dvh] items-center justify-center overflow-y-auto p-4"
              >
                <Card
                  className="w-full max-w-2xl rounded-3xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Card.Header className="items-start justify-between gap-4">
                    <div className="space-y-2">
                      <Card.Title>Nieuwe booking</Card.Title>
                      <Card.Description>
                        Kies lid, les en contactgegevens. De reserveringsflow verwerkt de rest.
                      </Card.Description>
                    </div>
                    <Button size="sm" variant="ghost" onPress={() => setOpen(false)}>
                      Sluit
                    </Button>
                  </Card.Header>

                  <Card.Content>
                    <form className="section-stack" onSubmit={handleSubmit}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="field-stack">
                          <Label>Lid</Label>
                          <NativeSelect fullWidth>
                            <NativeSelect.Trigger
                              name="memberId"
                              value={memberId}
                              onChange={(event) => setMemberId(event.target.value)}
                            >
                              {members.map((member) => (
                                <NativeSelect.Option key={member.id} value={member.id}>
                                  {member.fullName}
                                </NativeSelect.Option>
                              ))}
                              <NativeSelect.Indicator />
                            </NativeSelect.Trigger>
                          </NativeSelect>
                        </div>

                        <div className="field-stack">
                          <Label>Les</Label>
                          <NativeSelect fullWidth>
                            <NativeSelect.Trigger
                              name="classSessionId"
                              value={classSessionId}
                              onChange={(event) => setClassSessionId(event.target.value)}
                            >
                              {classSessions.map((classSession) => (
                                <NativeSelect.Option
                                  key={classSession.id}
                                  value={classSession.id}
                                >
                                  {classSession.title}
                                </NativeSelect.Option>
                              ))}
                              <NativeSelect.Indicator />
                            </NativeSelect.Trigger>
                          </NativeSelect>
                        </div>
                      </div>

                      <HeroPhoneNumberField
                        country={phoneCountry}
                        onCountryChange={(value) =>
                          setPhoneCountry(value as typeof phoneCountry)
                        }
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

                      {selectedMember ? (
                        <div className="flex flex-wrap gap-2">
                          <Chip size="sm" variant="soft">
                            {selectedMember.status}
                          </Chip>
                          <Chip size="sm" variant="tertiary">
                            {selectedMember.email}
                          </Chip>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap justify-end gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          onPress={() => setOpen(false)}
                        >
                          Annuleer
                        </Button>
                        <Button type="submit" isDisabled={isPending}>
                          {isPending ? "Opslaan..." : "Boeking opslaan"}
                        </Button>
                      </div>
                    </form>
                  </Card.Content>
                </Card>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
