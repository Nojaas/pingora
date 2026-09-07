import {
  createWebhookEndpointBodySchema,
  formatZodError,
  listWebhookDeliveriesQuerySchema,
  SCOPES,
} from "@pingora/shared";
import type { FastifyPluginAsync } from "fastify";
import { requireScopes } from "../plugins/auth.js";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
} from "../services/webhook.service.js";

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/webhooks/endpoints",
    {
      preHandler: requireScopes(SCOPES.WEBHOOKS_READ),
    },
    async (request) => {
      return listWebhookEndpoints(request.apiKey!.id);
    },
  );

  fastify.get(
    "/webhooks/deliveries",
    {
      preHandler: requireScopes(SCOPES.WEBHOOKS_READ),
    },
    async (request, reply) => {
      const parsed = listWebhookDeliveriesQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        return reply.code(400).send(formatZodError(parsed.error));
      }

      return listWebhookDeliveries(request.apiKey!.id, parsed.data);
    },
  );

  fastify.post(
    "/webhooks/endpoints",
    {
      preHandler: requireScopes(SCOPES.WEBHOOKS_WRITE),
    },
    async (request, reply) => {
      const parsed = createWebhookEndpointBodySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send(formatZodError(parsed.error));
      }

      const endpoint = await createWebhookEndpoint(
        request.apiKey!.id,
        parsed.data,
      );

      return reply.code(201).send(endpoint);
    },
  );

  fastify.delete(
    "/webhooks/endpoints/:id",
    {
      preHandler: requireScopes(SCOPES.WEBHOOKS_WRITE),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await deleteWebhookEndpoint(request.apiKey!.id, id);

      if (!deleted) {
        return reply.code(404).send({
          error: "not_found",
          message: "Webhook endpoint not found",
        });
      }

      return reply.code(204).send();
    },
  );
};

export default webhooksRoutes;
