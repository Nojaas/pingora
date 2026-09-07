import type {
  FetchNotificationsParams,
  FetchWebhookDeliveriesParams,
} from "./api";
import type {
  DashboardSummaryResponse,
  NotificationsListResponse,
  QueuesResponse,
  WebhookDeliveriesListResponse,
} from "./types";

export class ClientApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

async function bffFetch<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request ${path} failed with ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new ClientApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export function fetchNotificationsClient(params: FetchNotificationsParams = {}) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 25));
  if (params.status) search.set("status", params.status);
  if (params.channel) search.set("channel", params.channel);
  return bffFetch<NotificationsListResponse>(`/api/notifications?${search}`);
}

export function fetchQueuesClient() {
  return bffFetch<QueuesResponse>("/api/queues");
}

export function fetchWebhookDeliveriesClient(
  params: FetchWebhookDeliveriesParams = {},
) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 25));
  if (params.status) search.set("status", params.status);
  return bffFetch<WebhookDeliveriesListResponse>(
    `/api/webhook-deliveries?${search}`,
  );
}

export function fetchDashboardSummaryClient(windowHours = 24) {
  const search = new URLSearchParams();
  search.set("windowHours", String(windowHours));
  return bffFetch<DashboardSummaryResponse>(`/api/dashboard-summary?${search}`);
}
