import type { DashboardSummaryResponse } from "../lib/types";

function formatRate(value: number | null) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatLatency(value: number | null) {
  if (value == null) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

export function MetricsPanel({ summary }: { summary: DashboardSummaryResponse }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Métriques clés</h2>
        <p>Fenêtre {summary.window.hours}h</p>
      </div>
      <div className="metrics">
        <article className="metric">
          <p className="metric-label">Succès notifications</p>
          <p className="metric-value">
            {formatRate(summary.notifications.successRate)}
          </p>
          <p className="metric-meta">
            {summary.notifications.sent} sent / {summary.notifications.failed}{" "}
            failed
          </p>
        </article>
        <article className="metric">
          <p className="metric-label">Latence moyenne notif</p>
          <p className="metric-value">
            {formatLatency(summary.notifications.averageLatencyMs)}
          </p>
          <p className="metric-meta">sentAt − createdAt</p>
        </article>
        <article className="metric">
          <p className="metric-label">Succès webhooks</p>
          <p className="metric-value">
            {formatRate(summary.webhooks.successRate)}
          </p>
          <p className="metric-meta">
            {summary.webhooks.delivered} ok · {summary.webhooks.retrying} retry ·{" "}
            {summary.webhooks.failed} fail
          </p>
        </article>
        <article className="metric" data-alert={summary.dlq.count > 0 ? "true" : "false"}>
          <p className="metric-label">DLQ depth</p>
          <p className="metric-value">{summary.dlq.count}</p>
          <p className="metric-meta">
            {summary.dlq.queue} · waiting+active+delayed
          </p>
        </article>
      </div>
    </section>
  );
}
