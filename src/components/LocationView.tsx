import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/HeroCompat";
import type { GymLocation } from "@/server/types";

export function LocationView({ location }: { location: GymLocation }) {
  const visibleAmenities = location.amenities.slice(0, 3);
  const hiddenAmenities = Math.max(
    location.amenities.length - visibleAmenities.length,
    0,
  );

  return (
    <Card className="overflow-hidden border-white/70 bg-white/90 shadow-[0_22px_80px_-58px_rgba(16,24,38,0.5)]">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Club location</p>
            <CardTitle className="text-lg">{location.name}</CardTitle>
          </div>
          <Badge variant="outline">{location.status}</Badge>
        </div>
        <p className="text-sm text-slate-600">
          {location.neighborhood}, {location.city}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-600">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="soft-card p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Capaciteit
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {location.capacity}
            </p>
          </div>
          <div className="soft-card p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Manager
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {location.managerName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {visibleAmenities.map((amenity) => (
            <Badge key={amenity} variant="secondary">
              {amenity}
            </Badge>
          ))}
          {hiddenAmenities > 0 ? (
            <Badge variant="secondary">+{hiddenAmenities} extra</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
