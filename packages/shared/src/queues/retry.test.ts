import { describe, expect, it } from "vitest";
import {
  EMAIL_JOB_ATTEMPTS,
  EMAIL_JOB_BACKOFF_DELAY_MS,
  getExponentialBackoffDelayMs,
  isFinalJobAttempt,
} from "./retry.js";

describe("getExponentialBackoffDelayMs", () => {
  it("follows BullMQ exponential sequence 1s → 2s → 4s → 8s", () => {
    expect(getExponentialBackoffDelayMs(1)).toBe(1_000);
    expect(getExponentialBackoffDelayMs(2)).toBe(2_000);
    expect(getExponentialBackoffDelayMs(3)).toBe(4_000);
    expect(getExponentialBackoffDelayMs(4)).toBe(8_000);
  });

  it("uses custom base delay", () => {
    expect(getExponentialBackoffDelayMs(2, 500)).toBe(1_000);
  });
});

describe("isFinalJobAttempt", () => {
  it("returns false until the last allowed attempt", () => {
    expect(isFinalJobAttempt(0, EMAIL_JOB_ATTEMPTS)).toBe(false);
    expect(isFinalJobAttempt(1, EMAIL_JOB_ATTEMPTS)).toBe(false);
    expect(isFinalJobAttempt(2, EMAIL_JOB_ATTEMPTS)).toBe(false);
    expect(isFinalJobAttempt(3, EMAIL_JOB_ATTEMPTS)).toBe(false);
    expect(isFinalJobAttempt(4, EMAIL_JOB_ATTEMPTS)).toBe(true);
  });

  it("matches pingora.md max 5 attempts", () => {
    expect(EMAIL_JOB_ATTEMPTS).toBe(5);
    expect(EMAIL_JOB_BACKOFF_DELAY_MS).toBe(1_000);
  });
});
