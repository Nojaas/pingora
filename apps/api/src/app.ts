import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import Fastify from "fastify";
import authPlugin from "./plugins/auth.js";
import healthRoutes from "./routes/health.js";
import meRoutes from "./routes/me.js";
import notificationsRoutes from "./routes/notifications.js";

const rootEnv = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
config({ path: rootEnv });

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(healthRoutes);
  await app.register(authPlugin);
  await app.register(meRoutes);
  await app.register(notificationsRoutes);

  return app;
}
