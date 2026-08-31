import { describe, expect, it } from "vitest";
import {
  buildInboundIdempotencyKey,
  inboundWebhookBodySchema,
  INBOUND_WEBHOOK_IDEMPOTENCY_PREFIX,
} from "./inbound-webhook.js";

describe("inboundWebhookBodySchema", () => {
  it("accepts a valid payload and defaults data", () => {
    const result = inboundWebhookBodySchema.safeParse({
      id: "evt_123",
      type: "provider.ping",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toEqual({});
    }
  });

  it("rejects missing id", () => {
    expect(
      inboundWebhookBodySchema.safeParse({ type: "provider.ping" }).success,
    ).toBe(false);
  });

  it("rejects invalid createdAt", () => {
    expect(
      inboundWebhookBodySchema.safeParse({
        id: "evt_1",
        type: "x",
        createdAt: "yesterday",
      }).success,
    ).toBe(false);
  });
});

describe("buildInboundIdempotencyKey", () => {
  it("prefixes the event id", () => {
    expect(buildInboundIdempotencyKey("evt_1")).toBe(
      `${INBOUND_WEBHOOK_IDEMPOTENCY_PREFIX}evt_1`,
    );
  });
});
