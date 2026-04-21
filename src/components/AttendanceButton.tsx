"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@claimtech/ui";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";

export function AttendanceButton({
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
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            const response = await fetch(
              `/api/platform/bookings/${bookingId}/attendance`,
              {
                method: "PATCH",
                headers: {
                  "content-type": "application/json",
                  "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
                  "x-idempotency-key": crypto.randomUUID(),
                },
                body: JSON.stringify({
                  expectedVersion,
                  channel: "frontdesk",
                }),
              },
            );

            const payload = (await response.json()) as {
              ok: boolean;
              error?: {
                message: string;
              };
            };

            if (!response.ok || !payload.ok) {
              throw new Error(payload.error?.message ?? "Check-in is mislukt.");
            }

            toast.success("Check-in geregistreerd.");
            router.refresh();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Check-in is mislukt.",
            );
          }
        })
      }
    >
      {isPending ? "Bezig..." : "Check-in"}
    </Button>
  );
}
