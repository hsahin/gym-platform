import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyMutationCsrfToken } from "@/server/http/platform-api";
import {
  bootstrapLocalPlatform,
  hasLocalPlatformSetup,
} from "@/server/persistence/platform-state";
import { createClientRedirectResponse } from "@/server/http/client-redirect";
import {
  SESSION_COOKIE_NAME,
  issueSessionForAccount,
} from "@/server/runtime/demo-session";

const setupSchema = z.object({
  tenantName: z.string().min(2),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  password: z.string().min(8),
});

function createSetupRedirect(request: Request, message?: string) {
  const nextUrl = new URL("/login", request.url);

  if (message) {
    nextUrl.searchParams.set("setupError", message);
  }

  return NextResponse.redirect(nextUrl, 303);
}

export async function POST(request: Request) {
  try {
    if (await hasLocalPlatformSetup()) {
      return createSetupRedirect(
        request,
        "De eerste inrichting is al afgerond. Nieuwe eigenaars maak je aan via beheer.",
      );
    }

    const formData = await request.formData();

    if (!verifyMutationCsrfToken(String(formData.get("csrfToken") ?? ""))) {
      return createSetupRedirect(
        request,
        "De beveiliging is verlopen. Vernieuw de pagina en probeer opnieuw.",
      );
    }

    const payload = setupSchema.parse({
      tenantName: formData.get("tenantName"),
      ownerName: formData.get("ownerName"),
      ownerEmail: formData.get("ownerEmail"),
      password: formData.get("password"),
    });

    const state = await bootstrapLocalPlatform(payload);
    const ownerAccount = state.accounts[0];

    if (!ownerAccount) {
      return createSetupRedirect(request, "De eerste gebruiker kon niet worden aangemaakt.");
    }

    const token = await issueSessionForAccount(ownerAccount, state.tenant.id);
    const response = createClientRedirectResponse("/");

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return createSetupRedirect(
      request,
      "De inrichting kon niet worden opgeslagen. Controleer de velden en probeer opnieuw.",
    );
  }
}
