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
    <Card className="overflow-hidden border-white/70 bg-white/90 shadow-[0_22px_80px_-58px_rgba(16,24,38,0.5)]">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Lesoverzicht</p>
            <CardTitle className="text-lg">{classSession.title}</CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              {formatSlot(classSession.startsAt)} - {locationName ?? "Vestiging"}
            </p>
          </div>
          <Badge variant={occupancy > 90 ? "warning" : "info"}>
            {occupancy}% vol
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-600">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="soft-card p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Coach
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {trainerName ?? "Nog geen coach"}
            </p>
          </div>
          <div className="soft-card p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Focus
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {classSession.focus}
            </p>
          </div>
          <div className="soft-card p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Niveau
            </p>
            <p className="mt-1 text-base font-semibold capitalize text-slate-900">
              {getClassLevelLabel(classSession.level)}
            </p>
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-600">
          {classSession.bookedCount}/{classSession.capacity} geboekt ·{" "}
          {classSession.waitlistCount} op de wachtlijst ·{" "}
          {classSession.durationMinutes} minuten
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-400"
            style={{ width: `${Math.min(occupancy, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
