import type { RateLimitDecision } from "@pingora/shared";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { checkSlidingWindowRateLimit } from "../lib/rate-limit.js";
import { getRedisClient } from "../lib/redis.js";

function isPublicRoute(url: string, config?: { public?: boolean }): boolean {
  if (config?.public === true) {
    return true;
  }

  const pathname = url.split("?")[0] ?? url;
  return pathname === "/health";
}

function setRateLimitHeaders(reply: FastifyReply, decision: RateLimitDecision) {
  reply.header("X-RateLimit-Limit", String(decision.limit));
  reply.header("X-RateLimit-Remaining", String(decision.remaining));
  reply.header("X-RateLimit-Reset", String(decision.resetAt));
}

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    const routeConfig = request.routeOptions.config;

    if (isPublicRoute(request.url, routeConfig) || !request.apiKey) {
      return;
    }

    try {
      const decision = await checkSlidingWindowRateLimit(
        getRedisClient(),
        request.apiKey.id,
        request.apiKey.rateLimit,
      );

      setRateLimitHeaders(reply, decision);

      if (!decision.allowed) {
        if (decision.retryAfterSeconds) {
          reply.header("Retry-After", String(decision.retryAfterSeconds));
        }

        return reply.code(429).send({
          error: "rate_limit_exceeded",
          message: "API rate limit exceeded for this key",
          retryAfter: decision.retryAfterSeconds,
        });
      }
    } catch (error) {
      request.log.warn({ err: error }, "rate limit check failed — allowing request");
    }
  });
};

export default fp(rateLimitPlugin, {
  name: "pingora-rate-limit",
  dependencies: ["pingora-auth"],
});
