import { describe, expect, it } from "vitest";
import {
  createWebhookEndpointBodySchema,
  deriveWebhookDeliveryStatus,
  listWebhookDeliveriesQuerySchema,
  WEBHOOK_EVENTS,
} from "./webhook.js";

const validPayload = {
  url: "https://example.com/hooks/pingora",
  secret: "whsec_test_secret_16",
  events: [WEBHOOK_EVENTS.NOTIFICATION_SENT],
};

describe("createWebhookEndpointBodySchema", () => {
  it("accepts a valid payload and defaults active to true", () => {
    const result = createWebhookEndpointBodySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active).toBe(true);
    }
  });

  it("accepts both known events", () => {
    const result = createWebhookEndpointBodySchema.safeParse({
      ...validPayload,
      events: [
        WEBHOOK_EVENTS.NOTIFICATION_SENT,
        WEBHOOK_EVENTS.NOTIFICATION_FAILED,
      ],
      active: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid urls", () => {
    const result = createWebhookEndpointBodySchema.safeParse({
      ...validPayload,
      url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short secrets", () => {
    const result = createWebhookEndpointBodySchema.safeParse({
      ...validPayload,
      secret: "too-short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty events", () => {
    const result = createWebhookEndpointBodySchema.safeParse({
      ...validPayload,
      events: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown events", () => {
    const result = createWebhookEndpointBodySchema.safeParse({
      ...validPayload,
      events: ["notification.unknown"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate events", () => {
    const result = createWebhookEndpointBodySchema.safeParse({
      ...validPayload,
      events: [
        WEBHOOK_EVENTS.NOTIFICATION_SENT,
        WEBHOOK_EVENTS.NOTIFICATION_SENT,
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("listWebhookDeliveriesQuerySchema", () => {
  it("applies defaults", () => {
    const result = listWebhookDeliveriesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it("accepts status filters", () => {
    const result = listWebhookDeliveriesQuerySchema.safeParse({
      status: "retrying",
      limit: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("retrying");
      expect(result.data.limit).toBe(10);
    }
  });
});

describe("deriveWebhookDeliveryStatus", () => {
  it("maps delivery fields to status", () => {
    expect(
      deriveWebhookDeliveryStatus({
        deliveredAt: new Date(),
        nextRetryAt: null,
        attempts: 1,
      }),
    ).toBe("success");
    expect(
      deriveWebhookDeliveryStatus({
        deliveredAt: null,
        nextRetryAt: new Date(),
        attempts: 1,
      }),
    ).toBe("retrying");
    expect(
      deriveWebhookDeliveryStatus({
        deliveredAt: null,
        nextRetryAt: null,
        attempts: 2,
      }),
    ).toBe("failed");
    expect(
      deriveWebhookDeliveryStatus({
        deliveredAt: null,
        nextRetryAt: null,
        attempts: 0,
      }),
    ).toBe("pending");
  });
});
