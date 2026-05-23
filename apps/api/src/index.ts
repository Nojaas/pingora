import { PINGORA_VERSION } from "@pingora/shared";
import Fastify from "fastify";

const port = Number(process.env.PORT ?? 3000);

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "pingora-api",
  version: PINGORA_VERSION,
}));

await app.listen({ port, host: "0.0.0.0" });
