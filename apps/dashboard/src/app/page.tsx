import { PINGORA_VERSION } from "@pingora/shared";
import { DashboardApiError, fetchNotifications, fetchQueues } from "../lib/api";
import { getDashboardApiConfig } from "../lib/env";
import { NotificationsTable } from "../components/notifications-table";
import { QueuesPanel } from "../components/queues-panel";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { baseUrl, apiKey } = getDashboardApiConfig();

  if (!apiKey) {
    return (
      <main>
        <header className="hero">
          <h1 className="brand">pingora</h1>
          <p className="tagline">
            Dashboard de monitoring — configure l’accès API pour charger les
            données.
          </p>
        </header>
        <section className="panel">
          <p className="error">
            Manque <code>PINGORA_API_KEY</code> dans le <code>.env</code> à la
            racine (clé affichée par <code>pnpm db:seed</code>).
          </p>
        </section>
      </main>
    );
  }

  try {
    const [notifications, queues] = await Promise.all([
      fetchNotifications(25),
      fetchQueues(),
    ]);

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
            <span>API {baseUrl}</span>
            <span>refresh on load</span>
          </div>
        </header>

        <QueuesPanel queues={queues.data} />
        <NotificationsTable notifications={notifications.data} />
      </main>
    );
  } catch (error) {
    const message =
      error instanceof DashboardApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown dashboard error";

    return (
      <main>
        <header className="hero">
          <h1 className="brand">pingora</h1>
          <p className="tagline">
            Impossible de joindre l’API. Vérifie que <code>pnpm dev</code> tourne
            et que la clé est valide.
          </p>
        </header>
        <section className="panel">
          <p className="error">{message}</p>
        </section>
      </main>
    );
  }
}
