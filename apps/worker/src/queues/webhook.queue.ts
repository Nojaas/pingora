import {
  getRedisConnectionOptions,
  WEBHOOK_JOB_DEFAULT_OPTIONS,
  WEBHOOK_JOB_NAME,
  WEBHOOK_QUEUE_NAME,
  type WebhookJobData,
} from "@pingora/shared";
import { Queue } from "bullmq";

let webhookQueue: Queue<WebhookJobData> | undefined;

export function getWebhookQueue(): Queue<WebhookJobData> {
  webhookQueue ??= new Queue<WebhookJobData>(WEBHOOK_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: WEBHOOK_JOB_DEFAULT_OPTIONS,
  });

  return webhookQueue;
}

export async function enqueueWebhookDelivery(deliveryId: string) {
  const queue = getWebhookQueue();
  const jobId = `webhook-${deliveryId}`;

  const job = await queue.add(WEBHOOK_JOB_NAME, { deliveryId }, { jobId });

  return job.id ?? jobId;
}
