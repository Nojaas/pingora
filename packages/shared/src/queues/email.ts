import { z } from "zod";

export {
  EMAIL_JOB_ATTEMPTS,
  EMAIL_JOB_BACKOFF,
  EMAIL_JOB_BACKOFF_DELAY_MS,
  EMAIL_JOB_DEFAULT_OPTIONS,
  getExponentialBackoffDelayMs,
  isFinalJobAttempt,
} from "./retry.js";

export const EMAIL_QUEUE_NAME = "email" as const;

export const EMAIL_JOB_NAME = "send-email" as const;

export const emailJobDataSchema = z.object({
  notificationId: z.string().min(1),
});

export type EmailJobData = z.infer<typeof emailJobDataSchema>;
