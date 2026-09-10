import type { NotificationItem } from "../lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function NotificationsTable({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  if (notifications.length === 0) {
    return (
      <section className="panel">
        <div className="panel-header">
          <h2>Notifications</h2>
          <p>Aucune notification pour cette API key</p>
        </div>
        <p className="empty">
          Envoie un POST /notifications pour peupler la liste.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Notifications</h2>
        <p>{notifications.length} plus récentes</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Canal</th>
              <th>Destinataire</th>
              <th>Id</th>
              <th>Créée</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((notification) => (
              <tr key={notification.id}>
                <td>
                  <span
                    className="badge"
                    data-status={notification.status.toLowerCase()}
                  >
                    {notification.status}
                  </span>
                </td>
                <td className="mono">{notification.channel}</td>
                <td>{notification.recipient}</td>
                <td className="mono">{notification.id}</td>
                <td className="mono">{formatDate(notification.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
