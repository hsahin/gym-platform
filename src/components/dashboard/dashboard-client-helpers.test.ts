import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MUTATION_SECURITY_ERROR_MESSAGE,
  MUTATION_CSRF_HEADER,
} from "@/lib/mutation-security-constants";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import {
  buildMutationHeaders,
  resetMutationSecurityClientForTests,
} from "@/lib/mutation-security-client";

describe("dashboard client mutation helpers", () => {
  afterEach(() => {
    resetMutationSecurityClientForTests();
    vi.unstubAllGlobals();
  });

  it("sends dashboard mutations with same-origin credentials and mutation security headers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          data: {
            csrfToken: "signed-csrf-token",
            expiresInSeconds: 0,
          },
        }),
      )
      .mockResolvedValueOnce(
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

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/security/csrf",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/platform/locations",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
    const [, init] = fetchMock.mock.calls[1]!;
    expect((init as RequestInit).headers).toMatchObject({
      "content-type": "application/json",
      [MUTATION_CSRF_HEADER]: "signed-csrf-token",
    });
    expect((init as RequestInit).headers).toHaveProperty("x-idempotency-key");
  });

  it("shows a friendly message for security failures instead of technical origin text", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          data: {
            csrfToken: "signed-csrf-token",
            expiresInSeconds: 0,
          },
        }),
      )
      .mockResolvedValueOnce(
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          data: {
            csrfToken: "signed-csrf-token",
            expiresInSeconds: 0,
          },
        }),
      )
      .mockResolvedValueOnce(
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

  it("reuses a fresh browser mutation token and reports token bootstrap failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        data: {
          csrfToken: "cached-csrf-token",
          expiresInSeconds: 120,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(buildMutationHeaders()).resolves.toMatchObject({
      [MUTATION_CSRF_HEADER]: "cached-csrf-token",
    });
    await expect(buildMutationHeaders()).resolves.toMatchObject({
      [MUTATION_CSRF_HEADER]: "cached-csrf-token",
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    resetMutationSecurityClientForTests();
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ok: false }, { status: 500 })),
    );
    await expect(buildMutationHeaders()).rejects.toThrow(
      "Beveiliging kon niet worden voorbereid",
    );
  });
});
