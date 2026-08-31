import { z } from "zod";

export const WEBHOOK_EVENTS = {
  NOTIFICATION_SENT: "notification.sent",
  NOTIFICATION_FAILED: "notification.failed",
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

export const webhookEventSchema = z.enum([
  WEBHOOK_EVENTS.NOTIFICATION_SENT,
  WEBHOOK_EVENTS.NOTIFICATION_FAILED,
]);

export const createWebhookEndpointBodySchema = z.object({
  url: z.string().url("url must be a valid URL"),
  secret: z
    .string()
    .trim()
    .min(16, "secret must be at least 16 characters")
    .max(256, "secret must be at most 256 characters"),
  events: z
    .array(webhookEventSchema)
    .min(1, "at least one event is required")
    .refine((events) => new Set(events).size === events.length, {
      message: "events must be unique",
    }),
  active: z.boolean().optional().default(true),
});

export type CreateWebhookEndpointBody = z.infer<
  typeof createWebhookEndpointBodySchema
>;
