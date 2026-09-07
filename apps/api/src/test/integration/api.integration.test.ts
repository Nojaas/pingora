import {
  API_KEY_HEADER,
  signWebhookPayload,
  WEBHOOK_SIGNATURE_HEADER,
} from "@pingora/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.js";
import {
  inboundIdempotencyKeys,
  mockCheckRateLimit,
  mockEnqueueEmail,
} from "../setup.integration.js";
import { API_KEYS, prismaStore, seedIntegrationApiKeys } from "../prisma-store.js";

async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

function authHeader(rawKey: string) {
  return { [API_KEY_HEADER]: rawKey };
}

describe("API integration — auth", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    seedIntegrationApiKeys();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 1000,
      remaining: 999,
      resetAt: Math.floor(Date.now() / 1000) + 60,
    });
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it("GET /health is public", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "pingora-api",
    });
  });

  it("GET /metrics returns 401 without credentials", async () => {
    vi.stubEnv("METRICS_SECRET", "integration-metrics-secret");

    const response = await app.inject({ method: "GET", url: "/metrics" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "unauthorized" });

    vi.unstubAllEnvs();
  });

  it("GET /metrics returns Prometheus metrics with bearer token", async () => {
    vi.stubEnv("METRICS_SECRET", "integration-metrics-secret");

    const response = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: "Bearer integration-metrics-secret" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.body).toContain("http_requests_total");
    expect(response.body).toContain("process_cpu");

    vi.unstubAllEnvs();
  });

  it("GET /me returns 401 without api key", async () => {
    const response = await app.inject({ method: "GET", url: "/me" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "unauthorized" });
  });

  it("GET /me returns 401 with invalid api key", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/me",
      headers: authHeader("nfh_test_not_a_real_key"),
    });

    expect(response.statusCode).toBe(401);
  });

  it("GET /me returns 401 with revoked api key", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/me",
      headers: authHeader(API_KEYS.revoked.raw),
    });

    expect(response.statusCode).toBe(401);
  });

  it("GET /me returns api key metadata when authenticated", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/me",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      apiKey: {
        id: API_KEYS.full.id,
        name: API_KEYS.full.name,
        prefix: API_KEYS.full.prefix,
        scopes: [...API_KEYS.full.scopes],
        rateLimit: API_KEYS.full.rateLimit,
      },
    });
    expect(response.headers["x-ratelimit-limit"]).toBe("1000");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      limit: 2,
      remaining: 0,
      resetAt: 1_700_000_060,
      retryAfterSeconds: 12,
    });

    const response = await app.inject({
      method: "GET",
      url: "/me",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({
      error: "rate_limit_exceeded",
      retryAfter: 12,
    });
    expect(response.headers["retry-after"]).toBe("12");
  });
});

