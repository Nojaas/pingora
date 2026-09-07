import { prisma } from "@pingora/db";
import {
  getExponentialBackoffDelayMs,
  getRedisConnectionOptions,
  isFinalJobAttempt,
  signWebhookPayload,
  WEBHOOK_JOB_ATTEMPTS,
  WEBHOOK_JOB_BACKOFF_DELAY_MS,
  WEBHOOK_QUEUE_NAME,
  webhookJobDataSchema,
} from "@pingora/shared";
import type { Job } from "bullmq";
import { UnrecoverableError, Worker } from "bullmq";
import { childLogger } from "../lib/logger.js";
import {
  deliverWebhookHttp,
  WebhookDeliveryError,
} from "../providers/webhook.js";

const log = childLogger("webhook");

export async function processWebhookJob(job: Job) {
  const parsed = webhookJobDataSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new UnrecoverableError(
      `Invalid webhook job: ${parsed.error.message}`,
    );
  }

  const { deliveryId } = parsed.data;
  const maxAttempts = job.opts.attempts ?? WEBHOOK_JOB_ATTEMPTS;

  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });

  if (!delivery) {
    throw new UnrecoverableError(`Webhook delivery ${deliveryId} not found`);
  }

  if (!delivery.endpoint.active) {
    return { skipped: true, reason: "endpoint_inactive" as const };
  }

  if (delivery.deliveredAt) {
    return { skipped: true, reason: "already_delivered" as const };
  }

  const rawBody = JSON.stringify(delivery.payload);
  const { header } = signWebhookPayload(delivery.endpoint.secret, rawBody);

  try {
    const { statusCode } = await deliverWebhookHttp({
      url: delivery.endpoint.url,
      rawBody,
      signatureHeader: header,
      event: delivery.event,
    });

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attempts: { increment: 1 },
        statusCode,
        deliveredAt: new Date(),
        nextRetryAt: null,
      },
    });

    return { delivered: true, statusCode };
  } catch (error) {
    const deliveryError =
      error instanceof WebhookDeliveryError
        ? error
        : new WebhookDeliveryError(
            error instanceof Error ? error.message : "Webhook delivery failed",
            null,
            true,
          );

    const finalAttempt = isFinalJobAttempt(job.attemptsMade, maxAttempts);
    const willRetry = deliveryError.retryable && !finalAttempt;
    const retryInMs = getExponentialBackoffDelayMs(
      job.attemptsMade + 1,
      WEBHOOK_JOB_BACKOFF_DELAY_MS,
    );

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attempts: { increment: 1 },
        statusCode: deliveryError.statusCode,
        nextRetryAt: willRetry ? new Date(Date.now() + retryInMs) : null,
      },
    });

    if (!deliveryError.retryable) {
      throw new UnrecoverableError(deliveryError.message);
    }

    throw deliveryError;
  }
}

export function startWebhookWorker() {
  const worker = new Worker(WEBHOOK_QUEUE_NAME, processWebhookJob, {
    connection: getRedisConnectionOptions(),
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    log.info({ jobId: job.id, result: job.returnvalue }, "job completed");
  });

  worker.on("failed", (job, error) => {
    log.error({ jobId: job?.id, err: error }, "job failed");
  });

  return worker;
}
