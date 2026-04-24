import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PublicLandingPage } from "@/components/PublicLandingPage";
import { RuntimeConfigurationState } from "@/components/RuntimeConfigurationState";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const viewer = await resolveViewerFromToken(token);

  if (viewer) {
    redirect(viewer.roleKey === "member" ? "/reserve" : "/dashboard");
  }

  try {
    const services = await getGymPlatformServices();
    const publicSnapshot = await services.getPublicReservationSnapshot();
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
