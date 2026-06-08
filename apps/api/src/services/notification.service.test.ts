import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockEnqueue = vi.fn();

vi.mock("@pingora/db", () => ({
  prisma: {
    notification: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
  Prisma: {},
}));

vi.mock("../queues/email.queue.js", () => ({
  enqueueEmailNotification: (...args: unknown[]) => mockEnqueue(...args),
}));

const { createNotification, toNotificationResponse } = await import(
  "./notification.service.js"
);

const apiKeyId = "key_test_123";

const emailInput = {
  channel: "email" as const,
  recipient: "user@example.com",
  subject: "Order confirmed",
  body: "Your order was received.",
};

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates, enqueues and marks email notifications as QUEUED", async () => {
    const created = {
      id: "notif_1",
      apiKeyId,
      channel: "EMAIL",
      recipient: emailInput.recipient,
      subject: emailInput.subject,
      body: emailInput.body,
      status: "PENDING",
      createdAt: new Date("2025-01-15T10:30:00.000Z"),
    };

    const queued = {
      ...created,
      status: "QUEUED",
      jobId: "email-notif_1",
    };

    mockCreate.mockResolvedValue(created);
    mockEnqueue.mockResolvedValue("email-notif_1");
    mockUpdate.mockResolvedValue(queued);

    const result = await createNotification(apiKeyId, emailInput);

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        apiKeyId,
        channel: "EMAIL",
        recipient: emailInput.recipient,
        subject: emailInput.subject,
        body: emailInput.body,
        status: "PENDING",
      }),
    });
    expect(mockEnqueue).toHaveBeenCalledWith("notif_1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "notif_1" },
      data: { status: "QUEUED", jobId: "email-notif_1" },
    });
    expect(result).toEqual(queued);
  });

  it("keeps non-email channels as PENDING without enqueueing", async () => {
    const created = {
      id: "notif_2",
      apiKeyId,
      channel: "SMS",
      recipient: "+33612345678",
      subject: null,
      body: "Code: 1234",
      status: "PENDING",
      createdAt: new Date("2025-01-15T10:30:00.000Z"),
    };

    mockCreate.mockResolvedValue(created);

    const result = await createNotification(apiKeyId, {
      channel: "sms",
      recipient: "+33612345678",
      body: "Code: 1234",
    });

    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toEqual(created);
    expect(result.status).toBe("PENDING");
  });
});

describe("toNotificationResponse", () => {
  it("maps db record to public API shape", () => {
    const response = toNotificationResponse({
      id: "notif_1",
      status: "QUEUED",
      channel: "EMAIL",
      recipient: "user@example.com",
      createdAt: new Date("2025-01-15T10:30:00.000Z"),
    });

    expect(response).toEqual({
      id: "notif_1",
      status: "queued",
      channel: "email",
      recipient: "user@example.com",
      createdAt: "2025-01-15T10:30:00.000Z",
      _links: {
        self: "/notifications/notif_1",
        cancel: "/notifications/notif_1/cancel",
      },
    });
  });
});
