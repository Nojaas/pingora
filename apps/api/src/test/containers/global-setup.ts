import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {
  RedisContainer,
  type StartedRedisContainer,
} from "@testcontainers/redis";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../../..");
const envFile = resolve(here, ".containers-env.json");

let postgres: StartedPostgreSqlContainer | undefined;
let redis: StartedRedisContainer | undefined;

export async function setup() {
  postgres = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("pingora")
    .withUsername("postgres")
    .withPassword("postgres")
    .start();

  redis = await new RedisContainer("redis:7-alpine").start();

  const databaseUrl = postgres.getConnectionUri();
  const redisUrl = redis.getConnectionUrl();

  writeFileSync(
    envFile,
    JSON.stringify({ databaseUrl, redisUrl }, null, 2),
    "utf8",
  );

  execFileSync(
    "pnpm",
    ["--filter", "@pingora/db", "exec", "prisma", "migrate", "deploy"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: "inherit",
    },
  );
}

export async function teardown() {
  await Promise.all([postgres?.stop(), redis?.stop()]);
}
