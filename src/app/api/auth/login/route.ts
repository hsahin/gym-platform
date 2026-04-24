import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateLocalAccount } from "@/server/persistence/platform-state";
import { createClientRedirectResponse } from "@/server/http/client-redirect";
import {
  SESSION_COOKIE_NAME,
  issueSessionForAuthenticatedAccount,
} from "@/server/runtime/demo-session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function createLoginRedirect(request: Request, message?: string) {
  const nextUrl = new URL("/login", request.url);

  if (message) {
    nextUrl.searchParams.set("error", message);
  }

  return NextResponse.redirect(nextUrl, 303);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payload = loginSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const authenticated = await authenticateLocalAccount(payload.email, payload.password);

    if (!authenticated) {
      return createLoginRedirect(request, "Onjuiste inloggegevens.");
    }

    const token = await issueSessionForAuthenticatedAccount(authenticated);
    const response = createClientRedirectResponse(
      authenticated.accounts.every((account) => account.roleKey === "member")
        ? "/reserve"
        : "/dashboard",
    );

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return createLoginRedirect(request, "Controleer je e-mailadres en wachtwoord.");
  }
}
