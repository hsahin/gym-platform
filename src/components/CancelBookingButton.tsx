"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { toast } from "sonner";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";

export function CancelBookingButton({
  bookingId,
  expectedVersion,
}: {
  bookingId: string;
  expectedVersion: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      isDisabled={isPending}
      onPress={() =>
        startTransition(async () => {
          try {
            const response = await fetch(
              `/api/platform/bookings/${bookingId}/cancel`,
              {
                method: "PATCH",
                headers: {
                  "content-type": "application/json",
                  "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
                  "x-idempotency-key": crypto.randomUUID(),
                },
                body: JSON.stringify({
                  expectedVersion,
                }),
              },
            );

            const payload = (await response.json()) as {
              ok: boolean;
              data?: {
                promotedBooking?: {
                  memberName: string;
                };
              };
              error?: {
                message: string;
              };
            };

            if (!response.ok || !payload.ok) {
              throw new Error(payload.error?.message ?? "Annuleren is mislukt.");
            }

            toast.success(
              payload.data?.promotedBooking
                ? `Reservering geannuleerd. ${payload.data.promotedBooking.memberName} is automatisch bevestigd vanaf de wachtlijst.`
                : "Reservering geannuleerd.",
            );
            router.refresh();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Annuleren is mislukt.",
            );
          }
        })
      }
    >
      {isPending ? "Bezig..." : "Annuleren"}
    </Button>
  );
}
