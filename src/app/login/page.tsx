import { cookies } from "next/headers";
import { LoginPageView } from "@/components/LoginPageView";
import { RuntimeConfigurationState } from "@/components/RuntimeConfigurationState";
import {
  hasLocalPlatformSetup,
} from "@/server/persistence/platform-state";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";

function readSearchParam(
  value: string | ReadonlyArray<string> | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const viewer = await resolveViewerFromToken(token);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const loginError = readSearchParam(resolvedSearchParams?.error);
  const setupError = readSearchParam(resolvedSearchParams?.setupError);

  try {
    const isSetupComplete = await hasLocalPlatformSetup();
    const mode =
      !isSetupComplete || readSearchParam(resolvedSearchParams?.mode) === "signup"
        ? "signup"
        : "login";

    return (
      <LoginPageView
        isSetupComplete={isSetupComplete}
        loginError={loginError}
        mode={mode}
        roleLabel={viewer?.roleLabel}
        setupError={setupError}
      />
    );
  } catch (error) {
    return (
      <RuntimeConfigurationState
        detail={
          error instanceof Error
            ? error.message
            : "De loginomgeving kon de live configuratie niet laden."
        }
      />
    );
  }
}
