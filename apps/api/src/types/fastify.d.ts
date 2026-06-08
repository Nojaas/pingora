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
  }

  interface FastifyRouteConfig {
    /** Route accessible without x-api-key (ex. /health) */
    public?: boolean;
  }

  interface FastifyContextConfig {
    public?: boolean;
  }
}

export type { Scope };
