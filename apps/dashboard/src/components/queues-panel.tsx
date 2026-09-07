import type { QueueStatus } from "../lib/types";

const COUNT_KEYS = [
  "waiting",
  "active",
  "delayed",
  "failed",
  "completed",
  "paused",
] as const;

type CountKey = (typeof COUNT_KEYS)[number];

export function QueuesPanel({ queues }: { queues: QueueStatus[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Queues BullMQ</h2>
        <p>Compteurs Redis en direct</p>
      </div>
      <div className="queues">
        {queues.map((queue) => (
          <article key={queue.name} className="queue">
            <p className="queue-name">{queue.name}</p>
            <div className="counts">
              {COUNT_KEYS.map((key: CountKey) => (
                <div key={key} className="count">
                  <span>{key}</span>
                  <strong>{queue.counts[key]}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
