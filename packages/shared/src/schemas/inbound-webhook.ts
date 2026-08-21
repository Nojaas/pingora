import { z } from "zod";

/**
 * Payload minimal attendu d'un provider externe (style Stripe / GitHub).
 * `id` sert de clé d'idempotence.
 */
export const inboundWebhookBodySchema = z.object({
  id: z.string().trim().min(1, "id is required"),
  type: z.string().trim().min(1, "type is required"),
  data: z.record(z.string(), z.unknown()).optional().default({}),
  createdAt: z.string().datetime().optional(),
});

export type InboundWebhookBody = z.infer<typeof inboundWebhookBodySchema>;

export const INBOUND_WEBHOOK_IDEMPOTENCY_PREFIX =
  "pingora:inbound:" as const;

export const INBOUND_WEBHOOK_IDEMPOTENCY_TTL_SECONDS = 86_400;

export function buildInboundIdempotencyKey(eventId: string): string {
  return `${INBOUND_WEBHOOK_IDEMPOTENCY_PREFIX}${eventId}`;
}
