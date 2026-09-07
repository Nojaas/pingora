import { API_KEY_HEADER } from "@pingora/shared";
import { getDashboardApiConfig } from "./env";
import type { NotificationsListResponse, QueuesResponse } from "./types";

export class DashboardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DashboardApiError";
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const { baseUrl, apiKey } = getDashboardApiConfig();

  if (!apiKey) {
    throw new DashboardApiError(
      "PINGORA_API_KEY is not set. Add it to the repo root .env (from pnpm db:seed).",
      503,
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      [API_KEY_HEADER]: apiKey,
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new DashboardApiError(
      `API ${path} failed with ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export function fetchNotifications(limit = 25) {
  return apiFetch<NotificationsListResponse>(`/notifications?limit=${limit}`);
}

export function fetchQueues() {
  return apiFetch<QueuesResponse>("/queues");
}
