import {
  buildEmailDlqPayload,
  EMAIL_QUEUE_NAME,
  emailJobDataSchema,
} from "@pingora/shared";
import type { Job } from "bullmq";
import { enqueueEmailDlqJob } from "../queues/email-dlq.queue.js";

export async function moveExhaustedEmailJobToDlq(job: Job, error: Error) {
  const parsed = emailJobDataSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Cannot enqueue DLQ job: ${parsed.error.message}`);
  }

  const payload = buildEmailDlqPayload({
    notificationId: parsed.data.notificationId,
    sourceJobId: job.id ?? `email-${parsed.data.notificationId}`,
    sourceQueue: EMAIL_QUEUE_NAME,
    failedReason: error.message,
    attemptsMade: job.attemptsMade,
  });

  return enqueueEmailDlqJob(payload);
}
