import { type Prisma, prisma } from "@pingora/db";
import type {
  CreateNotificationBody,
  ListNotificationsQuery,
} from "@pingora/shared";
import {
  toApiChannel,
  toApiStatus,
  toPrismaChannel,
  toPrismaStatus,
} from "@pingora/shared";
import { enqueueEmailNotification } from "../queues/email.queue.js";

type NotificationListRecord = {
  id: string;
  status: "PENDING" | "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
  channel: "EMAIL" | "SMS" | "PUSH";
  recipient: string;
  createdAt: Date;
};

export async function listNotifications(
  apiKeyId: string,
  query: ListNotificationsQuery,
) {
  const { cursor, limit, status, channel } = query;

  const notifications = await prisma.notification.findMany({
    where: {
      apiKeyId,
      ...(cursor ? { id: { lt: cursor } } : {}),
      ...(status ? { status: toPrismaStatus(status) } : {}),
      ...(channel ? { channel: toPrismaChannel(channel) } : {}),
    },
    orderBy: { id: "desc" },
    take: limit + 1,
    select: {
      id: true,
      status: true,
      channel: true,
      recipient: true,
      createdAt: true,
    },
  });

  return toNotificationsListResponse(notifications, limit);
}

export function toNotificationsListResponse(
  notifications: NotificationListRecord[],
  limit: number,
) {
  const hasMore = notifications.length > limit;
  const page = hasMore ? notifications.slice(0, limit) : notifications;
  const nextCursor =
    hasMore && page.length > 0 ? (page[page.length - 1]?.id ?? null) : null;

  return {
    data: page.map(toNotificationResponse),
    pagination: {
      nextCursor,
      hasMore,
    },
  };
}

export async function createNotification(
  apiKeyId: string,
  input: CreateNotificationBody,
) {
  const notification = await prisma.notification.create({
    data: {
      apiKeyId,
      channel: toPrismaChannel(input.channel),
      recipient: input.recipient,
      subject: input.subject ?? null,
      body: input.body,
      metadata:
        input.metadata === undefined
          ? undefined
          : (input.metadata as Prisma.InputJsonValue),
      status: "PENDING",
    },
  });

  if (input.channel !== "email") {
    return notification;
  }

  const jobId = await enqueueEmailNotification(notification.id);

  return prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: "QUEUED",
      jobId,
    },
  });
}

export function toNotificationResponse(notification: {
  id: string;
  status: "PENDING" | "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
  channel: "EMAIL" | "SMS" | "PUSH";
  recipient: string;
  createdAt: Date;
}) {
  return {
    id: notification.id,
    status: toApiStatus(notification.status),
    channel: toApiChannel(notification.channel),
    recipient: notification.recipient,
    createdAt: notification.createdAt.toISOString(),
    _links: {
      self: `/notifications/${notification.id}`,
      cancel: `/notifications/${notification.id}/cancel`,
    },
  };
}
