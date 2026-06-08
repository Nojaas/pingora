import type { ConnectionOptions } from "bullmq";

export function getRedisConnectionOptions(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is not set. Start Redis with `pnpm infra:up`.",
    );
  }

  return {
    url,
    maxRetriesPerRequest: null,
  };
}
