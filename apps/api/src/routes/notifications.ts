import {
  createNotificationBodySchema,
  formatZodError,
  SCOPES,
} from "@pingora/shared";
import type { FastifyPluginAsync } from "fastify";
import { requireScopes } from "../plugins/auth.js";
import {
  createNotification,
  toNotificationResponse,
} from "../services/notification.service.js";

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/notifications",
    {
      preHandler: requireScopes(SCOPES.NOTIFICATIONS_WRITE),
    },
    async (request, reply) => {
      const parsed = createNotificationBodySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send(formatZodError(parsed.error));
      }

      const notification = await createNotification(
        request.apiKey!.id,
        parsed.data,
      );

      return reply.code(201).send(toNotificationResponse(notification));
    },
  );
};

export default notificationsRoutes;
