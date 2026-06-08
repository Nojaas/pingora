import { API_KEY_HEADER } from "@pingora/shared";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { hasEveryScope, resolveApiKey } from "../lib/api-key.js";
import type { ApiKeyContext } from "../types/fastify.js";

function isPublicRoute(url: string, config?: { public?: boolean }): boolean {
  if (config?.public === true) {
    return true;
  }

  const pathname = url.split("?")[0] ?? url;
  return pathname === "/health";
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("apiKey", undefined);

  fastify.addHook("onRequest", async (request, reply) => {
    const routeConfig = request.routeOptions.config;

    if (isPublicRoute(request.url, routeConfig)) {
      return;
    }

    const rawKey = request.headers[API_KEY_HEADER];

    if (typeof rawKey !== "string" || rawKey.length === 0) {
      return reply.code(401).send({
        error: "unauthorized",
        message: `Missing ${API_KEY_HEADER} header`,
      });
    }

    const apiKey = await resolveApiKey(rawKey);

    if (!apiKey) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "Invalid or expired API key",
      });
    }

    request.apiKey = apiKey;
  });
};

export function requireScopes(...scopes: string[]) {
  return async function scopeGuard(
    request: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply,
  ) {
    if (!request.apiKey) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "API key required",
      });
    }

    if (!hasEveryScope(request.apiKey, scopes)) {
      return reply.code(403).send({
        error: "forbidden",
        message: "Insufficient scope",
        required: scopes,
      });
    }
  };
}

export default fp(authPlugin, {
  name: "pingora-auth",
});
