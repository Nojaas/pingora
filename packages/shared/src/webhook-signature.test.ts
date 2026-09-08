import { describe, expect, it } from "vitest";
import {
  buildWebhookSignedPayload,
  parseWebhookSignatureHeader,
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_SIGNATURE_SCHEME,
} from "./webhook-signature.js";

const secret = "whsec_test_secret_abc123";
const body = JSON.stringify({
  event: "notification.sent",
  id: "notif_1",
});

describe("signWebhookPayload", () => {
  it("produces a t=,v1= header with hex digest", () => {
    const signed = signWebhookPayload(secret, body, 1_700_000_000);

    expect(signed.timestamp).toBe(1_700_000_000);
    expect(signed.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(signed.header).toBe(
      `t=1700000000,${WEBHOOK_SIGNATURE_SCHEME}=${signed.signature}`,
    );
  });

  it("is deterministic for the same secret, body and timestamp", () => {
    const a = signWebhookPayload(secret, body, 1_700_000_000);
    const b = signWebhookPayload(secret, body, 1_700_000_000);
    expect(a.signature).toBe(b.signature);
  });

  it("rejects an empty secret", () => {
    expect(() => signWebhookPayload("", body)).toThrow(
      "Webhook secret is required",
    );
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a valid round-trip signature", () => {
    const signed = signWebhookPayload(secret, body, 1_700_000_000);

    expect(
      verifyWebhookSignature(secret, body, signed.header, {
        now: 1_700_000_000,
      }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signed = signWebhookPayload(secret, body, 1_700_000_000);

    expect(
      verifyWebhookSignature(secret, `${body}x`, signed.header, {
        now: 1_700_000_000,
      }),
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const signed = signWebhookPayload(secret, body, 1_700_000_000);

    expect(
      verifyWebhookSignature("other_secret", body, signed.header, {
        now: 1_700_000_000,
      }),
    ).toBe(false);
  });

  it("rejects an expired timestamp outside tolerance", () => {
    const signed = signWebhookPayload(secret, body, 1_700_000_000);

    expect(
      verifyWebhookSignature(secret, body, signed.header, {
        now: 1_700_000_000 + 301,
        toleranceSeconds: 300,
      }),
    ).toBe(false);
  });

  it("accepts a timestamp within tolerance", () => {
    const signed = signWebhookPayload(secret, body, 1_700_000_000);

    expect(
      verifyWebhookSignature(secret, body, signed.header, {
        now: 1_700_000_000 + 60,
        toleranceSeconds: 300,
      }),
    ).toBe(true);
  });

  it("rejects a malformed header", () => {
    expect(
      verifyWebhookSignature(secret, body, "not-a-signature", {
        now: 1_700_000_000,
      }),
    ).toBe(false);
  });
});

describe("parseWebhookSignatureHeader", () => {
  it("parses t and v1 in any order", () => {
    expect(parseWebhookSignatureHeader("v1=deadbeef,t=42")).toEqual({
      timestamp: 42,
      signature: "deadbeef",
    });
  });

  it("returns null when required parts are missing", () => {
    expect(parseWebhookSignatureHeader("t=42")).toBeNull();
    expect(parseWebhookSignatureHeader("v1=abc")).toBeNull();
  });
});

describe("buildWebhookSignedPayload", () => {
  it("joins timestamp and raw body with a dot", () => {
    expect(buildWebhookSignedPayload(10, '{"a":1}')).toBe('10.{"a":1}');
  });
});

describe("constants", () => {
  it("exposes the canonical header name", () => {
    expect(WEBHOOK_SIGNATURE_HEADER).toBe("x-pingora-signature");
  });
});
