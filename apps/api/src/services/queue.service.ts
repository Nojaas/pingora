import {
  EMAIL_DLQ_QUEUE_NAME,
  EMAIL_QUEUE_NAME,
  WEBHOOK_QUEUE_NAME,
  getRedisConnectionOptions,
} from "@pingora/shared";
import { Queue } from "bullmq";

export const MONITORED_QUEUE_NAMES = [
  EMAIL_QUEUE_NAME,
  EMAIL_DLQ_QUEUE_NAME,
  WEBHOOK_QUEUE_NAME,
] as const;

export type MonitoredQueueName = (typeof MONITORED_QUEUE_NAMES)[number];

export type QueueCounts = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};

export type QueueStatus = {
  name: MonitoredQueueName;
  counts: QueueCounts;
};

const queues = new Map<string, Queue>();

function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: getRedisConnectionOptions(),
    });
    queues.set(name, queue);
  }
  return queue;
}

export async function getQueuesStatus(): Promise<QueueStatus[]> {
  const statuses = await Promise.all(
    MONITORED_QUEUE_NAMES.map(async (name) => {
      const counts = await getQueue(name).getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
      );

      return {
        name,
        counts: {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          paused: counts.paused ?? 0,
        },
      };
    }),
  );

  return statuses;
}
