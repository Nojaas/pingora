import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALERT_TYPES,
  buildNotificationDlqAlert,
  emitAlert,
  formatAlert,
} from "./alerts.js";

describe("buildNotificationDlqAlert", () => {
  it("builds a structured DLQ alert", () => {
    const alert = buildNotificationDlqAlert({
      queue: "email-dlq",
      notificationId: "notif_1",
      jobId: "dlq-email-notif_1",
      error: "SMTP timeout",
      attempts: 5,
      timestamp: "2026-05-28T12:00:00.000Z",
    });

    expect(alert).toEqual({
      level: "error",
      type: ALERT_TYPES.NOTIFICATION_DLQ,
      queue: "email-dlq",
      notificationId: "notif_1",
      jobId: "dlq-email-notif_1",
      error: "SMTP timeout",
      attempts: 5,
      timestamp: "2026-05-28T12:00:00.000Z",
    });
  });
});

describe("emitAlert", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs JSON alert on stderr", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const alert = buildNotificationDlqAlert({
      queue: "email-dlq",
      notificationId: "notif_1",
      jobId: "dlq-email-notif_1",
      error: "SMTP timeout",
      attempts: 5,
    });

    emitAlert(alert);

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]?.[0]).toBe(
      `[pingora:alert] ${formatAlert(alert)}`,
    );
  });
});
