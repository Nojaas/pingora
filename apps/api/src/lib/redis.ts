import { Redis } from "ioredis";

let redis: Redis | undefined;

export function getRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set. Start Redis with `pnpm infra:up`.");
  }

  redis ??= new Redis(url, {
    maxRetriesPerRequest: null,
  });

  return redis;
}

export async function closeRedisClient(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = undefined;
  }
}
