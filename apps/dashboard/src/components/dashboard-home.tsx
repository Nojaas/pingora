"use client";

import { useQuery } from "@tanstack/react-query";
import { PINGORA_VERSION } from "@pingora/shared";
import { fetchNotificationsClient, fetchQueuesClient } from "../lib/client-api";
import { NotificationsTable } from "./notifications-table";
import { QueuesPanel } from "./queues-panel";
import { DashboardToolbar } from "./dashboard-toolbar";
import { useDashboardUi } from "../store/dashboard-ui";

export function DashboardHome() {
  const status = useDashboardUi((state) => state.status);
  const channel = useDashboardUi((state) => state.channel);
  const refreshIntervalMs = useDashboardUi((state) => state.refreshIntervalMs);

  const refetchInterval = refreshIntervalMs === 0 ? false : refreshIntervalMs;

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

  const errorMessage =
    notificationsQuery.error?.message ?? queuesQuery.error?.message ?? null;
  const isInitialLoading =
    (notificationsQuery.isPending && !notificationsQuery.data) ||
    (queuesQuery.isPending && !queuesQuery.data);
  const isRefreshing =
    notificationsQuery.isFetching || queuesQuery.isFetching;

  return (
    <main>
      <header className="hero">
        <h1 className="brand">pingora</h1>
        <p className="tagline">
          Vue interne des notifications et des files BullMQ — livraison
          asynchrone, retries et DLQ.
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
          void notificationsQuery.refetch();
          void queuesQuery.refetch();
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
          <QueuesPanel queues={queuesQuery.data?.data ?? []} />
          <NotificationsTable
            notifications={notificationsQuery.data?.data ?? []}
          />
        </>
      )}
    </main>
  );
}
