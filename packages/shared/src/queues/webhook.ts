import type { BackoffOptions, JobsOptions } from "bullmq";
import { z } from "zod";
import { webhookEventSchema } from "../schemas/webhook.js";
import { toApiChannel, toApiStatus } from "../schemas/notification.js";

export const WEBHOOK_QUEUE_NAME = "webhook" as const;

export const WEBHOOK_JOB_NAME = "deliver-webhook" as const;

export const WEBHOOK_JOB_ATTEMPTS = 3;

export const WEBHOOK_JOB_BACKOFF_DELAY_MS = 1_000;

export const WEBHOOK_DELIVERY_TIMEOUT_MS = 10_000;

export const WEBHOOK_JOB_BACKOFF: BackoffOptions = {
  type: "exponential",
  delay: WEBHOOK_JOB_BACKOFF_DELAY_MS,
};

export const WEBHOOK_JOB_DEFAULT_OPTIONS = {
  attempts: WEBHOOK_JOB_ATTEMPTS,
  backoff: WEBHOOK_JOB_BACKOFF,
  removeOnComplete: 200,
  removeOnFail: 1_000,
} satisfies Pick<
  JobsOptions,
  "attempts" | "backoff" | "removeOnComplete" | "removeOnFail"
>;

export const webhookJobDataSchema = z.object({
  deliveryId: z.string().min(1),
});

export type WebhookJobData = z.infer<typeof webhookJobDataSchema>;

export type WebhookEventPayload = {
  event: z.infer<typeof webhookEventSchema>;
  notification: {
    id: string;
    status: string;
    channel: string;
    recipient: string;
  };
  timestamp: string;
};

export function buildWebhookEventPayload(params: {
  event: z.infer<typeof webhookEventSchema>;
  notification: {
    id: string;
    status: "PENDING" | "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
    channel: "EMAIL" | "SMS" | "PUSH";
    recipient: string;
  };
  timestamp?: Date;
}): WebhookEventPayload {
  return {
    event: params.event,
    notification: {
      id: params.notification.id,
      status: toApiStatus(params.notification.status),
      channel: toApiChannel(params.notification.channel),
      recipient: params.notification.recipient,
    },
    timestamp: (params.timestamp ?? new Date()).toISOString(),
  };
}

/** Retry on 5xx only — 4xx are treated as permanent failures. */
export function isRetryableWebhookStatus(statusCode: number): boolean {
  return statusCode >= 500 && statusCode <= 599;
}
