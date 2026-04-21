import { AppError } from "@claimtech/core";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";

export async function requireViewerFromRequest(request: NextRequest) {
  const viewer = await resolveViewerFromToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (!viewer) {
    throw new AppError("Log eerst in om dit platform te openen.", {
      code: "AUTH_REQUIRED",
    });
  }

  return viewer;
}
