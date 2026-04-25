import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@claimtech/core";
import { z } from "zod";
import {
  IDEMPOTENCY_HEADER,
  MUTATION_CSRF_HEADER,
  MUTATION_CSRF_TOKEN,
  getRequestId,
  jsonError,
  jsonOk,
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";

describe("platform api helpers", () => {
  afterEach(() => {
    delete process.env.MONITORING_WEBHOOK_URL;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects mutation requests without security headers", () => {
    const request = new Request("http://localhost/api/platform/bookings", {
      method: "POST",
    });

    expect(() => requireMutationSecurity(request)).toThrowError(
      "CSRF header ontbreekt of is ongeldig.",
    );
  });

  it("rejects mutation requests without idempotency keys", () => {
    const request = new Request("http://localhost/api/platform/bookings", {
      method: "POST",
      headers: {
        [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
      },
    });

    expect(() => requireMutationSecurity(request)).toThrowError(
      "Idempotency key ontbreekt voor deze mutatie.",
    );
  });

  it("accepts valid mutation security headers", () => {
    const request = new Request("http://localhost/api/platform/bookings", {
      method: "POST",
      headers: {
        [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
        [IDEMPOTENCY_HEADER]: " booking-123 ",
      },
    });

    expect(requireMutationSecurity(request)).toEqual({
      idempotencyKey: "booking-123",
    });
  });

  it("rejects cross-origin mutation requests when the origin does not match", () => {
    const request = new Request("http://localhost/api/public/member-signups", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
        [IDEMPOTENCY_HEADER]: "signup-123",
      },
    });

    expect(() =>
      requireMutationSecurity(request, {
        rateLimit: {
          scope: "member-signups",
          maxRequests: 3,
          windowMs: 60_000,
        },
      }),
    ).toThrowError("Deze mutatie mag alleen vanaf dezelfde applicatie-origin worden verstuurd.");
  });

  it("rate limits mutation requests when configured", () => {
    const buildRequest = () =>
      new Request("http://localhost/api/public/member-signups", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "x-forwarded-for": "127.0.0.1",
          [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
          [IDEMPOTENCY_HEADER]: crypto.randomUUID(),
        },
      });

    expect(() =>
      requireMutationSecurity(buildRequest(), {
        rateLimit: {
          scope: "member-signups",
          maxRequests: 1,
          windowMs: 60_000,
        },
      }),
    ).not.toThrow();

    expect(() =>
      requireMutationSecurity(buildRequest(), {
        rateLimit: {
          scope: "member-signups",
          maxRequests: 1,
          windowMs: 60_000,
        },
      }),
    ).toThrowError("Te veel mutaties in korte tijd. Probeer het zo opnieuw.");
  });

  it("accepts same-origin mutation requests that only send a referer header", () => {
    const request = new Request("http://localhost/api/public/member-signups", {
      method: "POST",
      headers: {
        referer: "http://localhost/join?gym=northside-athletics",
        [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
        [IDEMPOTENCY_HEADER]: "signup-referer-123",
      },
    });

    expect(() => requireMutationSecurity(request)).not.toThrow();
  });

  it("ignores malformed referer values instead of blocking the mutation outright", () => {
    const request = new Request("http://localhost/api/public/member-signups", {
      method: "POST",
      headers: {
        referer: "not a valid url",
        [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
        [IDEMPOTENCY_HEADER]: "signup-malformed-referer",
      },
    });

    expect(() => requireMutationSecurity(request)).not.toThrow();
  });

  it("uses cf-connecting-ip as the primary mutation rate limit identifier", () => {
    const buildRequest = () =>
      new Request("http://localhost/api/public/member-signups", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "cf-connecting-ip": "203.0.113.9",
          [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
          [IDEMPOTENCY_HEADER]: crypto.randomUUID(),
        },
      });

    expect(() =>
      requireMutationSecurity(buildRequest(), {
        rateLimit: {
          scope: "member-signups-cf",
          maxRequests: 1,
          windowMs: 60_000,
        },
      }),
    ).not.toThrow();
    expect(() =>
      requireMutationSecurity(buildRequest(), {
        rateLimit: {
          scope: "member-signups-cf",
          maxRequests: 1,
          windowMs: 60_000,
        },
      }),
    ).toThrowError("Te veel mutaties in korte tijd. Probeer het zo opnieuw.");
  });

  it("falls back to the request host when no client ip headers are present", () => {
    const buildRequest = () =>
      new Request("http://localhost/api/public/member-signups", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          [MUTATION_CSRF_HEADER]: MUTATION_CSRF_TOKEN,
          [IDEMPOTENCY_HEADER]: crypto.randomUUID(),
        },
      });

    expect(() =>
      requireMutationSecurity(buildRequest(), {
        rateLimit: {
          scope: "member-signups-host",
          maxRequests: 1,
          windowMs: 60_000,
        },
      }),
    ).not.toThrow();
    expect(() =>
      requireMutationSecurity(buildRequest(), {
        rateLimit: {
          scope: "member-signups-host",
          maxRequests: 1,
          windowMs: 60_000,
        },
      }),
    ).toThrowError("Te veel mutaties in korte tijd. Probeer het zo opnieuw.");
  });

  it("uses request ids from headers or generates a fallback id", () => {
    expect(
      getRequestId(
        new Request("http://localhost/api/platform/overview", {
          headers: { "x-request-id": " request-123 " },
        }),
      ),
    ).toBe("request-123");
    expect(getRequestId(new Request("http://localhost/api/platform/overview"))).toMatch(
      /^req_/,
    );
  });

  it("wraps handler data in the expected api envelope", async () => {
    const request = new Request("http://localhost/api/platform/overview", {
      headers: { "x-request-id": "request-123" },
    });
    const response = await runApiHandler(request, async () => ({
      ready: true,
    }), { successStatus: 201 });
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      data: {
        ready: boolean;
      };
    };

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.ok).toBe(true);
    expect(payload.requestId).toBe("request-123");
    expect(payload.data.ready).toBe(true);
  });

  it("supports direct success envelopes with custom headers", async () => {
    const response = jsonOk("request-456", { saved: true }, {
      status: 202,
      headers: { "x-extra": "yes" },
    });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-extra")).toBe("yes");
    expect(payload).toMatchObject({
      ok: true,
      requestId: "request-456",
      data: { saved: true },
    });

    expect(jsonOk("request-default", { saved: true }).status).toBe(200);
  });

  it("uses 200 as the default handler success status", async () => {
    const response = await runApiHandler(
      new Request("http://localhost/api/platform/overview", {
        headers: { "x-request-id": "request-default-status" },
      }),
      async () => ({ ready: true }),
    );

    expect(response.status).toBe(200);
  });

  it("normalizes known, validation and unexpected errors", async () => {
    const forbidden = jsonError(
      "request-forbidden",
      new AppError("Geen toegang.", { code: "FORBIDDEN", details: { role: "trainer" } }),
    );
    const parsed = z.object({ email: z.string().email() }).safeParse({
      email: "geen-mail",
    });
    if (parsed.success) {
      throw new Error("Expected invalid email test payload to fail validation.");
    }
    const validation = jsonError("request-validation", parsed.error);
    const notFoundLike = jsonError("request-like", {
      code: "RESOURCE_NOT_FOUND",
      message: "Niet gevonden.",
      details: { id: "missing" },
    });
    const unexpected = jsonError("request-unexpected", new Error("Boom"));

    await expect(forbidden.json()).resolves.toMatchObject({
      ok: false,
      requestId: "request-forbidden",
      error: { code: "FORBIDDEN", message: "Geen toegang.", details: { role: "trainer" } },
    });
    expect(forbidden.status).toBe(403);
    expect(validation.status).toBe(400);
    await expect(validation.json()).resolves.toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    expect(notFoundLike.status).toBe(404);
    await expect(notFoundLike.json()).resolves.toMatchObject({
      error: { code: "RESOURCE_NOT_FOUND", message: "Niet gevonden." },
    });
    expect(unexpected.status).toBe(500);
    await expect(unexpected.json()).resolves.toMatchObject({
      error: { code: "UNEXPECTED_ERROR" },
    });
  });

  it("maps all operational app error codes to stable HTTP status codes", () => {
    const expectations = [
      ["AUTH_REQUIRED", 401],
      ["CSRF_TOKEN_MISSING", 400],
      ["IDEMPOTENCY_KEY_MISSING", 400],
      ["VERSION_CONFLICT", 409],
      ["RATE_LIMIT_EXCEEDED", 429],
      ["UNKNOWN_CODE", 500],
    ] as const;

    for (const [code, status] of expectations) {
      expect(jsonError(`request-${code}`, new AppError(code, { code })).status).toBe(
        status,
      );
    }
  });

  it("catches handler errors and returns an error envelope", async () => {
    const response = await runApiHandler(
      new Request("http://localhost/api/platform/overview", {
        headers: { "x-request-id": "request-error" },
      }),
      async () => {
        throw new AppError("Niet gevonden.", { code: "RESOURCE_NOT_FOUND" });
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      requestId: "request-error",
      error: { code: "RESOURCE_NOT_FOUND" },
    });
  });

  it("reports handler errors to the monitoring webhook when configured", async () => {
    process.env.MONITORING_WEBHOOK_URL = "https://monitoring.example.test/errors";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"));

    const response = await runApiHandler(
      new Request("http://localhost/api/platform/overview", {
        headers: { "x-request-id": "request-monitored-error" },
      }),
      async () => {
        throw new Error("Webhook me");
      },
    );

    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://monitoring.example.test/errors",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("reports non-Error throwables without losing their details", async () => {
    process.env.MONITORING_WEBHOOK_URL = "https://monitoring.example.test/errors";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"));

    await runApiHandler(
      new Request("http://localhost/api/platform/overview", {
        headers: { "x-request-id": "request-object-error" },
      }),
      async () => {
        throw { code: "CUSTOM", message: "Object failure" };
      },
    );

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      error: { code: "CUSTOM", message: "Object failure" },
    });
  });

  it("keeps api responses stable when monitoring reporting fails", async () => {
    process.env.MONITORING_WEBHOOK_URL = "https://monitoring.example.test/errors";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await runApiHandler(
      new Request("http://localhost/api/platform/overview", {
        headers: { "x-request-id": "request-report-failed" },
      }),
      async () => {
        throw new AppError("Geen toegang.", { code: "FORBIDDEN" });
      },
    );

    expect(response.status).toBe(403);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to report API error",
      expect.objectContaining({ requestId: "request-report-failed" }),
    );
  });

  it("logs api errors locally when no monitoring webhook is configured outside tests", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await runApiHandler(
      new Request("http://localhost/api/platform/overview", {
        method: "PATCH",
        headers: { "x-request-id": "request-local-log" },
      }),
      async () => {
        throw new AppError("Conflict.", { code: "VERSION_CONFLICT" });
      },
    );

    expect(response.status).toBe(409);
    expect(console.error).toHaveBeenCalledWith(
      "API error",
      expect.objectContaining({
        requestId: "request-local-log",
        method: "PATCH",
      }),
    );
  });
});
