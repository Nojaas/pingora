import { prisma } from "@pingora/db";
import {
  EMAIL_DLQ_QUEUE_NAME,
  type DashboardSummaryQuery,
} from "@pingora/shared";
import { getQueuesStatus, type QueueCounts } from "./queue.service.js";

function averageLatencyMs(
  rows: Array<{ start: Date; end: Date | null }>,
): number | null {
  const samples = rows
    .filter((row): row is { start: Date; end: Date } => row.end != null)
    .map((row) => Math.max(0, row.end.getTime() - row.start.getTime()));

  if (samples.length === 0) {
    return null;
  }

  const total = samples.reduce((sum, value) => sum + value, 0);
  return Math.round(total / samples.length);
}

function successRate(success: number, failure: number): number | null {
  const total = success + failure;
  if (total === 0) {
    return null;
  }
  return Number((success / total).toFixed(4));
}

function dlqDepth(counts: QueueCounts): number {
  return counts.waiting + counts.active + counts.delayed;
}

export async function getDashboardSummary(
  apiKeyId: string,
  query: DashboardSummaryQuery,
) {
  const to = new Date();
  const from = new Date(to.getTime() - query.windowHours * 60 * 60 * 1000);
  const createdAtRange = { gte: from, lte: to };

  const [
    notificationGroups,
    sentLatencyRows,
    webhookDelivered,
    webhookFailed,
    webhookPending,
    webhookRetrying,
    webhookLatencyRows,
    queues,
  ] = await Promise.all([
    prisma.notification.groupBy({
      by: ["status"],
      where: { apiKeyId, createdAt: createdAtRange },
      _count: { _all: true },
    }),
    prisma.notification.findMany({
      where: {
        apiKeyId,
        status: "SENT",
        sentAt: { not: null },
        createdAt: createdAtRange,
      },
      select: { createdAt: true, sentAt: true },
    }),
    prisma.webhookDelivery.count({
      where: {
        endpoint: { apiKeyId },
        createdAt: createdAtRange,
        deliveredAt: { not: null },
      },
    }),
    prisma.webhookDelivery.count({
      where: {
        endpoint: { apiKeyId },
        createdAt: createdAtRange,
        deliveredAt: null,
        nextRetryAt: null,
        attempts: { gt: 0 },
      },
    }),
    prisma.webhookDelivery.count({
      where: {
        endpoint: { apiKeyId },
        createdAt: createdAtRange,
        deliveredAt: null,
        nextRetryAt: null,
        attempts: 0,
      },
    }),
    prisma.webhookDelivery.count({
      where: {
        endpoint: { apiKeyId },
        createdAt: createdAtRange,
        deliveredAt: null,
        nextRetryAt: { not: null },
      },
    }),
    prisma.webhookDelivery.findMany({
      where: {
        endpoint: { apiKeyId },
        createdAt: createdAtRange,
        deliveredAt: { not: null },
      },
      select: { createdAt: true, deliveredAt: true },
    }),
    getQueuesStatus(),
  ]);

  const notificationCounts = {
    pending: 0,
    queued: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
  };

  for (const group of notificationGroups) {
    const count = group._count._all;
    switch (group.status) {
      case "PENDING":
        notificationCounts.pending = count;
        break;
      case "QUEUED":
        notificationCounts.queued = count;
        break;
      case "SENT":
        notificationCounts.sent = count;
        break;
      case "FAILED":
        notificationCounts.failed = count;
        break;
      case "CANCELLED":
        notificationCounts.cancelled = count;
        break;
    }
  }

  const notificationTotal =
    notificationCounts.pending +
    notificationCounts.queued +
    notificationCounts.sent +
    notificationCounts.failed +
    notificationCounts.cancelled;

  const dlqQueue = queues.find((queue) => queue.name === EMAIL_DLQ_QUEUE_NAME);
  const dlqCounts = dlqQueue?.counts ?? {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0,
  };

  return {
    window: {
      from: from.toISOString(),
      to: to.toISOString(),
      hours: query.windowHours,
    },
    notifications: {
      successRate: successRate(
        notificationCounts.sent,
        notificationCounts.failed,
      ),
      sent: notificationCounts.sent,
      failed: notificationCounts.failed,
      pending: notificationCounts.pending + notificationCounts.queued,
      cancelled: notificationCounts.cancelled,
      total: notificationTotal,
      averageLatencyMs: averageLatencyMs(
        sentLatencyRows.map((row) => ({
          start: row.createdAt,
          end: row.sentAt,
        })),
      ),
    },
    webhooks: {
      successRate: successRate(webhookDelivered, webhookFailed),
      delivered: webhookDelivered,
      failed: webhookFailed,
      pending: webhookPending,
      retrying: webhookRetrying,
      total:
        webhookDelivered + webhookFailed + webhookPending + webhookRetrying,
      averageLatencyMs: averageLatencyMs(
        webhookLatencyRows.map((row) => ({
          start: row.createdAt,
          end: row.deliveredAt,
        })),
      ),
    },
    dlq: {
      queue: EMAIL_DLQ_QUEUE_NAME,
      count: dlqDepth(dlqCounts),
      counts: dlqCounts,
    },
  };
}
