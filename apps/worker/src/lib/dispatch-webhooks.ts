import { prisma, Prisma } from "@pingora/db";
import {
  buildWebhookEventPayload,
  type WebhookEvent,
} from "@pingora/shared";
import { enqueueWebhookDelivery } from "../queues/webhook.queue.js";

export async function dispatchNotificationWebhooks(
  notificationId: string,
  event: WebhookEvent,
) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: {
      id: true,
      apiKeyId: true,
      status: true,
      channel: true,
      recipient: true,
    },
  });

  if (!notification) {
    return { enqueued: 0 };
  }

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      apiKeyId: notification.apiKeyId,
      active: true,
    },
  });

  const matching = endpoints.filter((endpoint) =>
    endpoint.events.includes(event),
  );

  if (matching.length === 0) {
    return { enqueued: 0 };
  }

  const payload = buildWebhookEventPayload({
    event,
    notification,
  });

  let enqueued = 0;

  for (const endpoint of matching) {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        notificationId: notification.id,
        event,
        payload: payload as Prisma.InputJsonValue,
      },
    });

    await enqueueWebhookDelivery(delivery.id);
    enqueued += 1;
  }

  return { enqueued };
}
