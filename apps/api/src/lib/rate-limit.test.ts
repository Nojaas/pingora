import { describe, expect, it, vi } from "vitest";
import { checkSlidingWindowRateLimit } from "./rate-limit.js";

describe("checkSlidingWindowRateLimit", () => {
  it("delegates to Redis EVAL and parses the allowed result", async () => {
    const evalMock = vi.fn().mockResolvedValue([1, 3, 0, 1_700_000_000]);
    const redis = { eval: evalMock } as never;

    const decision = await checkSlidingWindowRateLimit(
      redis,
      "key_abc",
      100,
      60_000,
    );

    expect(decision).toEqual({
      allowed: true,
      limit: 100,
      remaining: 97,
      resetAt: 1_700_000_000,
    });
    expect(evalMock).toHaveBeenCalledOnce();
  });
});
