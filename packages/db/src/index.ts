export { PINGORA_VERSION } from "@pingora/shared";
export { prisma } from "./client.js";
export { prisma as db } from "./client.js";

export {
  Prisma,
  PrismaClient,
  Channel,
  NotificationStatus,
} from "./generated/prisma/client.js";

export type {
  ApiKey,
  Notification,
  WebhookEndpoint,
  WebhookDelivery,
} from "./generated/prisma/client.js";
