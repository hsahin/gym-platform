import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MUTATION_SECURITY_ERROR_MESSAGE,
  MUTATION_CSRF_HEADER,
  MUTATION_CSRF_TOKEN,
} from "@/server/http/platform-api";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";

describe("dashboard client mutation helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends dashboard mutations with same-origin credentials and mutation security headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        data: { id: "loc_123" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitDashboardMutation("/api/platform/locations", {
        name: "Downtown Club",
      }),
    ).resolves.toEqual({ id: "loc_123" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/platform/locations",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      "content-type": "application/json",
      [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
    });
    expect((init as RequestInit).headers).toHaveProperty("x-idempotency-key");
  });

  it("shows a friendly message for security failures instead of technical origin text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Deze mutatie mag alleen vanaf dezelfde applicatie-origin worden verstuurd.",
          },
        },
        { status: 403 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitDashboardMutation("/api/platform/locations", {
        name: "Downtown Club",
      }),
    ).rejects.toThrow(MUTATION_SECURITY_ERROR_MESSAGE);
  });

  it("shows a friendly fallback when the server returns a non-json error page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html>Something failed</html>", {
        status: 500,
        headers: {
          "content-type": "text/html",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitDashboardMutation("/api/platform/locations", {
        name: "Downtown Club",
      }),
    ).rejects.toThrow("Opslaan is niet gelukt. Controleer je invoer en probeer het opnieuw.");
  });
});
