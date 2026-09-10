import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
  resolveMetricsRoute,
} from "../lib/metrics.js";

const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    request.metricsStartNs = process.hrtime.bigint();
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const startNs = request.metricsStartNs;
    if (startNs === undefined) {
      return;
    }

    const route = resolveMetricsRoute(request);
    if (route === "/metrics") {
      return;
    }

    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };

    httpRequestsTotal.inc(labels);

    const durationSeconds =
      Number(process.hrtime.bigint() - startNs) / 1_000_000_000;
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });
};

export default fp(metricsPlugin, {
  name: "pingora-metrics",
});
