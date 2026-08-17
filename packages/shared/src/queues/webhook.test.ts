import { describe, expect, it } from "vitest";
import {
  buildWebhookEventPayload,
  isRetryableWebhookStatus,
  WEBHOOK_DELIVERY_TIMEOUT_MS,
  WEBHOOK_JOB_ATTEMPTS,
  WEBHOOK_JOB_DEFAULT_OPTIONS,
  webhookJobDataSchema,
} from "./webhook.js";

describe("webhookJobDataSchema", () => {
  it("accepts a delivery id", () => {
    expect(webhookJobDataSchema.safeParse({ deliveryId: "whd_1" }).success).toBe(
      true,
    );
  });

  it("rejects an empty delivery id", () => {
    expect(webhookJobDataSchema.safeParse({ deliveryId: "" }).success).toBe(
      false,
    );
  });
});

describe("buildWebhookEventPayload", () => {
  it("maps prisma enums to API casing", () => {
    const payload = buildWebhookEventPayload({
      event: "notification.sent",
      notification: {
        id: "notif_1",
        status: "SENT",
        channel: "EMAIL",
        recipient: "user@example.com",
      },
      timestamp: new Date("2026-05-23T12:00:00.000Z"),
    });

    expect(payload).toEqual({
      event: "notification.sent",
      notification: {
        id: "notif_1",
        status: "sent",
        channel: "email",
        recipient: "user@example.com",
      },
      timestamp: "2026-05-23T12:00:00.000Z",
    });
  });
});

describe("webhook retry defaults", () => {
  it("retries 3 times with a 10s HTTP timeout", () => {
    expect(WEBHOOK_JOB_ATTEMPTS).toBe(3);
    expect(WEBHOOK_JOB_DEFAULT_OPTIONS.attempts).toBe(3);
    expect(WEBHOOK_DELIVERY_TIMEOUT_MS).toBe(10_000);
  });

  it("retries 5xx but not 4xx", () => {
    expect(isRetryableWebhookStatus(500)).toBe(true);
    expect(isRetryableWebhookStatus(503)).toBe(true);
    expect(isRetryableWebhookStatus(400)).toBe(false);
    expect(isRetryableWebhookStatus(404)).toBe(false);
    expect(isRetryableWebhookStatus(200)).toBe(false);
  });
});
