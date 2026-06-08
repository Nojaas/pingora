import { prisma } from "@pingora/db";
import {
  EMAIL_QUEUE_NAME,
  emailJobDataSchema,
  getRedisConnectionOptions,
} from "@pingora/shared";
import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { sendEmail } from "../providers/email.js";

async function processEmailJob(job: Job) {
  const parsed = emailJobDataSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job payload: ${parsed.error.message}`);
  }

  const { notificationId } = parsed.data;

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

    const maxAttempts = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        ...(isFinalAttempt
          ? { status: "FAILED" as const, failedAt: new Date() }
          : {}),
        error: message,
      },
    });

    throw error;
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

  worker.on("failed", (job, error) => {
    console.error(`[email] job ${job?.id} failed`, error.message);
  });

  return worker;
}
