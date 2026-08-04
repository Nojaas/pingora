import { describe, expect, it } from "vitest";
import {
  buildRateLimitKey,
  parseSlidingWindowRateLimitResult,
  RATE_LIMIT_KEY_PREFIX,
} from "./rate-limit.js";

describe("buildRateLimitKey", () => {
  it("prefixes the api key id", () => {
    expect(buildRateLimitKey("key_abc")).toBe(
      `${RATE_LIMIT_KEY_PREFIX}key_abc`,
    );
  });
});

describe("parseSlidingWindowRateLimitResult", () => {
  it("parses an allowed decision", () => {
    expect(parseSlidingWindowRateLimitResult([1, 42, 0, 1_700_000_000], 1000)).toEqual({
      allowed: true,
      limit: 1000,
      remaining: 958,
      resetAt: 1_700_000_000,
    });
  });

  it("parses a blocked decision with retry-after", () => {
    expect(parseSlidingWindowRateLimitResult([0, 1000, 12, 1_700_000_060], 1000)).toEqual({
      allowed: false,
      limit: 1000,
      remaining: 0,
      resetAt: 1_700_000_060,
      retryAfterSeconds: 12,
    });
  });

  it("rejects malformed script output", () => {
    expect(() => parseSlidingWindowRateLimitResult(null, 100)).toThrow(
      "Invalid rate limit script result",
    );
  });
});
