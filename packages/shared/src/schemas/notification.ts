import { z } from "zod";

export const notificationChannelSchema = z.enum(["email", "sms", "push"]);

export type NotificationChannelInput = z.infer<typeof notificationChannelSchema>;

export const createNotificationBodySchema = z
  .object({
    channel: notificationChannelSchema,
    recipient: z.string().trim().min(1, "recipient is required"),
    subject: z.string().trim().optional(),
    body: z.string().trim().min(1, "body is required"),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channel === "email") {
      if (!z.string().email().safeParse(data.recipient).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recipient"],
          message: "Invalid email address",
        });
      }

      if (!data.subject || data.subject.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subject"],
          message: "subject is required for email notifications",
        });
      }
    }

    if (data.channel === "sms") {
      const phone = /^\+?[1-9]\d{6,14}$/;
      if (!phone.test(data.recipient.replace(/[\s-]/g, ""))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recipient"],
          message: "Invalid phone number (E.164 expected)",
        });
      }
    }
  });

export type CreateNotificationBody = z.infer<typeof createNotificationBodySchema>;

export const PRISMA_CHANNEL_MAP = {
  email: "EMAIL",
  sms: "SMS",
  push: "PUSH",
} as const satisfies Record<
  NotificationChannelInput,
  "EMAIL" | "SMS" | "PUSH"
>;

export function toPrismaChannel(channel: NotificationChannelInput) {
  return PRISMA_CHANNEL_MAP[channel];
}

export function toApiChannel(channel: "EMAIL" | "SMS" | "PUSH") {
  return channel.toLowerCase() as NotificationChannelInput;
}

export function toApiStatus(
  status: "PENDING" | "QUEUED" | "SENT" | "FAILED" | "CANCELLED",
) {
  return status.toLowerCase() as Lowercase<typeof status>;
}
