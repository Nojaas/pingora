import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnqueue = vi.fn();

vi.mock("../queues/email-dlq.queue.js", () => ({
  enqueueEmailDlqJob: (...args: unknown[]) => mockEnqueue(...args),
}));

const { moveExhaustedEmailJobToDlq } = await import("./exhausted-job.js");

describe("moveExhaustedEmailJobToDlq", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueue.mockResolvedValue("dlq-email-notif_1");
  });

  it("enqueues a DLQ job with failure metadata", async () => {
    const job = {
      id: "email-notif_1",
      attemptsMade: 5,
      data: { notificationId: "notif_1" },
    };

    const dlqJobId = await moveExhaustedEmailJobToDlq(
      job as never,
      new Error("SMTP timeout"),
    );

    expect(dlqJobId).toBe("dlq-email-notif_1");
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: "notif_1",
        sourceJobId: "email-notif_1",
        sourceQueue: "email",
        failedReason: "SMTP timeout",
        attemptsMade: 5,
      }),
    );
  });
});
