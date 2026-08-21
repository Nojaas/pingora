import { vi } from "vitest";
import type { RateLimitDecision } from "@pingora/shared";
import { prismaStore } from "./prisma-store.js";

export const mockEnqueueEmail = vi.fn(
  async (notificationId: string) => `email-${notificationId}`,
);

export const mockCheckRateLimit = vi.fn(
  async (): Promise<RateLimitDecision> => ({
    allowed: true,
    limit: 1000,
    remaining: 999,
    resetAt: Math.floor(Date.now() / 1000) + 60,
  }),
);

vi.mock("@pingora/db", () => ({
  prisma: {
    apiKey: {
      findUnique: async ({
        where,
      }: {
        where: { keyHash: string };
      }) => {
        const record = prismaStore.apiKeys.find(
          (key) => key.keyHash === where.keyHash,
        );
        return record ?? null;
      },
      update: async () => ({}),
    },
    notification: {
      create: async ({
        data,
      }: {
        data: Omit<
          import("./prisma-store.js").StoredNotification,
          "id" | "createdAt" | "jobId"
        >;
      }) => {
        prismaStore.notificationSeq += 1;
        const notification = {
          id: `notif_integration_${prismaStore.notificationSeq}`,
          createdAt: new Date("2026-05-23T12:00:00.000Z"),
          jobId: null,
          ...data,
        };
        prismaStore.notifications.push(notification);
        return notification;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<import("./prisma-store.js").StoredNotification>;
      }) => {
        const index = prismaStore.notifications.findIndex(
          (notification) => notification.id === where.id,
        );
        if (index === -1) {
          throw new Error(`Notification ${where.id} not found`);
        }

        prismaStore.notifications[index] = {
          ...prismaStore.notifications[index]!,
          ...data,
        };

        return prismaStore.notifications[index]!;
      },
      findMany: async ({
        where,
        orderBy,
        take,
        select,
      }: {
        where: {
          apiKeyId: string;
          id?: { lt: string };
          status?: string;
          channel?: string;
        };
        orderBy: { id: "desc" };
        take: number;
        select: Record<string, boolean>;
      }) => {
        let rows = prismaStore.notifications.filter(
          (notification) => notification.apiKeyId === where.apiKeyId,
        );

        if (where.id?.lt) {
          rows = rows.filter((notification) => notification.id < where.id!.lt);
        }
        if (where.status) {
          rows = rows.filter(
            (notification) => notification.status === where.status,
          );
        }
        if (where.channel) {
          rows = rows.filter(
            (notification) => notification.channel === where.channel,
          );
        }

        rows = [...rows].sort((a, b) => b.id.localeCompare(a.id));
        rows = rows.slice(0, take);

        return rows.map((row) => {
          const selected: Record<string, unknown> = {};
          for (const field of Object.keys(select)) {
            if (select[field]) {
              selected[field] = row[field as keyof typeof row];
            }
          }
          return selected;
        });
      },
    },
    webhookEndpoint: {
      create: async ({
        data,
      }: {
        data: Omit<
          import("./prisma-store.js").StoredWebhookEndpoint,
          "id" | "createdAt"
        >;
      }) => {
        prismaStore.webhookSeq += 1;
        const endpoint = {
          id: `wh_integration_${prismaStore.webhookSeq}`,
          createdAt: new Date("2026-05-23T12:00:00.000Z"),
          ...data,
        };
        prismaStore.webhookEndpoints.push(endpoint);
        return endpoint;
      },
      findMany: async ({
        where,
        orderBy,
      }: {
        where: { apiKeyId: string };
        orderBy: { createdAt: "desc" };
      }) => {
        const rows = prismaStore.webhookEndpoints.filter(
          (endpoint) => endpoint.apiKeyId === where.apiKeyId,
        );
        return [...rows].sort((a, b) =>
          orderBy.createdAt === "desc"
            ? b.createdAt.getTime() - a.createdAt.getTime()
            : a.createdAt.getTime() - b.createdAt.getTime(),
        );
      },
      findFirst: async ({
        where,
      }: {
        where: { id: string; apiKeyId: string };
        select?: { id: boolean };
      }) => {
        const endpoint = prismaStore.webhookEndpoints.find(
          (row) => row.id === where.id && row.apiKeyId === where.apiKeyId,
        );
        return endpoint ? { id: endpoint.id } : null;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = prismaStore.webhookEndpoints.findIndex(
          (endpoint) => endpoint.id === where.id,
        );
        if (index === -1) {
          throw new Error(`Webhook endpoint ${where.id} not found`);
        }
        const [removed] = prismaStore.webhookEndpoints.splice(index, 1);
        return removed;
      },
    },
  },
  Prisma: {},
}));

vi.mock("../queues/email.queue.js", () => ({
  enqueueEmailNotification: (...args: [string]) => mockEnqueueEmail(...args),
}));

vi.mock("../lib/rate-limit.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/rate-limit.js")>();
  return {
    ...actual,
    checkSlidingWindowRateLimit: () => mockCheckRateLimit(),
  };
});

export const inboundIdempotencyKeys = new Set<string>();

vi.mock("../lib/redis.js", () => ({
  getRedisClient: () => ({
    set: async (
      key: string,
      _value: string,
      _ex: string,
      _ttl: number,
      nx?: string,
    ) => {
      if (nx === "NX") {
        if (inboundIdempotencyKeys.has(key)) {
          return null;
        }
        inboundIdempotencyKeys.add(key);
        return "OK";
      }
      inboundIdempotencyKeys.add(key);
      return "OK";
    },
  }),
}));
