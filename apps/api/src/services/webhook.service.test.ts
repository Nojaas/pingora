import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockDelete = vi.fn();

vi.mock("@pingora/db", () => ({
  prisma: {
    webhookEndpoint: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

const {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookEndpoints,
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
