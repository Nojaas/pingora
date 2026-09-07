import type {
  FetchNotificationsParams,
} from "./api";
import type { NotificationsListResponse, QueuesResponse } from "./types";

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
