import {
  WEBHOOK_DELIVERY_TIMEOUT_MS,
  WEBHOOK_SIGNATURE_HEADER,
  isRetryableWebhookStatus,
} from "@pingora/shared";

export class WebhookDeliveryError extends Error {
  readonly statusCode: number | null;
  readonly retryable: boolean;

  constructor(
    message: string,
    statusCode: number | null,
    retryable: boolean,
  ) {
    super(message);
    this.name = "WebhookDeliveryError";
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export type DeliverWebhookInput = {
  url: string;
  rawBody: string;
  signatureHeader: string;
  event: string;
  timeoutMs?: number;
};

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

export async function deliverWebhookHttp(
  input: DeliverWebhookInput,
): Promise<{ statusCode: number }> {
  const timeoutMs = input.timeoutMs ?? WEBHOOK_DELIVERY_TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetch(input.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [WEBHOOK_SIGNATURE_HEADER]: input.signatureHeader,
        "x-pingora-event": input.event,
      },
      body: input.rawBody,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new WebhookDeliveryError(
        "Webhook delivery timed out",
        null,
        true,
      );
    }

    const message =
      error instanceof Error ? error.message : "Webhook delivery failed";
    throw new WebhookDeliveryError(message, null, true);
  }

  if (response.ok) {
    return { statusCode: response.status };
  }

  throw new WebhookDeliveryError(
    `Webhook endpoint returned ${response.status}`,
    response.status,
    isRetryableWebhookStatus(response.status),
  );
}
