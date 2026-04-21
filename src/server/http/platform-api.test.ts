import { describe, expect, it } from "vitest";
import {
  MUTATION_CSRF_TOKEN,
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

  it("accepts valid mutation security headers", () => {
    const request = new Request("http://localhost/api/platform/bookings", {
      method: "POST",
      headers: {
        "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
        "x-idempotency-key": "booking-123",
      },
    });

    expect(requireMutationSecurity(request)).toEqual({
      idempotencyKey: "booking-123",
    });
  });

  it("wraps handler data in the expected api envelope", async () => {
    const request = new Request("http://localhost/api/platform/overview");
    const response = await runApiHandler(request, async () => ({
      ready: true,
    }));
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        ready: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.ready).toBe(true);
  });
});
