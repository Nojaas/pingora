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

export const webhookDeliveryStatusSchema = z.enum([
  "success",
  "failed",
  "pending",
  "retrying",
]);

export type WebhookDeliveryStatus = z.infer<typeof webhookDeliveryStatusSchema>;

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

export const listWebhookDeliveriesQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: webhookDeliveryStatusSchema.optional(),
  endpointId: z.string().trim().min(1).optional(),
  event: webhookEventSchema.optional(),
});

export type ListWebhookDeliveriesQuery = z.infer<
  typeof listWebhookDeliveriesQuerySchema
>;

export function deriveWebhookDeliveryStatus(input: {
  deliveredAt: Date | string | null;
  nextRetryAt: Date | string | null;
  attempts: number;
}): WebhookDeliveryStatus {
  if (input.deliveredAt) {
    return "success";
  }
  if (input.nextRetryAt) {
    return "retrying";
  }
  if (input.attempts > 0) {
    return "failed";
  }
  return "pending";
}
