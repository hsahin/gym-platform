import { NextResponse, type NextRequest } from "next/server";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

function buildDashboardRedirect(request: NextRequest, status: string, detail?: string) {
  const url = new URL("/dashboard/payments", request.url);
  url.searchParams.set("mollie", status);

  if (detail) {
    url.searchParams.set("message", detail);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      return buildDashboardRedirect(
        request,
        "error",
        errorDescription || error,
      );
    }

    const state = url.searchParams.get("state")?.trim();
    const code = url.searchParams.get("code")?.trim();

    if (!state || !code) {
      return buildDashboardRedirect(request, "error", "Mollie redirect mist code of state.");
    }

    const services = await getGymPlatformServices();
    await services.completeMollieConnectCallback({ state, code });

    return buildDashboardRedirect(request, "connected");
  } catch (error) {
    return buildDashboardRedirect(
      request,
      "error",
      error instanceof Error ? error.message : "Mollie Connect afronden mislukt.",
    );
  }
}
