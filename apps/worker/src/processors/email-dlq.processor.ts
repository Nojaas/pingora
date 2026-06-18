import {
  buildNotificationDlqAlert,
  EMAIL_DLQ_QUEUE_NAME,
  emailDlqJobDataSchema,
  emitAlert,
  getRedisConnectionOptions,
} from "@pingora/shared";
import type { Job } from "bullmq";
import { Worker } from "bullmq";

async function processEmailDlqJob(job: Job) {
  const parsed = emailDlqJobDataSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid DLQ payload: ${parsed.error.message}`);
  }

  const data = parsed.data;

  emitAlert(
    buildNotificationDlqAlert({
      queue: EMAIL_DLQ_QUEUE_NAME,
      notificationId: data.notificationId,
      jobId: job.id ?? `dlq-email-${data.notificationId}`,
      error: data.failedReason,
      attempts: data.attemptsMade,
      timestamp: data.failedAt,
    }),
  );

  return {
    alerted: true,
    notificationId: data.notificationId,
    sourceJobId: data.sourceJobId,
  };
}

export function startEmailDlqWorker() {
  const worker = new Worker(EMAIL_DLQ_QUEUE_NAME, processEmailDlqJob, {
    connection: getRedisConnectionOptions(),
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`[email-dlq] job ${job.id} processed`, job.returnvalue);
  });

  worker.on("failed", (job, error) => {
    console.error(`[email-dlq] job ${job?.id} failed`, error.message);
  });

  return worker;
}
