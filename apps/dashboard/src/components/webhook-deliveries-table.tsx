import type { WebhookDeliveryItem } from "../lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatLatency(value: number | null) {
  if (value == null) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

export function WebhookDeliveriesTable({
  deliveries,
}: {
  deliveries: WebhookDeliveryItem[];
}) {
  if (deliveries.length === 0) {
    return (
      <section className="panel">
        <div className="panel-header">
          <h2>Webhook deliveries</h2>
          <p>Aucune livraison pour ce filtre</p>
        </div>
        <p className="empty">
          Les deliveries apparaissent après un event notification.sent /
          notification.failed.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Webhook deliveries</h2>
        <p>{deliveries.length} plus récentes</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Event</th>
              <th>HTTP</th>
              <th>Attempts</th>
              <th>Latence</th>
              <th>Endpoint</th>
              <th>Créée</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((delivery) => (
              <tr key={delivery.id}>
                <td>
                  <span className="badge" data-status={delivery.status}>
                    {delivery.status}
                  </span>
                </td>
                <td className="mono">{delivery.event}</td>
                <td className="mono">{delivery.statusCode ?? "—"}</td>
                <td className="mono">{delivery.attempts}</td>
                <td className="mono">{formatLatency(delivery.latencyMs)}</td>
                <td className="mono">{delivery.endpointId}</td>
                <td className="mono">{formatDate(delivery.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
