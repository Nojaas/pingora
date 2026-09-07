import type { FastifyReply, FastifyRequest } from "fastify";

export function resolveMetricsSecret(): string | undefined {
  const metricsSecret = process.env.METRICS_SECRET?.trim();
  if (metricsSecret) {
    return metricsSecret;
  }

  const adminSecret = process.env.ADMIN_SECRET?.trim();
  return adminSecret || undefined;
}

export function extractBearerToken(
  authorization: string | string[] | undefined,
): string | undefined {
  if (typeof authorization !== "string") {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim();
}

export function isInternalAccessAuthorized(request: FastifyRequest): boolean {
  const secret = resolveMetricsSecret();
  if (!secret) {
    return false;
  }

  const bearer = extractBearerToken(request.headers.authorization);
  const headerToken = request.headers["x-metrics-token"];
  const token =
    bearer ??
    (typeof headerToken === "string" ? headerToken : undefined);

  return token === secret;
}

export function sendInternalUnauthorized(reply: FastifyReply) {
  return reply.code(401).send({
    error: "unauthorized",
    message: "Valid metrics credentials required",
  });
}

export function sendMetricsNotConfigured(reply: FastifyReply) {
  return reply.code(503).send({
    error: "metrics_not_configured",
    message: "Set METRICS_SECRET or ADMIN_SECRET to enable /metrics",
  });
}
