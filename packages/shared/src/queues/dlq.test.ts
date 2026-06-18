import { describe, expect, it } from "vitest";
import {
  areJobAttemptsExhausted,
  buildEmailDlqPayload,
  emailDlqJobDataSchema,
} from "./dlq.js";

describe("buildEmailDlqPayload", () => {
  it("builds a valid DLQ payload", () => {
    const payload = buildEmailDlqPayload({
      notificationId: "notif_1",
      sourceJobId: "email-notif_1",
      sourceQueue: "email",
      failedReason: "SMTP connection refused",
      attemptsMade: 5,
      failedAt: new Date("2026-05-28T12:00:00.000Z"),
    });

    expect(emailDlqJobDataSchema.safeParse(payload).success).toBe(true);
    expect(payload.failedAt).toBe("2026-05-28T12:00:00.000Z");
  });
});

describe("areJobAttemptsExhausted", () => {
  it("detects when retries are exhausted", () => {
    expect(areJobAttemptsExhausted(4, 5)).toBe(false);
    expect(areJobAttemptsExhausted(5, 5)).toBe(true);
  });
});
