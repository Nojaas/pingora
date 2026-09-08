import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createFastifyLogger, LOG_SERVICES } from "@pingora/shared";
import { config } from "dotenv";
import Fastify from "fastify";
import authPlugin from "./plugins/auth.js";
import metricsPlugin from "./plugins/metrics.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import dashboardRoutes from "./routes/dashboard.js";
import healthRoutes from "./routes/health.js";
import inboundWebhooksRoutes from "./routes/inbound-webhooks.js";
import meRoutes from "./routes/me.js";
import metricsRoutes from "./routes/metrics.js";
import notificationsRoutes from "./routes/notifications.js";
import queuesRoutes from "./routes/queues.js";
import webhooksRoutes from "./routes/webhooks.js";

const rootEnv = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
config({ path: rootEnv });

export async function buildApp(options?: { logger?: boolean }) {
  const app = Fastify({
    logger: createFastifyLogger(LOG_SERVICES.API, options?.logger ?? true),
  });

  await app.register(metricsPlugin);
  await app.register(healthRoutes);
  await app.register(metricsRoutes);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);
  await app.register(meRoutes);
  await app.register(notificationsRoutes);
  await app.register(queuesRoutes);
  await app.register(dashboardRoutes);
  await app.register(webhooksRoutes);
  await app.register(inboundWebhooksRoutes);

  return app;
}