describe("API integration — notifications", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    seedIntegrationApiKeys();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 1000,
      remaining: 999,
      resetAt: Math.floor(Date.now() / 1000) + 60,
    });
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it("POST /notifications returns 403 without write scope", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/notifications",
      headers: {
        ...authHeader(API_KEYS.readOnly.raw),
        "content-type": "application/json",
      },
      payload: {
        channel: "email",
        recipient: "user@example.com",
        subject: "Hello",
        body: "World",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "forbidden" });
  });

  it("POST /notifications returns 400 for invalid payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/notifications",
      headers: {
        ...authHeader(API_KEYS.full.raw),
        "content-type": "application/json",
      },
      payload: {
        channel: "email",
        recipient: "not-an-email",
        subject: "Hello",
        body: "World",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "validation_error" });
  });

  it("POST /notifications creates and enqueues email notifications", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/notifications",
      headers: {
        ...authHeader(API_KEYS.full.raw),
        "content-type": "application/json",
      },
      payload: {
        channel: "email",
        recipient: "user@example.com",
        subject: "Order confirmed",
        body: "Thanks for your purchase.",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: "queued",
      channel: "email",
      recipient: "user@example.com",
      _links: {
        self: expect.stringMatching(/^\/notifications\/notif_integration_/),
      },
    });
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    expect(prismaStore.notifications).toHaveLength(1);
    expect(prismaStore.notifications[0]?.status).toBe("QUEUED");
  });

  it("GET /queues returns BullMQ job counts", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/queues",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        { name: "email", counts: { waiting: 1, completed: 10 } },
        { name: "email-dlq", counts: { waiting: 2, active: 1, delayed: 1 } },
        { name: "webhook", counts: { waiting: 3, active: 1, failed: 1 } },
      ],
    });
  });

  it("GET /dashboard/summary returns KPIs for the api key", async () => {
    const now = Date.now();
    const createdAt = new Date(now - 60_000);
    const sentAt = new Date(now - 58_000);
    const deliveredAt = new Date(now - 59_000);

    prismaStore.notifications.push(
      {
        id: "notif_summary_sent",
        apiKeyId: API_KEYS.full.id,
        channel: "EMAIL",
        recipient: "a@example.com",
        subject: "Hi",
        body: "Body",
        status: "SENT",
        sentAt,
        createdAt,
      },
      {
        id: "notif_summary_failed",
        apiKeyId: API_KEYS.full.id,
        channel: "EMAIL",
        recipient: "b@example.com",
        subject: "Hi",
        body: "Body",
        status: "FAILED",
        createdAt,
      },
    );
    prismaStore.webhookEndpoints.push({
      id: "wh_summary",
      apiKeyId: API_KEYS.full.id,
      url: "https://example.com/hooks",
      secret: "whsec_test_secret_16",
      events: ["notification.sent"],
      active: true,
      createdAt,
    });
    prismaStore.webhookDeliveries.push({
      id: "del_summary_ok",
      endpointId: "wh_summary",
      notificationId: "notif_summary_sent",
      event: "notification.sent",
      statusCode: 200,
      attempts: 1,
      nextRetryAt: null,
      deliveredAt,
      createdAt,
    });

    const response = await app.inject({
      method: "GET",
      url: "/dashboard/summary?windowHours=24",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      notifications: {
        successRate: 0.5,
        sent: 1,
        failed: 1,
        averageLatencyMs: 2000,
      },
      webhooks: {
        successRate: 1,
        delivered: 1,
        failed: 0,
        averageLatencyMs: 1000,
      },
      dlq: {
        queue: "email-dlq",
        count: 4,
      },
    });
  });

  it("GET /queues returns 401 without api key", async () => {
    const response = await app.inject({ method: "GET", url: "/queues" });
    expect(response.statusCode).toBe(401);
  });

  it("GET /notifications lists notifications for the authenticated api key", async () => {
    prismaStore.notifications.push(
      {
        id: "notif_integration_9",
        apiKeyId: API_KEYS.full.id,
        channel: "EMAIL",
        recipient: "a@example.com",
        subject: "A",
        body: "A",
        status: "SENT",
        createdAt: new Date("2026-05-23T12:00:00.000Z"),
      },
      {
        id: "notif_integration_8",
        apiKeyId: API_KEYS.full.id,
        channel: "EMAIL",
        recipient: "b@example.com",
        subject: "B",
        body: "B",
        status: "QUEUED",
        createdAt: new Date("2026-05-23T11:00:00.000Z"),
      },
      {
        id: "notif_integration_7",
        apiKeyId: API_KEYS.readOnly.id,
        channel: "EMAIL",
        recipient: "other@example.com",
        subject: "Other",
        body: "Other",
        status: "SENT",
        createdAt: new Date("2026-05-23T10:00:00.000Z"),
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/notifications?limit=1",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [
        expect.objectContaining({
          id: "notif_integration_9",
          status: "sent",
          recipient: "a@example.com",
        }),
      ],
      pagination: {
        nextCursor: "notif_integration_9",
        hasMore: true,
      },
    });
  });

  it("GET /notifications supports cursor pagination", async () => {
    prismaStore.notifications.push(
      {
        id: "notif_integration_3",
        apiKeyId: API_KEYS.full.id,
        channel: "EMAIL",
        recipient: "a@example.com",
        subject: "A",
        body: "A",
        status: "SENT",
        createdAt: new Date("2026-05-23T12:00:00.000Z"),
      },
      {
        id: "notif_integration_2",
        apiKeyId: API_KEYS.full.id,
        channel: "EMAIL",
        recipient: "b@example.com",
        subject: "B",
        body: "B",
        status: "QUEUED",
        createdAt: new Date("2026-05-23T11:00:00.000Z"),
      },
      {
        id: "notif_integration_1",
        apiKeyId: API_KEYS.full.id,
        channel: "EMAIL",
        recipient: "c@example.com",
        subject: "C",
        body: "C",
        status: "FAILED",
        createdAt: new Date("2026-05-23T10:00:00.000Z"),
      },
    );

    const firstPage = await app.inject({
      method: "GET",
      url: "/notifications?limit=2",
      headers: authHeader(API_KEYS.full.raw),
    });

    const firstBody = firstPage.json<{
      pagination: { nextCursor: string };
    }>();

    const secondPage = await app.inject({
      method: "GET",
      url: `/notifications?limit=2&cursor=${firstBody.pagination.nextCursor}`,
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.json()).toEqual({
      data: [
        expect.objectContaining({ id: "notif_integration_1" }),
      ],
      pagination: {
        nextCursor: null,
        hasMore: false,
      },
    });
  });

  it("GET /notifications returns 400 for invalid query params", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/notifications?limit=500",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "validation_error" });
  });
});

