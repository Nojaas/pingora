import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGroupBy = vi.fn();
const mockNotificationFindMany = vi.fn();
const mockDeliveryCount = vi.fn();
const mockDeliveryFindMany = vi.fn();
const mockGetQueuesStatus = vi.fn();

vi.mock("@pingora/db", () => ({
  prisma: {
    notification: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
      findMany: (...args: unknown[]) => mockNotificationFindMany(...args),
    },
    webhookDelivery: {
      count: (...args: unknown[]) => mockDeliveryCount(...args),
      findMany: (...args: unknown[]) => mockDeliveryFindMany(...args),
    },
  },
}));

vi.mock("./queue.service.js", () => ({
  getQueuesStatus: (...args: unknown[]) => mockGetQueuesStatus(...args),
}));

const { getDashboardSummary } = await import("./dashboard.service.js");

describe("getDashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGroupBy.mockResolvedValue([
      { status: "SENT", _count: { _all: 8 } },
      { status: "FAILED", _count: { _all: 2 } },
      { status: "QUEUED", _count: { _all: 1 } },
    ]);
    mockNotificationFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-05-23T12:00:00.000Z"),
        sentAt: new Date("2026-05-23T12:00:01.000Z"),
      },
      {
        createdAt: new Date("2026-05-23T12:00:00.000Z"),
        sentAt: new Date("2026-05-23T12:00:03.000Z"),
      },
    ]);
    mockDeliveryCount
      .mockResolvedValueOnce(4) // delivered
      .mockResolvedValueOnce(1) // failed
      .mockResolvedValueOnce(0) // pending
      .mockResolvedValueOnce(1); // retrying
    mockDeliveryFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-05-23T12:00:00.000Z"),
        deliveredAt: new Date("2026-05-23T12:00:00.500Z"),
      },
    ]);
    mockGetQueuesStatus.mockResolvedValue([
      {
        name: "email-dlq",
        counts: {
          waiting: 2,
          active: 1,
          delayed: 1,
          completed: 9,
          failed: 0,
          paused: 0,
        },
      },
    ]);
  });

  it("aggregates notification, webhook and DLQ KPIs", async () => {
    const summary = await getDashboardSummary("key_1", { windowHours: 24 });

    expect(summary.notifications.successRate).toBe(0.8);
    expect(summary.notifications.sent).toBe(8);
    expect(summary.notifications.failed).toBe(2);
    expect(summary.notifications.pending).toBe(1);
    expect(summary.notifications.averageLatencyMs).toBe(2000);
    expect(summary.webhooks.successRate).toBe(0.8);
    expect(summary.webhooks.delivered).toBe(4);
    expect(summary.webhooks.failed).toBe(1);
    expect(summary.webhooks.retrying).toBe(1);
    expect(summary.webhooks.averageLatencyMs).toBe(500);
    expect(summary.dlq.count).toBe(4);
    expect(summary.dlq.queue).toBe("email-dlq");
    expect(summary.window.hours).toBe(24);
  });
});
