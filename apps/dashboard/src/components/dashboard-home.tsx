"use client";

import { PINGORA_VERSION } from "@pingora/shared";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardSummaryClient,
  fetchNotificationsClient,
  fetchQueuesClient,
  fetchWebhookDeliveriesClient,
} from "../lib/client-api";
import { useDashboardUi } from "../store/dashboard-ui";
import { DashboardToolbar } from "./dashboard-toolbar";
import { MetricsPanel } from "./metrics-panel";
import { NotificationsTable } from "./notifications-table";
import { QueuesPanel } from "./queues-panel";
import { WebhookDeliveriesTable } from "./webhook-deliveries-table";

export function DashboardHome() {
  const status = useDashboardUi((state) => state.status);
  const channel = useDashboardUi((state) => state.channel);
  const deliveryStatus = useDashboardUi((state) => state.deliveryStatus);
  const refreshIntervalMs = useDashboardUi((state) => state.refreshIntervalMs);

  const refetchInterval = refreshIntervalMs === 0 ? false : refreshIntervalMs;

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", { windowHours: 24 }],
    queryFn: () => fetchDashboardSummaryClient(24),
    refetchInterval,
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", { status, channel, limit: 25 }],
    queryFn: () =>
      fetchNotificationsClient({
        limit: 25,
        status: status === "all" ? undefined : status,
        channel: channel === "all" ? undefined : channel,
      }),
    refetchInterval,
  });

  const queuesQuery = useQuery({
    queryKey: ["queues"],
    queryFn: fetchQueuesClient,
    refetchInterval,
  });

  const deliveriesQuery = useQuery({
    queryKey: ["webhook-deliveries", { status: deliveryStatus, limit: 25 }],
    queryFn: () =>
      fetchWebhookDeliveriesClient({
        limit: 25,
        status: deliveryStatus === "all" ? undefined : deliveryStatus,
      }),
    refetchInterval,
  });

  const errorMessage =
    summaryQuery.error?.message ??
    notificationsQuery.error?.message ??
    queuesQuery.error?.message ??
    deliveriesQuery.error?.message ??
    null;

  const isInitialLoading =
    (summaryQuery.isPending && !summaryQuery.data) ||
    (notificationsQuery.isPending && !notificationsQuery.data) ||
    (queuesQuery.isPending && !queuesQuery.data) ||
    (deliveriesQuery.isPending && !deliveriesQuery.data);

  const isRefreshing =
    summaryQuery.isFetching ||
    notificationsQuery.isFetching ||
    queuesQuery.isFetching ||
    deliveriesQuery.isFetching;

  return (
    <main>
      <header className="hero">
        <h1 className="brand">pingora</h1>
        <p className="tagline">
          Monitoring notifications, queues BullMQ, deliveries webhook et KPIs
          (succès, latence, DLQ).
        </p>
        <div className="meta">
          <span>v{PINGORA_VERSION}</span>
          <span>
            {refreshIntervalMs === 0
              ? "refresh manuel"
              : `auto ${refreshIntervalMs / 1000}s`}
          </span>
          <span data-live={isRefreshing ? "true" : "false"}>
            {isRefreshing ? "sync…" : "à jour"}
          </span>
        </div>
      </header>

      <DashboardToolbar
        onRefresh={() => {
          void summaryQuery.refetch();
          void notificationsQuery.refetch();
          void queuesQuery.refetch();
          void deliveriesQuery.refetch();
        }}
        isRefreshing={isRefreshing}
      />

      {errorMessage ? (
        <section className="panel">
          <p className="error">{errorMessage}</p>
        </section>
      ) : null}

      {isInitialLoading ? (
        <section className="panel">
          <p className="empty">Chargement des métriques…</p>
        </section>
      ) : (
        <>
          {summaryQuery.data ? (
            <MetricsPanel summary={summaryQuery.data} />
          ) : null}
          <QueuesPanel queues={queuesQuery.data?.data ?? []} />
          <NotificationsTable
            notifications={notificationsQuery.data?.data ?? []}
          />
          <WebhookDeliveriesTable
            deliveries={deliveriesQuery.data?.data ?? []}
          />
        </>
      )}
    </main>
  );
}
