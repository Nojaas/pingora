export const PINGORA_VERSION = "0.0.0" as const;

export {
  API_KEY_HEADER,
  SCOPES,
  hashApiKey,
  isApiKeyFormat,
} from "./api-key.js";
export type { Scope } from "./api-key.js";

export {
  createNotificationBodySchema,
  listNotificationsQuerySchema,
  notificationChannelSchema,
  notificationStatusSchema,
  toApiChannel,
  toApiStatus,
  toPrismaChannel,
  toPrismaStatus,
} from "./schemas/notification.js";
export type {
  CreateNotificationBody,
  ListNotificationsQuery,
  NotificationChannelInput,
  NotificationStatusInput,
} from "./schemas/notification.js";

export { formatZodError } from "./validation.js";

export {
  EMAIL_JOB_ATTEMPTS,
  EMAIL_JOB_BACKOFF,
  EMAIL_JOB_BACKOFF_DELAY_MS,
  EMAIL_JOB_DEFAULT_OPTIONS,
  EMAIL_JOB_NAME,
  EMAIL_QUEUE_NAME,
  emailJobDataSchema,
  getExponentialBackoffDelayMs,
  isFinalJobAttempt,
} from "./queues/email.js";
export type { EmailJobData } from "./queues/email.js";

export { getRedisConnectionOptions } from "./redis.js";

export {
  ALERT_TYPES,
  buildNotificationDlqAlert,
  emitAlert,
  formatAlert,
} from "./alerts.js";
export type { AlertLevel, AlertPayload, AlertType } from "./alerts.js";

export {
  EMAIL_DLQ_JOB_NAME,
  EMAIL_DLQ_QUEUE_NAME,
  areJobAttemptsExhausted,
  buildEmailDlqPayload,
  emailDlqJobDataSchema,
} from "./queues/dlq.js";
export type { EmailDlqJobData } from "./queues/dlq.js";

export {
  RATE_LIMIT_KEY_PREFIX,
  RATE_LIMIT_WINDOW_MS,
  SLIDING_WINDOW_RATE_LIMIT_SCRIPT,
  buildRateLimitKey,
  parseSlidingWindowRateLimitResult,
} from "./rate-limit.js";
export type { RateLimitDecision } from "./rate-limit.js";

export {
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_SIGNATURE_SCHEME,
  buildWebhookSignedPayload,
  parseWebhookSignatureHeader,
  signWebhookPayload,
  verifyWebhookSignature,
} from "./webhook-signature.js";
export type {
  SignedWebhook,
  VerifyWebhookSignatureOptions,
} from "./webhook-signature.js";

export {
  WEBHOOK_EVENTS,
  createWebhookEndpointBodySchema,
  webhookEventSchema,
} from "./schemas/webhook.js";
export type {
  CreateWebhookEndpointBody,
  WebhookEvent,
} from "./schemas/webhook.js";
