import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockEnqueue = vi.fn();

vi.mock("@pingora/db", () => ({
  prisma: {
    notification: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    webhookEndpoint: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    webhookDelivery: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
  Prisma: {},
}));

vi.mock("../queues/webhook.queue.js", () => ({
  enqueueWebhookDelivery: (...args: unknown[]) => mockEnqueue(...args),
}));

const { dispatchNotificationWebhooks } = await import("./dispatch-webhooks.js");

describe("dispatchNotificationWebhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a delivery and enqueues a job per matching endpoint", async () => {
    mockFindUnique.mockResolvedValue({
      id: "notif_1",
      apiKeyId: "key_1",
      status: "SENT",
      channel: "EMAIL",
      recipient: "user@example.com",
    });
    mockFindMany.mockResolvedValue([
      {
        id: "wh_1",
        events: ["notification.sent"],
        active: true,
      },
      {
        id: "wh_2",
        events: ["notification.failed"],
        active: true,
      },
    ]);
    mockCreate.mockResolvedValue({ id: "whd_1" });
    mockEnqueue.mockResolvedValue("webhook-whd_1");

    const result = await dispatchNotificationWebhooks(
      "notif_1",
      "notification.sent",
    );

    expect(result).toEqual({ enqueued: 1 });
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        endpointId: "wh_1",
        notificationId: "notif_1",
        event: "notification.sent",
        payload: expect.objectContaining({
          event: "notification.sent",
          notification: expect.objectContaining({
            id: "notif_1",
            status: "sent",
            channel: "email",
          }),
        }),
      }),
    });
    expect(mockEnqueue).toHaveBeenCalledWith("whd_1");
  });

  it("skips endpoints that do not subscribe to the event", async () => {
    mockFindUnique.mockResolvedValue({
      id: "notif_1",
      apiKeyId: "key_1",
      status: "FAILED",
      channel: "EMAIL",
      recipient: "user@example.com",
    });
    mockFindMany.mockResolvedValue([
      {
        id: "wh_sent_only",
        events: ["notification.sent"],
        active: true,
      },
    ]);

    const result = await dispatchNotificationWebhooks(
      "notif_1",
      "notification.failed",
    );

    expect(result).toEqual({ enqueued: 0 });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
