import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimInboundEvent,
  getInboundWebhookSecret,
  toInboundAck,
} from "./inbound-webhook.service.js";

describe("toInboundAck", () => {
  it("builds the ack payload", () => {
    expect(
      toInboundAck(
        { id: "evt_1", type: "provider.ping", data: {} },
        false,
      ),
    ).toEqual({
      received: true,
      id: "evt_1",
      type: "provider.ping",
      duplicate: false,
    });
  });
});

describe("claimInboundEvent", () => {
  it("returns claimed when Redis SET NX succeeds", async () => {
    const set = vi.fn().mockResolvedValue("OK");
    await expect(
      claimInboundEvent({ set } as never, "evt_1", 60),
    ).resolves.toBe("claimed");
    expect(set).toHaveBeenCalledWith(
      "pingora:inbound:evt_1",
      "1",
      "EX",
      60,
      "NX",
    );
  });

  it("returns duplicate when the key already exists", async () => {
    const set = vi.fn().mockResolvedValue(null);
    await expect(
      claimInboundEvent({ set } as never, "evt_1"),
    ).resolves.toBe("duplicate");
  });
});

describe("getInboundWebhookSecret", () => {
  const previous = process.env.INBOUND_WEBHOOK_SECRET;

  beforeEach(() => {
    delete process.env.INBOUND_WEBHOOK_SECRET;
  });

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.INBOUND_WEBHOOK_SECRET;
    } else {
      process.env.INBOUND_WEBHOOK_SECRET = previous;
    }
  });

  it("returns null when unset", () => {
    expect(getInboundWebhookSecret()).toBeNull();
  });

  it("returns the trimmed secret", () => {
    process.env.INBOUND_WEBHOOK_SECRET = "  whsec_abc  ";
    expect(getInboundWebhookSecret()).toBe("whsec_abc");
  });
});
