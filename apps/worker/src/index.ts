import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PINGORA_VERSION } from "@pingora/shared";
import { startEmailWorker } from "./processors/email.processor.js";

const rootEnv = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
config({ path: rootEnv });

const worker = startEmailWorker();

console.log(
  `[pingora-worker] ready (v${PINGORA_VERSION}) — processing email queue`,
);

async function shutdown(signal: string) {
  console.log(`[pingora-worker] ${signal} received, closing...`);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
