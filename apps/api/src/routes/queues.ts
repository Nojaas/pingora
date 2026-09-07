import { SCOPES } from "@pingora/shared";
import type { FastifyPluginAsync } from "fastify";
import { requireScopes } from "../plugins/auth.js";
import { getQueuesStatus } from "../services/queue.service.js";

const queuesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/queues",
    {
      preHandler: requireScopes(SCOPES.NOTIFICATIONS_READ),
    },
    async (_request, reply) => {
      const queues = await getQueuesStatus();
      return reply.send({ data: queues });
    },
  );
};

export default queuesRoutes;
