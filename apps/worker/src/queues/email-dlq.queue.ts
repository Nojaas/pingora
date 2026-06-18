import {
  EMAIL_DLQ_JOB_NAME,
  EMAIL_DLQ_QUEUE_NAME,
  type EmailDlqJobData,
  getRedisConnectionOptions,
} from "@pingora/shared";
import { Queue } from "bullmq";

let emailDlqQueue: Queue<EmailDlqJobData> | undefined;

export function getEmailDlqQueue(): Queue<EmailDlqJobData> {
  emailDlqQueue ??= new Queue<EmailDlqJobData>(EMAIL_DLQ_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: {
      removeOnComplete: 200,
      removeOnFail: 1_000,
    },
  });

  return emailDlqQueue;
}

export async function enqueueEmailDlqJob(data: EmailDlqJobData) {
  const queue = getEmailDlqQueue();

  const job = await queue.add(EMAIL_DLQ_JOB_NAME, data, {
    jobId: `dlq-email-${data.notificationId}`,
  });

  return job.id ?? `dlq-email-${data.notificationId}`;
}
