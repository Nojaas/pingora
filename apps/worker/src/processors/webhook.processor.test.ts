import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockDeliver = vi.fn();

vi.mock("@pingora/db", () => ({
  prisma: {
    webhookDelivery: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("../providers/webhook.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../providers/webhook.js")>();
  return {
    ...actual,
    deliverWebhookHttp: (...args: unknown[]) => mockDeliver(...args),
  };
});

const { processWebhookJob } = await import("./webhook.processor.js");

const delivery = {
  id: "whd_1",
  event: "notification.sent",
  payload: { event: "notification.sent" },
  deliveredAt: null,
  endpoint: {
    url: "https://example.com/hooks",
    secret: "whsec_test_secret_16",
    active: true,
  },
};

describe("processWebhookJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it("marks the delivery as delivered on HTTP 200", async () => {
    mockFindUnique.mockResolvedValue(delivery);
    mockDeliver.mockResolvedValue({ statusCode: 200 });

    const result = await processWebhookJob({
      data: { deliveryId: "whd_1" },
      opts: { attempts: 3 },
      attemptsMade: 0,
    } as never);

    expect(result).toEqual({ delivered: true, statusCode: 200 });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "whd_1" },
      data: expect.objectContaining({
        statusCode: 200,
        nextRetryAt: null,
      }),
    });
  });

  it("throws UnrecoverableError on 4xx so BullMQ does not retry", async () => {
    const { WebhookDeliveryError } = await import("../providers/webhook.js");
    mockFindUnique.mockResolvedValue(delivery);
    mockDeliver.mockRejectedValue(
      new WebhookDeliveryError("Webhook endpoint returned 400", 400, false),
    );

    await expect(
      processWebhookJob({
        data: { deliveryId: "whd_1" },
        opts: { attempts: 3 },
        attemptsMade: 0,
      } as never),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "whd_1" },
      data: expect.objectContaining({
        statusCode: 400,
        nextRetryAt: null,
      }),
    });
  });

  it("rethrows retryable 5xx after recording nextRetryAt", async () => {
    const { WebhookDeliveryError } = await import("../providers/webhook.js");
    mockFindUnique.mockResolvedValue(delivery);
    mockDeliver.mockRejectedValue(
      new WebhookDeliveryError("Webhook endpoint returned 503", 503, true),
    );

    await expect(
      processWebhookJob({
        data: { deliveryId: "whd_1" },
        opts: { attempts: 3 },
        attemptsMade: 0,
      } as never),
    ).rejects.toMatchObject({ retryable: true, statusCode: 503 });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "whd_1" },
      data: expect.objectContaining({
        statusCode: 503,
        nextRetryAt: expect.any(Date),
      }),
    });
  });
});
