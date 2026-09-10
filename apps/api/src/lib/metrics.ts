import { LOG_SERVICES, PINGORA_VERSION } from "@pingora/shared";
import {
  Counter,
  collectDefaultMetrics,
  Histogram,
  Registry,
} from "@prometheus-io/client";

export const metricsRegistry = new Registry();

metricsRegistry.setDefaultLabels({
  service: LOG_SERVICES.API,
  version: PINGORA_VERSION,
});

collectDefaultMetrics({
  register: metricsRegistry,
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export function resolveMetricsRoute(request: {
  routeOptions: { url?: string };
  url: string;
}): string {
  const pattern = request.routeOptions.url;
  if (pattern) {
    return pattern;
  }

  const pathname = request.url.split("?")[0] ?? request.url;
  return pathname;
}

export async function renderMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

export const metricsContentType = metricsRegistry.contentType;
