import {
  dashboardSummaryQuerySchema,
  formatZodError,
  SCOPES,
} from "@pingora/shared";
import type { FastifyPluginAsync } from "fastify";
import { requireScopes } from "../plugins/auth.js";
import { getDashboardSummary } from "../services/dashboard.service.js";

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/dashboard/summary",
    {
      preHandler: requireScopes(SCOPES.NOTIFICATIONS_READ),
    },
    async (request, reply) => {
      const parsed = dashboardSummaryQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        return reply.code(400).send(formatZodError(parsed.error));
      }

      const summary = await getDashboardSummary(
        request.apiKey!.id,
        parsed.data,
      );
      return reply.send(summary);
    },
  );
};

export default dashboardRoutes;
