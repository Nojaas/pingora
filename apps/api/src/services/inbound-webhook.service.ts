import {
  buildInboundIdempotencyKey,
  INBOUND_WEBHOOK_IDEMPOTENCY_TTL_SECONDS,
  type InboundWebhookBody,
} from "@pingora/shared";
import type { Redis } from "ioredis";

export type ProcessInboundResult = {
  received: true;
  id: string;
  type: string;
  duplicate: boolean;
};

/**
 * Marque l'event comme traité (SET NX). Retourne true si c'était déjà vu.
 */
export async function claimInboundEvent(
  redis: Redis,
  eventId: string,
  ttlSeconds = INBOUND_WEBHOOK_IDEMPOTENCY_TTL_SECONDS,
): Promise<"claimed" | "duplicate"> {
  const key = buildInboundIdempotencyKey(eventId);
  const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
  return result === "OK" ? "claimed" : "duplicate";
}

export function toInboundAck(
  body: InboundWebhookBody,
  duplicate: boolean,
): ProcessInboundResult {
  return {
    received: true,
    id: body.id,
    type: body.type,
    duplicate,
  };
}

export function getInboundWebhookSecret(): string | null {
  const secret = process.env.INBOUND_WEBHOOK_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}
