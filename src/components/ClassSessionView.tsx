import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/HeroCompat";
import { getClassLevelLabel } from "@/lib/ui-labels";
import type { ClassSession } from "@/server/types";

function formatSlot(startsAt: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(startsAt));
}

export function ClassSessionView({
  classSession,
  trainerName,
  locationName,
}: {
  classSession: ClassSession;
  trainerName?: string;
  locationName?: string;
}) {
  const occupancy = Math.round(
    (classSession.bookedCount / classSession.capacity) * 100,
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Lesoverzicht</p>
            <CardTitle className="text-lg">{classSession.title}</CardTitle>
            <p className="text-muted mt-1 text-sm">
              {formatSlot(classSession.startsAt)} · {locationName ?? "Vestiging"}
            </p>
          </div>
          <Badge variant={occupancy > 90 ? "warning" : "info"}>
            {occupancy}% vol
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-muted space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="soft-card">
            <p className="eyebrow">Coach</p>
            <p className="text-foreground text-base font-semibold">
              {trainerName ?? "Nog geen coach"}
            </p>
          </div>
          <div className="soft-card">
            <p className="eyebrow">Focus</p>
            <p className="text-foreground text-base font-semibold">
              {classSession.focus}
            </p>
          </div>
          <div className="soft-card">
            <p className="eyebrow">Niveau</p>
            <p className="text-foreground text-base font-semibold capitalize">
              {getClassLevelLabel(classSession.level)}
            </p>
          </div>
        </div>

        <p className="text-sm leading-6">
          {classSession.bookedCount}/{classSession.capacity} geboekt ·{" "}
          {classSession.waitlistCount} op de wachtlijst ·{" "}
          {classSession.durationMinutes} minuten
        </p>
        <div className="bg-surface-secondary h-2 overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-[width]"
            style={{ width: `${Math.min(occupancy, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
