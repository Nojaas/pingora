export const ALERT_TYPES = {
  NOTIFICATION_DLQ: "notification.dlq",
} as const;

export type AlertType = (typeof ALERT_TYPES)[keyof typeof ALERT_TYPES];

export type AlertLevel = "error" | "warn";

export type AlertPayload = {
  level: AlertLevel;
  type: AlertType;
  queue: string;
  notificationId: string;
  jobId: string;
  error: string;
  attempts: number;
  timestamp: string;
};

export function buildNotificationDlqAlert(
  payload: Omit<AlertPayload, "level" | "type" | "timestamp"> & {
    timestamp?: string;
  },
): AlertPayload {
  return {
    level: "error",
    type: ALERT_TYPES.NOTIFICATION_DLQ,
    timestamp: payload.timestamp ?? new Date().toISOString(),
    queue: payload.queue,
    notificationId: payload.notificationId,
    jobId: payload.jobId,
    error: payload.error,
    attempts: payload.attempts,
  };
}

export function formatAlert(alert: AlertPayload): string {
  return JSON.stringify(alert);
}

export function emitAlert(alert: AlertPayload): void {
  const line = `[pingora:alert] ${formatAlert(alert)}`;

  if (alert.level === "error") {
    console.error(line);
    return;
  }

  console.warn(line);
}
