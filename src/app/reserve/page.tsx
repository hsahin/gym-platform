import { PublicReservationPortal } from "@/components/PublicReservationPortal";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

export const dynamic = "force-dynamic";

export default async function ReservePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const services = await getGymPlatformServices();
  const gym =
    typeof searchParams?.gym === "string"
      ? searchParams.gym
      : Array.isArray(searchParams?.gym)
        ? searchParams?.gym[0]
        : undefined;
  const snapshot = await services.getPublicReservationSnapshot({
    tenantSlug: gym,
  });

  return (
    <main className="relative overflow-hidden px-4 py-8 md:px-8 md:py-10">
      <div className="halo-orb halo-orb-left" aria-hidden="true" />
      <div className="halo-orb halo-orb-right" aria-hidden="true" />
      <div className="mx-auto w-full max-w-7xl">
        <PublicReservationPortal snapshot={snapshot} />
      </div>
    </main>
  );
}
