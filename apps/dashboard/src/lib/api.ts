import { API_KEY_HEADER } from "@pingora/shared";
import { getDashboardApiConfig } from "./env";
import type {
  DashboardSummaryResponse,
  NotificationChannel,
  NotificationStatus,
  NotificationsListResponse,
  QueuesResponse,
  WebhookDeliveriesListResponse,
  WebhookDeliveryStatus,
} from "./types";

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

export type FetchNotificationsParams = {
  limit?: number;
  status?: NotificationStatus;
  channel?: NotificationChannel;
};

export type FetchWebhookDeliveriesParams = {
  limit?: number;
  status?: WebhookDeliveryStatus;
};

export function fetchNotifications(params: FetchNotificationsParams = {}) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 25));
  if (params.status) search.set("status", params.status);
  if (params.channel) search.set("channel", params.channel);
  return apiFetch<NotificationsListResponse>(`/notifications?${search}`);
}

export function fetchQueues() {
  return apiFetch<QueuesResponse>("/queues");
}

export function fetchWebhookDeliveries(
  params: FetchWebhookDeliveriesParams = {},
) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 25));
  if (params.status) search.set("status", params.status);
  return apiFetch<WebhookDeliveriesListResponse>(
    `/webhooks/deliveries?${search}`,
  );
}

export function fetchDashboardSummary(windowHours = 24) {
  const search = new URLSearchParams();
  search.set("windowHours", String(windowHours));
  return apiFetch<DashboardSummaryResponse>(`/dashboard/summary?${search}`);
}
