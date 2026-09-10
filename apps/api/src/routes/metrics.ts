import type { FastifyPluginAsync } from "fastify";
import { metricsContentType, renderMetrics } from "../lib/metrics.js";

const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/metrics",
    {
      config: { internal: true },
    },
    async (_request, reply) => {
      const body = await renderMetrics();
      return reply.type(metricsContentType).send(body);
    },
  );
};

export default metricsRoutes;