describe("API integration — webhooks", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    seedIntegrationApiKeys();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 1000,
      remaining: 999,
      resetAt: Math.floor(Date.now() / 1000) + 60,
    });
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  const webhookPayload = {
    url: "https://example.com/hooks/pingora",
    secret: "whsec_test_secret_16",
    events: ["notification.sent"],
  };

  it("POST /webhooks/endpoints returns 403 without write scope", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/endpoints",
      headers: {
        ...authHeader(API_KEYS.readOnly.raw),
        "content-type": "application/json",
      },
      payload: webhookPayload,
    });

    expect(response.statusCode).toBe(403);
  });

  it("POST /webhooks/endpoints returns 400 for invalid payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/endpoints",
      headers: {
        ...authHeader(API_KEYS.full.raw),
        "content-type": "application/json",
      },
      payload: { ...webhookPayload, url: "not-a-url" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "validation_error" });
  });

  it("POST /webhooks/endpoints creates an endpoint with secret", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/endpoints",
      headers: {
        ...authHeader(API_KEYS.full.raw),
        "content-type": "application/json",
      },
      payload: webhookPayload,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      url: webhookPayload.url,
      secret: webhookPayload.secret,
      events: webhookPayload.events,
      active: true,
      _links: {
        self: expect.stringMatching(/^\/webhooks\/endpoints\/wh_integration_/),
      },
    });
    expect(prismaStore.webhookEndpoints).toHaveLength(1);
  });

  it("GET /webhooks/endpoints lists endpoints without secrets", async () => {
    prismaStore.webhookEndpoints.push({
      id: "wh_integration_9",
      apiKeyId: API_KEYS.full.id,
      url: webhookPayload.url,
      secret: webhookPayload.secret,
      events: ["notification.sent"],
      active: true,
      createdAt: new Date("2026-05-23T12:00:00.000Z"),
    });

    const response = await app.inject({
      method: "GET",
      url: "/webhooks/endpoints",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [
        expect.objectContaining({
          id: "wh_integration_9",
          url: webhookPayload.url,
          events: ["notification.sent"],
        }),
      ],
    });
    expect(response.json().data[0]).not.toHaveProperty("secret");
  });

  it("GET /webhooks/deliveries lists deliveries with derived status", async () => {
    prismaStore.webhookEndpoints.push({
      id: "wh_delivery",
      apiKeyId: API_KEYS.full.id,
      url: webhookPayload.url,
      secret: webhookPayload.secret,
      events: ["notification.sent", "notification.failed"],
      active: true,
      createdAt: new Date("2026-05-23T12:00:00.000Z"),
    });
    prismaStore.webhookDeliveries.push(
      {
        id: "del_ok",
        endpointId: "wh_delivery",
        notificationId: "notif_1",
        event: "notification.sent",
        statusCode: 200,
        attempts: 1,
        nextRetryAt: null,
        deliveredAt: new Date("2026-05-23T12:00:01.500Z"),
        createdAt: new Date("2026-05-23T12:00:00.000Z"),
      },
      {
        id: "del_retry",
        endpointId: "wh_delivery",
        notificationId: "notif_2",
        event: "notification.failed",
        statusCode: 503,
        attempts: 1,
        nextRetryAt: new Date("2026-05-23T12:01:00.000Z"),
        deliveredAt: null,
        createdAt: new Date("2026-05-23T12:00:00.000Z"),
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/webhooks/deliveries?limit=10",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        expect.objectContaining({
          id: "del_retry",
          status: "retrying",
          attempts: 1,
        }),
        expect.objectContaining({
          id: "del_ok",
          status: "success",
          latencyMs: 1500,
        }),
      ],
      pagination: { hasMore: false, nextCursor: null },
    });
  });

  it("DELETE /webhooks/endpoints/:id removes owned endpoints", async () => {
    prismaStore.webhookEndpoints.push({
      id: "wh_integration_3",
      apiKeyId: API_KEYS.full.id,
      url: webhookPayload.url,
      secret: webhookPayload.secret,
      events: ["notification.failed"],
      active: true,
      createdAt: new Date("2026-05-23T12:00:00.000Z"),
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/webhooks/endpoints/wh_integration_3",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(204);
    expect(prismaStore.webhookEndpoints).toHaveLength(0);
  });

  it("DELETE /webhooks/endpoints/:id returns 404 for unknown or foreign endpoints", async () => {
    prismaStore.webhookEndpoints.push({
      id: "wh_integration_other",
      apiKeyId: API_KEYS.readOnly.id,
      url: webhookPayload.url,
      secret: webhookPayload.secret,
      events: ["notification.sent"],
      active: true,
      createdAt: new Date("2026-05-23T12:00:00.000Z"),
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/webhooks/endpoints/wh_integration_other",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(404);
    expect(prismaStore.webhookEndpoints).toHaveLength(1);
  });
});

describe("API integration — inbound webhooks", () => {
  let app: FastifyInstance;
  const inboundSecret = "whsec_inbound_test_secret";

  beforeEach(async () => {
    seedIntegrationApiKeys();
    inboundIdempotencyKeys.clear();
    process.env.INBOUND_WEBHOOK_SECRET = inboundSecret;
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 1000,
      remaining: 999,
      resetAt: Math.floor(Date.now() / 1000) + 60,
    });
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.INBOUND_WEBHOOK_SECRET;
    vi.clearAllMocks();
  });

  it("accepts a valid signed payload without API key", async () => {
    const body = JSON.stringify({
      id: "evt_integration_1",
      type: "provider.ping",
      data: { ok: true },
    });
    const { header } = signWebhookPayload(inboundSecret, body);

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/inbound",
      headers: {
        "content-type": "application/json",
        [WEBHOOK_SIGNATURE_HEADER]: header,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      received: true,
      id: "evt_integration_1",
      type: "provider.ping",
      duplicate: false,
    });
  });

  it("returns 401 for an invalid signature", async () => {
    const body = JSON.stringify({
      id: "evt_integration_2",
      type: "provider.ping",
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/inbound",
      headers: {
        "content-type": "application/json",
        [WEBHOOK_SIGNATURE_HEADER]: "t=1700000000,v1=deadbeef",
      },
      payload: body,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: "unauthorized",
      message: "Invalid webhook signature",
    });
  });

  it("returns duplicate=true on replay of the same event id", async () => {
    const body = JSON.stringify({
      id: "evt_integration_dup",
      type: "provider.ping",
    });
    const { header } = signWebhookPayload(inboundSecret, body);

    const first = await app.inject({
      method: "POST",
      url: "/webhooks/inbound",
      headers: {
        "content-type": "application/json",
        [WEBHOOK_SIGNATURE_HEADER]: header,
      },
      payload: body,
    });
    const second = await app.inject({
      method: "POST",
      url: "/webhooks/inbound",
      headers: {
        "content-type": "application/json",
        [WEBHOOK_SIGNATURE_HEADER]: header,
      },
      payload: body,
    });

    expect(first.json()).toMatchObject({ duplicate: false });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({
      id: "evt_integration_dup",
      duplicate: true,
    });
  });
});
