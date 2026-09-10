import Fastify from "fastify";
import fp from "fastify-plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import rateLimitPlugin from "./rate-limit.js";

const checkSlidingWindowRateLimit = vi.hoisted(() => vi.fn());

vi.mock("../lib/rate-limit.js", () => ({
  checkSlidingWindowRateLimit,
  getRateLimitWindowMs: () => 60_000,
}));

vi.mock("../lib/redis.js", () => ({
  getRedisClient: () => ({}),
}));

const mockAuthPlugin = fp(
  async (fastify) => {
    fastify.decorateRequest("apiKey", undefined);
  },
  { name: "pingora-auth" },
);

describe("rateLimitPlugin", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  async function buildTestApp() {
    const app = Fastify();

    await app.register(mockAuthPlugin);

    app.addHook("onRequest", async (request) => {
      request.apiKey = {
        id: "key_test",
        name: "test",
        prefix: "nfh_test",
        scopes: [],
        rateLimit: 2,
      };
    });

    await app.register(rateLimitPlugin);
    app.get("/protected", async () => ({ ok: true }));
    app.get("/health", { config: { public: true } }, async () => ({
      status: "ok",
    }));

    return app;
  }

  it("skips public routes", async () => {
    const app = await buildTestApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(checkSlidingWindowRateLimit).not.toHaveBeenCalled();
    await app.close();
  });

  it("sets rate limit headers on allowed requests", async () => {
    checkSlidingWindowRateLimit.mockResolvedValue({
      allowed: true,
      limit: 2,
      remaining: 1,
      resetAt: 1_700_000_000,
    });

    const app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/protected" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-ratelimit-limit"]).toBe("2");
    expect(response.headers["x-ratelimit-remaining"]).toBe("1");
    expect(response.headers["x-ratelimit-reset"]).toBe("1700000000");
    await app.close();
  });

  it("returns 429 when the sliding window is exceeded", async () => {
    checkSlidingWindowRateLimit.mockResolvedValue({
      allowed: false,
      limit: 2,
      remaining: 0,
      resetAt: 1_700_000_060,
      retryAfterSeconds: 15,
    });

    const app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/protected" });

    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("15");
    expect(response.json()).toEqual({
      error: "rate_limit_exceeded",
      message: "API rate limit exceeded for this key",
      retryAfter: 15,
    });
    await app.close();
  });
});
