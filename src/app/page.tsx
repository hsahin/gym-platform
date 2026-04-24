import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { PublicLandingPage } from "@/components/PublicLandingPage";
import { RuntimeConfigurationState } from "@/components/RuntimeConfigurationState";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const getCachedPublicReservationSnapshot = unstable_cache(
  async () => {
    const services = await getGymPlatformServices();
    return services.getPublicReservationSnapshot();
  },
  ["public-reservation-snapshot"],
  { revalidate: 60 },
);

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const viewer = await resolveViewerFromToken(token);

  if (viewer) {
    redirect(viewer.roleKey === "member" ? "/reserve" : "/dashboard");
  }

  try {
    const publicSnapshot = await getCachedPublicReservationSnapshot();
    return <PublicLandingPage snapshot={publicSnapshot} />;
  } catch (error) {
    return (
      <RuntimeConfigurationState
        detail={
          error instanceof Error
            ? error.message
            : "De runtime kon de live configuratie niet laden."
        }
      />
    );
  }
}
