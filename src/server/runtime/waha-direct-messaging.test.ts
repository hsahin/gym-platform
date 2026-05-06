import { describe, expect, it, vi } from "vitest";
import {
  createDirectWahaWhatsAppProvider,
  isWahaSessionHealthy,
  normalizeWahaPhone,
  validateWahaConfig,
} from "@/server/runtime/waha-direct-messaging";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

describe("direct WAHA messaging", () => {
  it("validates WAHA configuration without leaking secrets", () => {
    expect(validateWahaConfig({ WAHA_BASE_URL: "", WAHA_API_KEY: "" })).toEqual({
      configured: false,
      missingEnv: ["WAHA_BASE_URL", "WAHA_API_KEY"],
      session: "default",
    });
    expect(
      validateWahaConfig({
        WAHA_BASE_URL: "https://waha.example",
        WAHA_API_KEY: "secret-key",
        WAHA_SESSION: "gym",
      }),
    ).toEqual({
      configured: true,
      missingEnv: [],
      session: "gym",
    });
  });

  it("normalizes Dutch and international WhatsApp numbers", () => {
    expect(normalizeWahaPhone("0612345678")).toBe("31612345678");
    expect(normalizeWahaPhone("+31 6 1234 5678")).toBe("31612345678");
    expect(normalizeWahaPhone("0031 6 1234 5678")).toBe("31612345678");
    expect(normalizeWahaPhone("07868426969")).toBe("317868426969");
    expect(() => normalizeWahaPhone("abc")).toThrow("Ongeldig WhatsApp nummer.");
  });

  it("recognizes all healthy WAHA session shapes", () => {
    expect(isWahaSessionHealthy({ status: "WORKING" })).toBe(true);
    expect(isWahaSessionHealthy({ state: "CONNECTED" })).toBe(true);
    expect(isWahaSessionHealthy({ engine: { state: "CONNECTED" } })).toBe(true);
    expect(isWahaSessionHealthy({ status: "STOPPED" })).toBe(false);
  });

  it("checks recipient existence and sends the exact WAHA sendText payload", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);

      if (target === "https://waha.example/api/sessions/default") {
        expect(init?.method).toBe("GET");
        expect(init?.headers).toMatchObject({
          "X-Api-Key": "secret-key",
          "content-type": "application/json",
        });
        return jsonResponse({ status: "WORKING" });
      }

      if (
        target ===
        "https://waha.example/api/contacts/check-exists?phone=31612345678&session=default"
      ) {
        expect(init?.method).toBe("GET");
        return jsonResponse({ numberExists: true });
      }

      if (target === "https://waha.example/api/sendText") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          chatId: "31612345678@c.us",
          reply_to: null,
          text: "Hallo via WAHA",
          linkPreview: true,
          linkPreviewHighQuality: false,
          session: "default",
        });

        return jsonResponse({ id: "msg_1" });
      }

      throw new Error(`Unhandled WAHA request: ${target}`);
    });
    const provider = createDirectWahaWhatsAppProvider({
      baseUrl: "https://waha.example",
      apiKey: "secret-key",
      session: "default",
      fetchImpl: fetchMock,
    });

    await expect(
      provider.send({
        channel: "whatsapp",
        recipient: "0612345678",
        body: "Hallo via WAHA",
      }),
    ).resolves.toMatchObject({
      accepted: true,
      status: "sent",
      providerMessageId: "msg_1",
    });
  });

  it("requires concrete WAHA connection settings before constructing the provider", () => {
    expect(() =>
      createDirectWahaWhatsAppProvider({
        baseUrl: " ",
        apiKey: "secret-key",
      }),
    ).toThrow("WAHA configuratie mist WAHA_BASE_URL of WAHA_API_KEY.");
    expect(() =>
      createDirectWahaWhatsAppProvider({
        baseUrl: "https://waha.example/",
        apiKey: " ",
      }),
    ).toThrow("WAHA configuratie mist WAHA_BASE_URL of WAHA_API_KEY.");
  });

  it("reads provider ids from WAHA key payloads and tolerates non-json send responses", async () => {
    const provider = createDirectWahaWhatsAppProvider({
      baseUrl: "https://waha.example/",
      apiKey: "secret-key",
      session: " custom ",
      fetchImpl: vi.fn(async (url: string | URL | Request) => {
        const target = String(url);

        if (target === "https://waha.example/api/sessions/custom") {
          return jsonResponse({ engine: { state: "CONNECTED" } });
        }

        if (
          target ===
          "https://waha.example/api/contacts/check-exists?phone=31612345678&session=custom"
        ) {
          return jsonResponse({ exists: true });
        }

        return new Response("accepted", { status: 200 });
      }),
    });

    await expect(
      provider.send({
        channel: "whatsapp",
        recipient: "0612345678",
        body: "Hallo",
      }),
    ).resolves.toMatchObject({
      accepted: true,
      providerMessageId: undefined,
      raw: null,
    });

    const providerWithKeyId = createDirectWahaWhatsAppProvider({
      baseUrl: "https://waha.example",
      apiKey: "secret-key",
      fetchImpl: vi.fn(async (url: string | URL | Request) => {
        const target = String(url);

        if (target.includes("/sessions/")) {
          return jsonResponse({ status: "WORKING" });
        }

        if (target.includes("/contacts/check-exists")) {
          return jsonResponse({ result: true });
        }

        return jsonResponse({ key: { id: "msg_key_1" } });
      }),
    });

    await expect(
      providerWithKeyId.send({
        channel: "whatsapp",
        recipient: "0612345678",
        body: "Welkom",
      }),
    ).resolves.toMatchObject({
      providerMessageId: "msg_key_1",
    });
  });

  it("parses recipient existence through exists and result flags", async () => {
    const responses = [{ exists: true }, { result: true }];

    for (const response of responses) {
      const provider = createDirectWahaWhatsAppProvider({
        baseUrl: "https://waha.example",
        apiKey: "secret-key",
        fetchImpl: vi.fn(async (url: string | URL | Request) => {
          const target = String(url);

          if (target.includes("/sessions/")) {
            return jsonResponse({ state: "CONNECTED" });
          }

          if (target.includes("/contacts/check-exists")) {
            return jsonResponse(response);
          }

          return jsonResponse({ id: "msg_exists" });
        }),
      });

      await expect(
        provider.send({
          channel: "whatsapp",
          recipient: "+31612345678",
          body: "Welkom",
        }),
      ).resolves.toMatchObject({
        accepted: true,
      });
    }
  });

  it("short-circuits invalid numbers and non-2xx WAHA responses with clean errors", async () => {
    const invalidFetch = vi.fn();
    const invalidProvider = createDirectWahaWhatsAppProvider({
      baseUrl: "https://waha.example",
      apiKey: "secret-key",
      fetchImpl: invalidFetch,
    });

    await expect(
      invalidProvider.send({
        channel: "whatsapp",
        recipient: "abc",
        body: "Hallo",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(invalidFetch).not.toHaveBeenCalled();

    const rejectedProvider = createDirectWahaWhatsAppProvider({
      baseUrl: "https://waha.example",
      apiKey: "secret-key",
      fetchImpl: vi.fn(async (url: string | URL | Request) => {
        const target = String(url);

        if (target.includes("/sessions/")) {
          return jsonResponse({ status: "WORKING" });
        }

        if (target.includes("/contacts/check-exists")) {
          return jsonResponse({ numberExists: true });
        }

        return jsonResponse({ message: "Unauthorized" }, { status: 401 });
      }),
    });

    await expect(
      rejectedProvider.send({
        channel: "whatsapp",
        recipient: "0612345678",
        body: "Hallo",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("rejects unhealthy sessions, session check failures and unreachable recipients", async () => {
    const unhealthyProvider = createDirectWahaWhatsAppProvider({
      baseUrl: "https://waha.example",
      apiKey: "secret-key",
      fetchImpl: vi.fn(async () => jsonResponse({ status: "STOPPED" })),
    });

    await expect(
      unhealthyProvider.send({
        channel: "whatsapp",
        recipient: "0612345678",
        body: "Hallo",
      }),
    ).rejects.toThrow("WAHA sessie is niet verbonden.");

    const sessionFailureProvider = createDirectWahaWhatsAppProvider({
      baseUrl: "https://waha.example",
      apiKey: "secret-key",
      fetchImpl: vi.fn(async () => jsonResponse({ message: "offline" }, { status: 503 })),
    });

    await expect(
      sessionFailureProvider.send({
        channel: "whatsapp",
        recipient: "0612345678",
        body: "Hallo",
      }),
    ).rejects.toThrow("WAHA sessie kon niet worden gecontroleerd.");

    const missingRecipientProvider = createDirectWahaWhatsAppProvider({
      baseUrl: "https://waha.example",
      apiKey: "secret-key",
      fetchImpl: vi.fn(async (url: string | URL | Request) => {
        const target = String(url);

        if (target.includes("/sessions/")) {
          return jsonResponse({ status: "WORKING" });
        }

        return jsonResponse({ numberExists: false });
      }),
    });

    await expect(
      missingRecipientProvider.send({
        channel: "whatsapp",
        recipient: "0612345678",
        body: "Hallo",
      }),
    ).rejects.toThrow("WhatsApp ontvanger bestaat niet of is niet bereikbaar.");

    const recipientFailureProvider = createDirectWahaWhatsAppProvider({
      baseUrl: "https://waha.example",
      apiKey: "secret-key",
      fetchImpl: vi.fn(async (url: string | URL | Request) => {
        const target = String(url);

        if (target.includes("/sessions/")) {
          return jsonResponse({ status: "WORKING" });
        }

        return jsonResponse({ message: "recipient check failed" }, { status: 502 });
      }),
    });

    await expect(
      recipientFailureProvider.send({
        channel: "whatsapp",
        recipient: "0612345678",
        body: "Hallo",
      }),
    ).rejects.toThrow("WAHA ontvanger kon niet worden gecontroleerd.");
  });
});
