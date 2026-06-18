import {
  EMAIL_JOB_DEFAULT_OPTIONS,
  EMAIL_JOB_NAME,
  EMAIL_QUEUE_NAME,
  getRedisConnectionOptions,
  type EmailJobData,
} from "@pingora/shared";
import { Queue } from "bullmq";

let emailQueue: Queue<EmailJobData> | undefined;

export function getEmailQueue(): Queue<EmailJobData> {
  emailQueue ??= new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: EMAIL_JOB_DEFAULT_OPTIONS,
  });

  return emailQueue;
}

export async function enqueueEmailNotification(notificationId: string) {
  const queue = getEmailQueue();

  const job = await queue.add(
    EMAIL_JOB_NAME,
    { notificationId },
    {
      jobId: `email-${notificationId}`,
    },
  );

  return job.id ?? `email-${notificationId}`;
}
