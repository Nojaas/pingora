import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockDelete = vi.fn();
const mockDeliveryFindMany = vi.fn();

vi.mock("@pingora/db", () => ({
  prisma: {
    webhookEndpoint: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    webhookDelivery: {
      findMany: (...args: unknown[]) => mockDeliveryFindMany(...args),
    },
  },
}));

const {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
  toWebhookDeliveryResponse,
  toWebhookEndpointResponse,
} = await import("./webhook.service.js");

const apiKeyId = "key_test_123";

const createdRecord = {
  id: "wh_1",
  url: "https://example.com/hooks",
  secret: "whsec_test_secret_16",
  events: ["notification.sent"],
  active: true,
  createdAt: new Date("2026-05-23T12:00:00.000Z"),
};

describe("createWebhookEndpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists and returns the endpoint including secret", async () => {
    mockCreate.mockResolvedValue(createdRecord);

    const result = await createWebhookEndpoint(apiKeyId, {
      url: createdRecord.url,
      secret: createdRecord.secret,
      events: ["notification.sent"],
      active: true,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        apiKeyId,
        url: createdRecord.url,
        secret: createdRecord.secret,
        events: ["notification.sent"],
        active: true,
      },
    });
    expect(result).toEqual({
      id: "wh_1",
      url: createdRecord.url,
      secret: createdRecord.secret,
      events: ["notification.sent"],
      active: true,
      createdAt: "2026-05-23T12:00:00.000Z",
      _links: { self: "/webhooks/endpoints/wh_1" },
    });
  });
});

describe("listWebhookEndpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists endpoints for the api key without secrets", async () => {
    mockFindMany.mockResolvedValue([createdRecord]);

    const result = await listWebhookEndpoints(apiKeyId);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { apiKeyId },
      orderBy: { createdAt: "desc" },
    });
    expect(result.data[0]).toEqual({
      id: "wh_1",
      url: createdRecord.url,
      events: ["notification.sent"],
      active: true,
      createdAt: "2026-05-23T12:00:00.000Z",
      _links: { self: "/webhooks/endpoints/wh_1" },
    });
    expect(result.data[0]).not.toHaveProperty("secret");
  });
});

describe("listWebhookDeliveries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists deliveries scoped to the api key with derived status", async () => {
    mockDeliveryFindMany.mockResolvedValue([
      {
        id: "del_2",
        endpointId: "wh_1",
        notificationId: "notif_1",
        event: "notification.sent",
        statusCode: 200,
        attempts: 1,
        nextRetryAt: null,
        deliveredAt: new Date("2026-05-23T12:00:02.000Z"),
        createdAt: new Date("2026-05-23T12:00:00.000Z"),
      },
      {
        id: "del_1",
        endpointId: "wh_1",
        notificationId: "notif_2",
        event: "notification.failed",
        statusCode: 500,
        attempts: 3,
        nextRetryAt: null,
        deliveredAt: null,
        createdAt: new Date("2026-05-23T11:00:00.000Z"),
      },
    ]);

    const result = await listWebhookDeliveries(apiKeyId, {
      limit: 20,
      status: "failed",
    });

    expect(mockDeliveryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          endpoint: { apiKeyId },
          deliveredAt: null,
          nextRetryAt: null,
          attempts: { gt: 0 },
        }),
        take: 21,
      }),
    );
    expect(result.data[0]?.status).toBe("success");
    expect(result.data[0]?.latencyMs).toBe(2000);
    expect(result.data[1]?.status).toBe("failed");
    expect(result.pagination.hasMore).toBe(false);
  });
});

describe("deleteWebhookEndpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when the endpoint is missing or not owned", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(deleteWebhookEndpoint(apiKeyId, "wh_missing")).resolves.toBe(
      false,
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes when the endpoint belongs to the api key", async () => {
    mockFindFirst.mockResolvedValue({ id: "wh_1" });
    mockDelete.mockResolvedValue({});

    await expect(deleteWebhookEndpoint(apiKeyId, "wh_1")).resolves.toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "wh_1" } });
  });
});

describe("toWebhookEndpointResponse", () => {
  it("omits secret unless explicitly requested", () => {
    expect(
      toWebhookEndpointResponse(createdRecord, { includeSecret: false }),
    ).not.toHaveProperty("secret");
  });
});

describe("toWebhookDeliveryResponse", () => {
  it("marks retrying deliveries", () => {
    expect(
      toWebhookDeliveryResponse({
        id: "del_r",
        endpointId: "wh_1",
        notificationId: "notif_1",
        event: "notification.sent",
        statusCode: 503,
        attempts: 1,
        nextRetryAt: new Date("2026-05-23T12:01:00.000Z"),
        deliveredAt: null,
        createdAt: new Date("2026-05-23T12:00:00.000Z"),
      }).status,
    ).toBe("retrying");
  });
});
