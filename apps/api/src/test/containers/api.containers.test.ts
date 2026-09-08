import { prisma } from "@pingora/db";
import {
  API_KEY_HEADER,
  hashApiKey,
  SCOPES,
  signWebhookPayload,
  WEBHOOK_SIGNATURE_HEADER,
} from "@pingora/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { closeRedisClient } from "../../lib/redis.js";
import { API_KEYS } from "../prisma-store.js";

async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

function authHeader(rawKey: string) {
  return { [API_KEY_HEADER]: rawKey };
}

async function resetDatabase() {
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookEndpoint.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.apiKey.deleteMany();
}

async function seedApiKeys() {
  await prisma.apiKey.createMany({
    data: [
      {
        id: API_KEYS.full.id,
        name: API_KEYS.full.name,
        keyHash: hashApiKey(API_KEYS.full.raw),
        prefix: API_KEYS.full.prefix,
        scopes: [...API_KEYS.full.scopes],
        rateLimit: API_KEYS.full.rateLimit,
        revoked: false,
      },
      {
        id: API_KEYS.readOnly.id,
        name: API_KEYS.readOnly.name,
        keyHash: hashApiKey(API_KEYS.readOnly.raw),
        prefix: API_KEYS.readOnly.prefix,
        scopes: [...API_KEYS.readOnly.scopes],
        rateLimit: API_KEYS.readOnly.rateLimit,
        revoked: false,
      },
      {
        id: API_KEYS.revoked.id,
        name: API_KEYS.revoked.name,
        keyHash: hashApiKey(API_KEYS.revoked.raw),
        prefix: API_KEYS.revoked.prefix,
        scopes: [...API_KEYS.revoked.scopes],
        rateLimit: API_KEYS.revoked.rateLimit,
        revoked: true,
      },
    ],
  });
}

describe("API containers — real Postgres + Redis", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedApiKeys();
  });

  afterAll(async () => {
    await app.close();
    await closeRedisClient();
    await prisma.$disconnect();
  });

  it("GET /health is public", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "pingora-api",
    });
  });

  it("GET /me authenticates against a real ApiKey row", async () => {
    const ok = await app.inject({
      method: "GET",
      url: "/me",
      headers: authHeader(API_KEYS.full.raw),
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      apiKey: {
        id: API_KEYS.full.id,
        name: API_KEYS.full.name,
        scopes: expect.arrayContaining([SCOPES.NOTIFICATIONS_WRITE]),
      },
    });

    const revoked = await app.inject({
      method: "GET",
      url: "/me",
      headers: authHeader(API_KEYS.revoked.raw),
    });
    expect(revoked.statusCode).toBe(401);
  });

  it("POST /notifications persists a QUEUED email notification", async () => {
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
        subject: "Containers",
        body: "Hello from Testcontainers",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: "queued",
      channel: "email",
      recipient: "user@example.com",
    });

    const stored = await prisma.notification.findFirst({
      where: { apiKeyId: API_KEYS.full.id },
    });
    expect(stored).toMatchObject({
      status: "QUEUED",
      channel: "EMAIL",
      recipient: "user@example.com",
      subject: "Containers",
    });
    expect(stored?.jobId).toBeTruthy();
  });

  it("GET /notifications lists rows from Postgres with cursor filters", async () => {
    await prisma.notification.createMany({
      data: [
        {
          id: "notif_containers_a",
          apiKeyId: API_KEYS.full.id,
          channel: "EMAIL",
          recipient: "a@example.com",
          subject: "A",
          body: "A",
          status: "SENT",
        },
        {
          id: "notif_containers_b",
          apiKeyId: API_KEYS.full.id,
          channel: "EMAIL",
          recipient: "b@example.com",
          subject: "B",
          body: "B",
          status: "FAILED",
        },
        {
          id: "notif_containers_other",
          apiKeyId: API_KEYS.readOnly.id,
          channel: "EMAIL",
          recipient: "other@example.com",
          subject: "Other",
          body: "Other",
          status: "SENT",
        },
      ],
    });

    const response = await app.inject({
      method: "GET",
      url: "/notifications?limit=10&status=sent",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        expect.objectContaining({
          id: "notif_containers_a",
          status: "sent",
        }),
      ],
      pagination: { hasMore: false },
    });
    expect(response.json().data).toHaveLength(1);
  });

  it("GET /queues reads real BullMQ counts from Redis", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/queues",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(200);
    expect(
      response.json().data.map((queue: { name: string }) => queue.name),
    ).toEqual(["email", "email-dlq", "webhook"]);
    expect(response.json().data[0]?.counts).toEqual(
      expect.objectContaining({
        waiting: expect.any(Number),
        active: expect.any(Number),
        completed: expect.any(Number),
        failed: expect.any(Number),
      }),
    );
  });

  it("rate limiting uses Redis and returns X-RateLimit headers", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/me",
      headers: authHeader(API_KEYS.full.raw),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-ratelimit-limit"]).toBe("1000");
    expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
  });

  it("POST /webhooks/inbound deduplicates via Redis", async () => {
    const secret = process.env.INBOUND_WEBHOOK_SECRET!;
    const body = JSON.stringify({
      id: "evt_containers_1",
      type: "provider.test",
      data: { ok: true },
    });
    const signed = signWebhookPayload(secret, body);

    const first = await app.inject({
      method: "POST",
      url: "/webhooks/inbound",
      headers: {
        "content-type": "application/json",
        [WEBHOOK_SIGNATURE_HEADER]: signed.header,
      },
      payload: body,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      received: true,
      id: "evt_containers_1",
      duplicate: false,
    });

    const second = await app.inject({
      method: "POST",
      url: "/webhooks/inbound",
      headers: {
        "content-type": "application/json",
        [WEBHOOK_SIGNATURE_HEADER]: signed.header,
      },
      payload: body,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({
      received: true,
      id: "evt_containers_1",
      duplicate: true,
    });
  });
});
