import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PublicLandingPage } from "@/components/PublicLandingPage";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

export default async function Home() {
  const services = await getGymPlatformServices();
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const viewer = await resolveViewerFromToken(token);

  if (viewer) {
    redirect("/dashboard");
  }

  const publicSnapshot = await services.getPublicReservationSnapshot();
  return <PublicLandingPage snapshot={publicSnapshot} />;
}
