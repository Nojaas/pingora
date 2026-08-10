import { API_KEY_HEADER } from "@pingora/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.js";
import {
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
