import {
  formatZodError,
  inboundWebhookBodySchema,
  verifyWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from "@pingora/shared";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { getRedisClient } from "../lib/redis.js";
import {
  claimInboundEvent,
  getInboundWebhookSecret,
  toInboundAck,
} from "../services/inbound-webhook.service.js";

type RequestWithRawBody = FastifyRequest & { rawBody?: string };

const inboundWebhooksRoutes: FastifyPluginAsync = async (fastify) => {
  // Parser encapsulé : conserve le body brut pour la vérif HMAC.
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      const raw = typeof body === "string" ? body : body.toString("utf8");
      (request as RequestWithRawBody).rawBody = raw;

      try {
        const json = raw.length === 0 ? {} : JSON.parse(raw);
        done(null, json);
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );

  fastify.post(
    "/webhooks/inbound",
    {
      config: { public: true },
    },
    async (request, reply) => {
      const secret = getInboundWebhookSecret();
      if (!secret) {
        return reply.code(503).send({
          error: "service_unavailable",
          message: "INBOUND_WEBHOOK_SECRET is not configured",
        });
      }

      const signatureHeader = request.headers[WEBHOOK_SIGNATURE_HEADER];
      if (typeof signatureHeader !== "string" || signatureHeader.length === 0) {
        return reply.code(401).send({
          error: "unauthorized",
          message: `Missing ${WEBHOOK_SIGNATURE_HEADER} header`,
        });
      }

      const rawBody = (request as RequestWithRawBody).rawBody ?? "";
      const valid = verifyWebhookSignature(secret, rawBody, signatureHeader);

      if (!valid) {
        return reply.code(401).send({
          error: "unauthorized",
          message: "Invalid webhook signature",
        });
      }

      const parsed = inboundWebhookBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send(formatZodError(parsed.error));
      }

      const claim = await claimInboundEvent(getRedisClient(), parsed.data.id);
      const duplicate = claim === "duplicate";

      if (!duplicate) {
        request.log.info(
          {
            inboundId: parsed.data.id,
            type: parsed.data.type,
          },
          "inbound webhook accepted",
        );
      }

      return reply.code(200).send(toInboundAck(parsed.data, duplicate));
    },
  );
};

export default inboundWebhooksRoutes;
