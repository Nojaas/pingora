import type { BackoffOptions, JobsOptions } from "bullmq";

export const EMAIL_JOB_ATTEMPTS = 5;

export const EMAIL_JOB_BACKOFF_DELAY_MS = 1_000;

export const EMAIL_JOB_BACKOFF: BackoffOptions = {
  type: "exponential",
  delay: EMAIL_JOB_BACKOFF_DELAY_MS,
};

export const EMAIL_JOB_DEFAULT_OPTIONS = {
  attempts: EMAIL_JOB_ATTEMPTS,
  backoff: EMAIL_JOB_BACKOFF,
  removeOnComplete: 100,
  removeOnFail: 500,
} satisfies Pick<
  JobsOptions,
  "attempts" | "backoff" | "removeOnComplete" | "removeOnFail"
>;

/**
 * Délai avant la prochaine tentative — formule BullMQ :
 * `2 ^ (attemptsMade - 1) * delay` (1s, 2s, 4s, 8s…)
 */
export function getExponentialBackoffDelayMs(
  attemptsMade: number,
  baseDelayMs = EMAIL_JOB_BACKOFF_DELAY_MS,
): number {
  if (attemptsMade < 1) {
    return baseDelayMs;
  }

  return 2 ** (attemptsMade - 1) * baseDelayMs;
}

/** `attemptsMade` = échecs déjà enregistrés au moment du throw dans le processor */
export function isFinalJobAttempt(
  attemptsMade: number,
  maxAttempts = EMAIL_JOB_ATTEMPTS,
): boolean {
  return attemptsMade + 1 >= maxAttempts;
}
