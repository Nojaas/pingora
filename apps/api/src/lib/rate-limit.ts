import { randomUUID } from "node:crypto";
import {
  buildRateLimitKey,
  parseSlidingWindowRateLimitResult,
  RATE_LIMIT_WINDOW_MS,
  type RateLimitDecision,
  SLIDING_WINDOW_RATE_LIMIT_SCRIPT,
} from "@pingora/shared";
import type { Redis } from "ioredis";

export function getRateLimitWindowMs(): number {
  const fromEnv = process.env.RATE_LIMIT_WINDOW_MS;
  if (!fromEnv) {
    return RATE_LIMIT_WINDOW_MS;
  }

  const parsed = Number(fromEnv);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return RATE_LIMIT_WINDOW_MS;
  }

  return Math.floor(parsed);
}

export async function checkSlidingWindowRateLimit(
  redis: Redis,
  apiKeyId: string,
  limit: number,
  windowMs = getRateLimitWindowMs(),
): Promise<RateLimitDecision> {
  const now = Date.now();
  const key = buildRateLimitKey(apiKeyId);
  const member = `${now}:${randomUUID()}`;

  const result = await redis.eval(
    SLIDING_WINDOW_RATE_LIMIT_SCRIPT,
    1,
    key,
    String(now),
    String(windowMs),
    String(limit),
    member,
  );

  return parseSlidingWindowRateLimitResult(result, limit);
}
