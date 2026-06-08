import { createHash } from "node:crypto";

export const API_KEY_HEADER = "x-api-key" as const;

export const SCOPES = {
  NOTIFICATIONS_WRITE: "notifications:write",
  NOTIFICATIONS_READ: "notifications:read",
  WEBHOOKS_READ: "webhooks:read",
  WEBHOOKS_WRITE: "webhooks:write",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function isApiKeyFormat(rawKey: string): boolean {
  return rawKey.startsWith("nfh_") && rawKey.length > 12;
}
