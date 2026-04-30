import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRedisKeepAliveIntervalMs,
  startRedisKeepAlive,
} from "@/server/runtime/gym-services";

afterEach(() => {
  delete process.env.CLAIMTECH_REDIS_KEEP_ALIVE_INTERVAL_MS;
  vi.useRealTimers();
});

describe("gym platform Redis cache keep-alive", () => {
  it("pings Redis before managed Valkey idle sockets are closed", async () => {
    vi.useFakeTimers();
    const ping = vi.fn(async () => "PONG");
    const timer = startRedisKeepAlive({
      client: { ping },
    } as never);

    expect(timer).toBeDefined();
    expect(getRedisKeepAliveIntervalMs()).toBe(240_000);
    expect(ping).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(240_000);

    expect(ping).toHaveBeenCalledOnce();
    clearInterval(timer);
  });

  it("allows the keep-alive interval to be tuned for managed Redis providers", () => {
    process.env.CLAIMTECH_REDIS_KEEP_ALIVE_INTERVAL_MS = "60000";

    expect(getRedisKeepAliveIntervalMs()).toBe(60_000);
  });

  it("does not start a timer for cache clients without direct ping support", () => {
    expect(startRedisKeepAlive({} as never)).toBeUndefined();
  });
});
