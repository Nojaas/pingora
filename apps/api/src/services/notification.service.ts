import { prisma, Prisma } from "@pingora/db";
import type { CreateNotificationBody } from "@pingora/shared";
import { toApiChannel, toApiStatus, toPrismaChannel } from "@pingora/shared";
import { enqueueEmailNotification } from "../queues/email.queue.js";

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
