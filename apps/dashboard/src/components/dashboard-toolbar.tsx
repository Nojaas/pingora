"use client";

import {
  useDashboardUi,
  type RefreshIntervalMs,
} from "../store/dashboard-ui";
import type {
  NotificationChannel,
  NotificationStatus,
  WebhookDeliveryStatus,
} from "../lib/types";

const STATUS_OPTIONS: Array<NotificationStatus | "all"> = [
  "all",
  "pending",
  "queued",
  "sent",
  "failed",
  "cancelled",
];

const CHANNEL_OPTIONS: Array<NotificationChannel | "all"> = [
  "all",
  "email",
  "sms",
  "push",
];

const DELIVERY_STATUS_OPTIONS: Array<WebhookDeliveryStatus | "all"> = [
  "all",
  "success",
  "failed",
  "pending",
  "retrying",
];

const REFRESH_OPTIONS: Array<{ value: RefreshIntervalMs; label: string }> = [
  { value: 0, label: "Off" },
  { value: 5_000, label: "5s" },
  { value: 15_000, label: "15s" },
  { value: 30_000, label: "30s" },
];

export function DashboardToolbar({
  onRefresh,
  isRefreshing,
}: {
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const status = useDashboardUi((state) => state.status);
  const channel = useDashboardUi((state) => state.channel);
  const deliveryStatus = useDashboardUi((state) => state.deliveryStatus);
  const refreshIntervalMs = useDashboardUi((state) => state.refreshIntervalMs);
  const setStatus = useDashboardUi((state) => state.setStatus);
  const setChannel = useDashboardUi((state) => state.setChannel);
  const setDeliveryStatus = useDashboardUi((state) => state.setDeliveryStatus);
  const setRefreshIntervalMs = useDashboardUi(
    (state) => state.setRefreshIntervalMs,
  );

  return (
    <section className="toolbar" aria-label="Filtres dashboard">
      <label className="field">
        <span>Notif status</span>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as NotificationStatus | "all")
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "tous" : option}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Canal</span>
        <select
          value={channel}
          onChange={(event) =>
            setChannel(event.target.value as NotificationChannel | "all")
          }
        >
          {CHANNEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "tous" : option}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Webhook status</span>
        <select
          value={deliveryStatus}
          onChange={(event) =>
            setDeliveryStatus(
              event.target.value as WebhookDeliveryStatus | "all",
            )
          }
        >
          {DELIVERY_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "tous" : option}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Auto-refresh</span>
        <select
          value={refreshIntervalMs}
          onChange={(event) =>
            setRefreshIntervalMs(
              Number(event.target.value) as RefreshIntervalMs,
            )
          }
        >
          {REFRESH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="refresh-btn"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        Rafraîchir
      </button>
    </section>
  );
}
