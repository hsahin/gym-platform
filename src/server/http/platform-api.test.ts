import { describe, expect, it } from "vitest";
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
});
