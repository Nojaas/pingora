import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { logger } from "./lib/logger.js";
import { startEmailWorker } from "./processors/email.processor.js";
import { startEmailDlqWorker } from "./processors/email-dlq.processor.js";
import { startWebhookWorker } from "./processors/webhook.processor.js";

const rootEnv = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
config({ path: rootEnv });

const emailWorker = startEmailWorker();
const emailDlqWorker = startEmailDlqWorker();
const webhookWorker = startWebhookWorker();

logger.info({ queues: ["email", "email-dlq", "webhook"] }, "worker ready");

async function shutdown(signal: string) {
  logger.info({ signal }, "shutdown requested");
  await Promise.all([
    emailWorker.close(),
    emailDlqWorker.close(),
    webhookWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
