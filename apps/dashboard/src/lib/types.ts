export type NotificationStatus =
  | "pending"
  | "queued"
  | "sent"
  | "failed"
  | "cancelled";

export type NotificationChannel = "email" | "sms" | "push";

export type WebhookDeliveryStatus =
  | "success"
  | "failed"
  | "pending"
  | "retrying";

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

export type WebhookDeliveryItem = {
  id: string;
  endpointId: string;
  notificationId: string;
  event: string;
  status: WebhookDeliveryStatus;
  statusCode: number | null;
  attempts: number;
  nextRetryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  latencyMs: number | null;
};

export type WebhookDeliveriesListResponse = {
  data: WebhookDeliveryItem[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type DashboardSummaryResponse = {
  window: {
    from: string;
    to: string;
    hours: number;
  };
  notifications: {
    successRate: number | null;
    sent: number;
    failed: number;
    pending: number;
    cancelled: number;
    total: number;
    averageLatencyMs: number | null;
  };
  webhooks: {
    successRate: number | null;
    delivered: number;
    failed: number;
    pending: number;
    retrying: number;
    total: number;
    averageLatencyMs: number | null;
  };
  dlq: {
    queue: string;
    count: number;
    counts: QueueCounts;
  };
};
