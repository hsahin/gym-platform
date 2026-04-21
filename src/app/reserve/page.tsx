import { PublicReservationPortal } from "@/components/PublicReservationPortal";
import { GymOsAmbient } from "@/components/GymOsPrimitives";
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
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-6 py-6 text-white md:py-8">
      <GymOsAmbient />
      <div className="mx-auto w-full max-w-7xl">
        <PublicReservationPortal snapshot={snapshot} />
      </div>
    </main>
  );
}
