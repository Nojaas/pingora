import { prisma } from "@pingora/db";
import type { CreateWebhookEndpointBody } from "@pingora/shared";

type WebhookEndpointRecord = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
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
