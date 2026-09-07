import { hashApiKey, SCOPES } from "@pingora/shared";

export type StoredApiKey = {
  id: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: string[];
  rateLimit: number;
  revoked: boolean;
  expiresAt: Date | null;
};

export type StoredNotification = {
  id: string;
  apiKeyId: string;
  channel: "EMAIL" | "SMS" | "PUSH";
  recipient: string;
  subject: string | null;
  body: string;
  status: "PENDING" | "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
  metadata?: unknown;
  jobId?: string | null;
  sentAt?: Date | null;
  failedAt?: Date | null;
  createdAt: Date;
};

export type StoredWebhookEndpoint = {
  id: string;
  apiKeyId: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: Date;
};

export type StoredWebhookDelivery = {
  id: string;
  endpointId: string;
  notificationId: string;
  event: string;
  statusCode: number | null;
  attempts: number;
  nextRetryAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
};

export const API_KEYS = {
  full: {
    raw: "nfh_test_integration_full_access_key",
    id: "key_integration_full",
    name: "Integration Full",
    prefix: "nfh_test_int",
    scopes: [
      SCOPES.NOTIFICATIONS_READ,
      SCOPES.NOTIFICATIONS_WRITE,
      SCOPES.WEBHOOKS_READ,
      SCOPES.WEBHOOKS_WRITE,
    ],
    rateLimit: 1000,
  },
  readOnly: {
    raw: "nfh_test_integration_read_only_key",
    id: "key_integration_read",
    name: "Integration Read",
    prefix: "nfh_test_rd",
    scopes: [SCOPES.NOTIFICATIONS_READ, SCOPES.WEBHOOKS_READ],
    rateLimit: 1000,
  },
  revoked: {
    raw: "nfh_test_integration_revoked_key",
    id: "key_integration_revoked",
    name: "Integration Revoked",
    prefix: "nfh_test_rv",
    scopes: [
      SCOPES.NOTIFICATIONS_READ,
      SCOPES.NOTIFICATIONS_WRITE,
      SCOPES.WEBHOOKS_READ,
      SCOPES.WEBHOOKS_WRITE,
    ],
    rateLimit: 1000,
  },
} as const;

export const prismaStore = {
  apiKeys: [] as StoredApiKey[],
  notifications: [] as StoredNotification[],
  webhookEndpoints: [] as StoredWebhookEndpoint[],
  webhookDeliveries: [] as StoredWebhookDelivery[],
  notificationSeq: 0,
  webhookSeq: 0,
  deliverySeq: 0,
};

export function resetPrismaStore() {
  prismaStore.apiKeys = [];
  prismaStore.notifications = [];
  prismaStore.webhookEndpoints = [];
  prismaStore.webhookDeliveries = [];
  prismaStore.notificationSeq = 0;
  prismaStore.webhookSeq = 0;
  prismaStore.deliverySeq = 0;
}

export function seedIntegrationApiKeys() {
  resetPrismaStore();

  prismaStore.apiKeys.push(
    {
      id: API_KEYS.full.id,
      name: API_KEYS.full.name,
      keyHash: hashApiKey(API_KEYS.full.raw),
      prefix: API_KEYS.full.prefix,
      scopes: [...API_KEYS.full.scopes],
      rateLimit: API_KEYS.full.rateLimit,
      revoked: false,
      expiresAt: null,
    },
    {
      id: API_KEYS.readOnly.id,
      name: API_KEYS.readOnly.name,
      keyHash: hashApiKey(API_KEYS.readOnly.raw),
      prefix: API_KEYS.readOnly.prefix,
      scopes: [...API_KEYS.readOnly.scopes],
      rateLimit: API_KEYS.readOnly.rateLimit,
      revoked: false,
      expiresAt: null,
    },
    {
      id: API_KEYS.revoked.id,
      name: API_KEYS.revoked.name,
      keyHash: hashApiKey(API_KEYS.revoked.raw),
      prefix: API_KEYS.revoked.prefix,
      scopes: [...API_KEYS.revoked.scopes],
      rateLimit: API_KEYS.revoked.rateLimit,
      revoked: true,
      expiresAt: null,
    },
  );
}
