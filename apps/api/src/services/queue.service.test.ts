import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getQueuesStatus } from "./queue.service.js";

const getJobCounts = vi.fn();

vi.mock("bullmq", () => ({
  Queue: class {
    getJobCounts = getJobCounts;
  },
}));

vi.mock("@pingora/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pingora/shared")>();
  return {
    ...actual,
    getRedisConnectionOptions: () => ({ host: "localhost", port: 6379 }),
  };
});

describe("getQueuesStatus", () => {
  beforeEach(() => {
    getJobCounts.mockResolvedValue({
      waiting: 1,
      active: 2,
      completed: 3,
      failed: 4,
      delayed: 5,
      paused: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns counts for email, email-dlq and webhook queues", async () => {
    const statuses = await getQueuesStatus();

    expect(statuses.map((queue) => queue.name)).toEqual([
      "email",
      "email-dlq",
      "webhook",
    ]);
    expect(statuses[0]?.counts).toEqual({
      waiting: 1,
      active: 2,
      completed: 3,
      failed: 4,
      delayed: 5,
      paused: 0,
    });
    expect(getJobCounts).toHaveBeenCalledTimes(3);
  });
});
