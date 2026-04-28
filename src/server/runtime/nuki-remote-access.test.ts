import { describe, expect, it, vi } from "vitest";
import {
  createNukiRemoteAccessProvider,
  isNukiRemoteAccessConfigured,
} from "@/server/runtime/nuki-remote-access";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

describe("nuki remote access provider", () => {
  it("detects configured Nuki credentials without treating empty env as live", () => {
    expect(isNukiRemoteAccessConfigured({ NUKI_API_TOKEN: "" })).toBe(false);
    expect(isNukiRemoteAccessConfigured({ NUKI_API_TOKEN: "nuki-token" })).toBe(true);
  });

  it("opens a Nuki smart lock through the Web API unlock action endpoint", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.nuki.io/smartlock/123456/action/unlock");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        authorization: "Bearer nuki-token",
        accept: "application/json",
      });

      return jsonResponse({
        id: "nuki_action_1",
        status: "accepted",
      });
    });
    const provider = createNukiRemoteAccessProvider({
      apiToken: "nuki-token",
      fetchImpl: fetchMock,
    });

    await expect(provider.unlock({ smartlockId: "123456" })).resolves.toEqual({
      providerActionId: "nuki_action_1",
      providerStatus: "accepted",
    });
  });

  it("accepts an empty success response from Nuki as an accepted unlock", async () => {
    const provider = createNukiRemoteAccessProvider({
      apiToken: "nuki-token",
      fetchImpl: vi.fn(async () => new Response(null, { status: 204 })),
    });

    await expect(provider.unlock({ smartlockId: "123456" })).resolves.toEqual({
      providerActionId: "nuki:123456:unlock",
      providerStatus: "accepted",
    });
  });

  it("fails loudly when Nuki rejects the remote open action", async () => {
    const provider = createNukiRemoteAccessProvider({
      apiToken: "nuki-token",
      fetchImpl: vi.fn(async () =>
        jsonResponse({ detailMessage: "Smartlock is offline." }, { status: 406 }),
      ),
    });

    await expect(provider.unlock({ smartlockId: "123456" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});
