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
  notificationChannelSchema,
  toApiChannel,
  toApiStatus,
  toPrismaChannel,
} from "./schemas/notification.js";
export type {
  CreateNotificationBody,
  NotificationChannelInput,
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
