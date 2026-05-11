import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/HeroCompat";
import { getEntityStatusLabel } from "@/lib/ui-labels";
import type { GymLocation } from "@/server/types";

export function LocationView({ location }: { location: GymLocation }) {
  const visibleAmenities = location.amenities.slice(0, 3);
  const hiddenAmenities = Math.max(
    location.amenities.length - visibleAmenities.length,
    0,
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Vestiging</p>
            <CardTitle className="text-lg">{location.name}</CardTitle>
          </div>
          <Badge variant="outline">{getEntityStatusLabel(location.status)}</Badge>
        </div>
        <p className="text-muted text-sm">
          {location.neighborhood}, {location.city}
        </p>
      </CardHeader>
      <CardContent className="text-muted space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="soft-card">
            <p className="eyebrow">Capaciteit</p>
            <p className="text-foreground text-base font-semibold tabular-nums">
              {location.capacity}
            </p>
          </div>
          <div className="soft-card">
            <p className="eyebrow">Manager</p>
            <p className="text-foreground text-base font-semibold">
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
