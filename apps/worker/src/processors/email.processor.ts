import { prisma } from "@pingora/db";
import {
  areJobAttemptsExhausted,
  EMAIL_JOB_ATTEMPTS,
  EMAIL_QUEUE_NAME,
  emailJobDataSchema,
  getExponentialBackoffDelayMs,
  getRedisConnectionOptions,
  isFinalJobAttempt,
  WEBHOOK_EVENTS,
} from "@pingora/shared";
import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { dispatchNotificationWebhooks } from "../lib/dispatch-webhooks.js";
import { moveExhaustedEmailJobToDlq } from "../lib/exhausted-job.js";
import { childLogger } from "../lib/logger.js";
import { sendEmail } from "../providers/email.js";

const log = childLogger("email");

async function processEmailJob(job: Job) {
  const parsed = emailJobDataSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job payload: ${parsed.error.message}`);
  }

  const { notificationId } = parsed.data;
  const maxAttempts = job.opts.attempts ?? EMAIL_JOB_ATTEMPTS;

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new Error(`Notification ${notificationId} not found`);
  }

  if (notification.channel !== "EMAIL") {
    throw new Error(
      `Notification ${notificationId} is not an email (channel=${notification.channel})`,
    );
  }

  if (notification.status === "SENT" || notification.status === "CANCELLED") {
    return { skipped: true, status: notification.status };
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { attempts: { increment: 1 } },
  });

  try {
    if (!notification.subject) {
      throw new Error("Email subject is required");
    }

    const messageId = await sendEmail({
      to: notification.recipient,
      subject: notification.subject,
      body: notification.body,
    });

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        failedAt: null,
        error: null,
      },
    });

    await dispatchNotificationWebhooksSafely(
      notificationId,
      WEBHOOK_EVENTS.NOTIFICATION_SENT,
    );

    return { messageId, status: "SENT" as const };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown email send error";

    const finalAttempt = isFinalJobAttempt(job.attemptsMade, maxAttempts);

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: finalAttempt ? "FAILED" : "QUEUED",
        ...(finalAttempt ? { failedAt: new Date() } : {}),
        error: message,
      },
    });

    if (finalAttempt) {
      await dispatchNotificationWebhooksSafely(
        notificationId,
        WEBHOOK_EVENTS.NOTIFICATION_FAILED,
      );
    }

    throw error instanceof Error ? error : new Error(message);
  }
}

async function dispatchNotificationWebhooksSafely(
  notificationId: string,
  event: (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS],
) {
  try {
    const result = await dispatchNotificationWebhooks(notificationId, event);
    if (result.enqueued > 0) {
      log.info(
        {
          notificationId,
          event,
          enqueued: result.enqueued,
        },
        "webhooks dispatched",
      );
    }
  } catch (error) {
    log.error(
      {
        notificationId,
        event,
        err: error instanceof Error ? error : { message: String(error) },
      },
      "webhook dispatch failed",
    );
  }
}

export function startEmailWorker() {
  const worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: getRedisConnectionOptions(),
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    log.info({ jobId: job.id, result: job.returnvalue }, "job completed");
  });

  worker.on("failed", async (job, error) => {
    if (!job) {
      log.error({ err: error }, "job failed without job context");
      return;
    }

    const maxAttempts = job.opts.attempts ?? EMAIL_JOB_ATTEMPTS;
    const exhausted = areJobAttemptsExhausted(job.attemptsMade, maxAttempts);

    if (exhausted) {
      try {
        const dlqJobId = await moveExhaustedEmailJobToDlq(job, error);
        log.error(
          {
            jobId: job.id,
            dlqJobId,
            attempts: maxAttempts,
            err: error,
          },
          "job moved to DLQ",
        );
      } catch (dlqError) {
        log.error(
          {
            jobId: job.id,
            err:
              dlqError instanceof Error
                ? dlqError
                : { message: String(dlqError) },
          },
          "DLQ enqueue failed after exhausted attempts",
        );
      }
      return;
    }

    const retryInMs = getExponentialBackoffDelayMs(job.attemptsMade);
    log.warn(
      {
        jobId: job.id,
        attempt: job.attemptsMade,
        maxAttempts,
        retryInMs,
        err: error,
      },
      "job failed, will retry",
    );
  });

  return worker;
}
