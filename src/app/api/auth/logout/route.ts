import { createClientRedirectResponse } from "@/server/http/client-redirect";
import { SESSION_COOKIE_NAME } from "@/server/runtime/demo-session";

export async function POST() {
  const response = createClientRedirectResponse("/login");
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
