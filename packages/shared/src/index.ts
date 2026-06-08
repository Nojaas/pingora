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
  EMAIL_JOB_NAME,
  EMAIL_QUEUE_NAME,
  emailJobDataSchema,
} from "./queues/email.js";
export type { EmailJobData } from "./queues/email.js";

export { getRedisConnectionOptions } from "./redis.js";
