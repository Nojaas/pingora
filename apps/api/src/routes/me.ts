import type { FastifyPluginAsync } from "fastify";

/** Route de smoke test */
const meRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/me", async (request) => {
    const { apiKey } = request;
    return {
      apiKey: {
        id: apiKey!.id,
        name: apiKey!.name,
        prefix: apiKey!.prefix,
        scopes: apiKey!.scopes,
        rateLimit: apiKey!.rateLimit,
      },
    };
  });
};

export default meRoutes;
