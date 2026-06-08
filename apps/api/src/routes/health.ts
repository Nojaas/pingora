import { PINGORA_VERSION } from "@pingora/shared";
import type { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/health",
    {
      config: { public: true },
    },
    async () => ({
      status: "ok",
      service: "pingora-api",
      version: PINGORA_VERSION,
    }),
  );
};

export default healthRoutes;
