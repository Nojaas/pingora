export type NotificationStatus =
  | "pending"
  | "queued"
  | "sent"
  | "failed"
  | "cancelled";

export type NotificationChannel = "email" | "sms" | "push";

export type NotificationItem = {
  id: string;
  status: string;
  channel: string;
  recipient: string;
  createdAt: string;
};

export type NotificationsListResponse = {
  data: NotificationItem[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type QueueCounts = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};

export type QueueStatus = {
  name: string;
  counts: QueueCounts;
};

export type QueuesResponse = {
  data: QueueStatus[];
};
