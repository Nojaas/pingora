import { z } from "zod";

export const EMAIL_QUEUE_NAME = "email" as const;

export const EMAIL_JOB_NAME = "send-email" as const;

export const emailJobDataSchema = z.object({
  notificationId: z.string().min(1),
});

export type EmailJobData = z.infer<typeof emailJobDataSchema>;
