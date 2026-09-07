import { prisma, type Prisma } from "@pingora/db";
import type {
  CreateWebhookEndpointBody,
  ListWebhookDeliveriesQuery,
  WebhookDeliveryStatus,
} from "@pingora/shared";
import { deriveWebhookDeliveryStatus } from "@pingora/shared";

type WebhookEndpointRecord = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: Date;
};

type WebhookDeliveryRecord = {
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

export async function createWebhookEndpoint(
  apiKeyId: string,
  input: CreateWebhookEndpointBody,
) {
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      apiKeyId,
      url: input.url,
      secret: input.secret,
      events: input.events,
      active: input.active,
    },
  });

  return toWebhookEndpointResponse(endpoint, { includeSecret: true });
}

export async function listWebhookEndpoints(apiKeyId: string) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { apiKeyId },
    orderBy: { createdAt: "desc" },
  });

  return {
    data: endpoints.map((endpoint) =>
      toWebhookEndpointResponse(endpoint, { includeSecret: false }),
    ),
  };
}

export async function deleteWebhookEndpoint(
  apiKeyId: string,
  endpointId: string,
): Promise<boolean> {
  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, apiKeyId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

  await prisma.webhookEndpoint.delete({
    where: { id: existing.id },
  });

  return true;
}

export async function listWebhookDeliveries(
  apiKeyId: string,
  query: ListWebhookDeliveriesQuery,
) {
  const { cursor, limit, status, endpointId, event } = query;

  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      endpoint: { apiKeyId },
      ...(cursor ? { id: { lt: cursor } } : {}),
      ...(endpointId ? { endpointId } : {}),
      ...(event ? { event } : {}),
      ...(status ? deliveryStatusWhere(status) : {}),
    },
    orderBy: { id: "desc" },
    take: limit + 1,
    select: {
      id: true,
      endpointId: true,
      notificationId: true,
      event: true,
      statusCode: true,
      attempts: true,
      nextRetryAt: true,
      deliveredAt: true,
      createdAt: true,
    },
  });

  return toWebhookDeliveriesListResponse(deliveries, limit);
}

export function deliveryStatusWhere(
  status: WebhookDeliveryStatus,
): Prisma.WebhookDeliveryWhereInput {
  switch (status) {
    case "success":
      return { deliveredAt: { not: null } };
    case "retrying":
      return { deliveredAt: null, nextRetryAt: { not: null } };
    case "failed":
      return { deliveredAt: null, nextRetryAt: null, attempts: { gt: 0 } };
    case "pending":
      return { deliveredAt: null, nextRetryAt: null, attempts: 0 };
  }
}

export function toWebhookDeliveriesListResponse(
  deliveries: WebhookDeliveryRecord[],
  limit: number,
) {
  const hasMore = deliveries.length > limit;
  const page = hasMore ? deliveries.slice(0, limit) : deliveries;
  const nextCursor =
    hasMore && page.length > 0 ? page[page.length - 1]!.id : null;

  return {
    data: page.map(toWebhookDeliveryResponse),
    pagination: {
      nextCursor,
      hasMore,
    },
  };
}

export function toWebhookDeliveryResponse(delivery: WebhookDeliveryRecord) {
  const status = deriveWebhookDeliveryStatus(delivery);
  const latencyMs =
    delivery.deliveredAt != null
      ? Math.max(
          0,
          delivery.deliveredAt.getTime() - delivery.createdAt.getTime(),
        )
      : null;

  return {
    id: delivery.id,
    endpointId: delivery.endpointId,
    notificationId: delivery.notificationId,
    event: delivery.event,
    status,
    statusCode: delivery.statusCode,
    attempts: delivery.attempts,
    nextRetryAt: delivery.nextRetryAt?.toISOString() ?? null,
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    createdAt: delivery.createdAt.toISOString(),
    latencyMs,
    _links: {
      self: `/webhooks/deliveries/${delivery.id}`,
      endpoint: `/webhooks/endpoints/${delivery.endpointId}`,
      notification: `/notifications/${delivery.notificationId}`,
    },
  };
}

export function toWebhookEndpointResponse(
  endpoint: WebhookEndpointRecord,
  options: { includeSecret: boolean },
) {
  return {
    id: endpoint.id,
    url: endpoint.url,
    ...(options.includeSecret ? { secret: endpoint.secret } : {}),
    events: endpoint.events,
    active: endpoint.active,
    createdAt: endpoint.createdAt.toISOString(),
    _links: {
      self: `/webhooks/endpoints/${endpoint.id}`,
    },
  };
}
