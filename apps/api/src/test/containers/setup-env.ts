import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const envFile = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".containers-env.json",
);

const env = JSON.parse(readFileSync(envFile, "utf8")) as {
  databaseUrl: string;
  redisUrl: string;
};

process.env.DATABASE_URL = env.databaseUrl;
process.env.REDIS_URL = env.redisUrl;
process.env.NODE_ENV = "test";
process.env.METRICS_SECRET = "containers-metrics-secret";
process.env.INBOUND_WEBHOOK_SECRET = "whsec_containers_inbound_16chars";
process.env.LOG_LEVEL = "silent";
