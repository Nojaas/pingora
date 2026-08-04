export const RATE_LIMIT_WINDOW_MS = 60_000;

export const RATE_LIMIT_KEY_PREFIX = "pingora:ratelimit:" as const;

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp (seconds) when the current window resets */
  resetAt: number;
  retryAfterSeconds?: number;
};

export function buildRateLimitKey(apiKeyId: string): string {
  return `${RATE_LIMIT_KEY_PREFIX}${apiKeyId}`;
}

/**
 * Sliding window log — atomic via Redis EVAL.
 * Returns: [allowed 0|1, count, retryAfterSeconds, resetAtUnixSeconds]
 */
export const SLIDING_WINDOW_RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)

if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_ms = window
  if oldest[2] then
    retry_ms = tonumber(oldest[2]) + window - now
  end
  if retry_ms < 1 then
    retry_ms = 1
  end
  local reset_at = math.ceil((tonumber(oldest[2] or now) + window) / 1000)
  return {0, count, math.ceil(retry_ms / 1000), reset_at}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
local reset_at = math.ceil((now + window) / 1000)
return {1, count + 1, 0, reset_at}
`;

export function parseSlidingWindowRateLimitResult(
  raw: unknown,
  limit: number,
): RateLimitDecision {
  if (!Array.isArray(raw) || raw.length < 4) {
    throw new Error("Invalid rate limit script result");
  }

  const allowed = Number(raw[0]) === 1;
  const count = Number(raw[1]);
  const retryAfterSeconds = Number(raw[2]);
  const resetAt = Number(raw[3]);

  return {
    allowed,
    limit,
    remaining: allowed ? Math.max(0, limit - count) : 0,
    resetAt,
    ...(allowed ? {} : { retryAfterSeconds: Math.max(1, retryAfterSeconds) }),
  };
}
