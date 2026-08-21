import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PINGORA_VERSION } from "@pingora/shared";
import { startEmailDlqWorker } from "./processors/email-dlq.processor.js";
import { startEmailWorker } from "./processors/email.processor.js";
import { startWebhookWorker } from "./processors/webhook.processor.js";

const rootEnv = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
config({ path: rootEnv });

const emailWorker = startEmailWorker();
const emailDlqWorker = startEmailDlqWorker();
const webhookWorker = startWebhookWorker();

console.log(
  `[pingora-worker] ready (v${PINGORA_VERSION}) — email + email-dlq + webhook queues`,
);

async function shutdown(signal: string) {
  console.log(`[pingora-worker] ${signal} received, closing...`);
  await Promise.all([
    emailWorker.close(),
    emailDlqWorker.close(),
    webhookWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
