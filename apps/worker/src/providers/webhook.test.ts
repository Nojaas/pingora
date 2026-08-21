import { afterEach, describe, expect, it, vi } from "vitest";
import { WEBHOOK_SIGNATURE_HEADER } from "@pingora/shared";
import {
  deliverWebhookHttp,
  WebhookDeliveryError,
} from "./webhook.js";

describe("deliverWebhookHttp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the signed JSON body and returns 2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await deliverWebhookHttp({
      url: "https://example.com/hooks",
      rawBody: '{"event":"notification.sent"}',
      signatureHeader: "t=1,v1=abc",
      event: "notification.sent",
    });

    expect(result).toEqual({ statusCode: 200 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/hooks",
      expect.objectContaining({
        method: "POST",
        body: '{"event":"notification.sent"}',
        headers: expect.objectContaining({
          "content-type": "application/json",
          [WEBHOOK_SIGNATURE_HEADER]: "t=1,v1=abc",
          "x-pingora-event": "notification.sent",
        }),
      }),
    );
  });

  it("marks 5xx as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    await expect(
      deliverWebhookHttp({
        url: "https://example.com/hooks",
        rawBody: "{}",
        signatureHeader: "t=1,v1=abc",
        event: "notification.sent",
      }),
    ).rejects.toMatchObject({
      name: "WebhookDeliveryError",
      statusCode: 503,
      retryable: true,
    } satisfies Partial<WebhookDeliveryError>);
  });

  it("marks 4xx as not retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400 }),
    );

    await expect(
      deliverWebhookHttp({
        url: "https://example.com/hooks",
        rawBody: "{}",
        signatureHeader: "t=1,v1=abc",
        event: "notification.sent",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      retryable: false,
    });
  });

  it("treats timeouts as retryable", async () => {
    const timeout = new Error("The operation was aborted");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));

    await expect(
      deliverWebhookHttp({
        url: "https://example.com/hooks",
        rawBody: "{}",
        signatureHeader: "t=1,v1=abc",
        event: "notification.sent",
        timeoutMs: 10,
      }),
    ).rejects.toMatchObject({
      message: "Webhook delivery timed out",
      statusCode: null,
      retryable: true,
    });
  });
});
