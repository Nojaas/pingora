import type { Scope } from "@pingora/shared";

export type ApiKeyContext = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  rateLimit: number;
};

declare module "fastify" {
  interface FastifyRequest {
    apiKey?: ApiKeyContext;
    metricsStartNs?: bigint;
  }

  interface FastifyRouteConfig {
    /** Route accessible without x-api-key (ex. /health) */
    public?: boolean;
    /** Route interne protégée par METRICS_SECRET / ADMIN_SECRET */
    internal?: boolean;
  }

  interface FastifyContextConfig {
    public?: boolean;
    internal?: boolean;
  }
}

export type { Scope };
