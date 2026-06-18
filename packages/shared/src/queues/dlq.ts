import { z } from "zod";

export const EMAIL_DLQ_QUEUE_NAME = "email-dlq" as const;

export const EMAIL_DLQ_JOB_NAME = "process-failed-email" as const;

export const emailDlqJobDataSchema = z.object({
  notificationId: z.string().min(1),
  sourceJobId: z.string().min(1),
  sourceQueue: z.string().min(1),
  failedReason: z.string().min(1),
  attemptsMade: z.number().int().positive(),
  failedAt: z.string().datetime(),
});

export type EmailDlqJobData = z.infer<typeof emailDlqJobDataSchema>;

export function buildEmailDlqPayload(params: {
  notificationId: string;
  sourceJobId: string;
  sourceQueue: string;
  failedReason: string;
  attemptsMade: number;
  failedAt?: Date;
}): EmailDlqJobData {
  return {
    notificationId: params.notificationId,
    sourceJobId: params.sourceJobId,
    sourceQueue: params.sourceQueue,
    failedReason: params.failedReason,
    attemptsMade: params.attemptsMade,
    failedAt: (params.failedAt ?? new Date()).toISOString(),
  };
}

export function areJobAttemptsExhausted(
  attemptsMade: number,
  maxAttempts: number,
): boolean {
  return attemptsMade >= maxAttempts;
}
