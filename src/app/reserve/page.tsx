import { PublicReservationPortal } from "@/components/PublicReservationPortal";
import { RuntimeConfigurationState } from "@/components/RuntimeConfigurationState";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

export const dynamic = "force-dynamic";

export default async function ReservePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const gym =
    typeof resolvedSearchParams?.gym === "string"
      ? resolvedSearchParams.gym
      : Array.isArray(resolvedSearchParams?.gym)
        ? resolvedSearchParams?.gym[0]
        : undefined;

  try {
    const services = await getGymPlatformServices();
    const snapshot = await services.getPublicReservationSnapshot({
      tenantSlug: gym,
    });

    return (
      <main className="min-h-screen bg-transparent">
        <div className="app-page">
          <PublicReservationPortal snapshot={snapshot} />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <RuntimeConfigurationState
        detail={
          error instanceof Error
            ? error.message
            : "De reserveringsomgeving kon de live configuratie niet laden."
        }
      />
    );
  }
}
