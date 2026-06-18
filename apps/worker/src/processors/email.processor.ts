import { prisma } from "@pingora/db";
import {
  areJobAttemptsExhausted,
  EMAIL_JOB_ATTEMPTS,
  EMAIL_QUEUE_NAME,
  emailJobDataSchema,
  getExponentialBackoffDelayMs,
  getRedisConnectionOptions,
  isFinalJobAttempt,
} from "@pingora/shared";
import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { moveExhaustedEmailJobToDlq } from "../lib/exhausted-job.js";
import { sendEmail } from "../providers/email.js";

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

    throw error instanceof Error ? error : new Error(message);
  }
}

export function startEmailWorker() {
  const worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: getRedisConnectionOptions(),
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`[email] job ${job.id} completed`, job.returnvalue);
  });

  worker.on("failed", async (job, error) => {
    if (!job) {
      console.error("[email] job failed", error.message);
      return;
    }

    const maxAttempts = job.opts.attempts ?? EMAIL_JOB_ATTEMPTS;
    const exhausted = areJobAttemptsExhausted(job.attemptsMade, maxAttempts);

    if (exhausted) {
      try {
        const dlqJobId = await moveExhaustedEmailJobToDlq(job, error);
        console.error(
          `[email] job ${job.id} moved to DLQ as ${dlqJobId} after ${maxAttempts} attempts`,
          error.message,
        );
      } catch (dlqError) {
        console.error(
          `[email] job ${job.id} exhausted but DLQ enqueue failed`,
          dlqError instanceof Error ? dlqError.message : dlqError,
        );
      }
      return;
    }

    const retryInMs = getExponentialBackoffDelayMs(job.attemptsMade);
    console.warn(
      `[email] job ${job.id} attempt ${job.attemptsMade}/${maxAttempts} failed, retry in ~${retryInMs}ms`,
      error.message,
    );
  });

  return worker;
}
