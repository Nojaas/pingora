import { PINGORA_VERSION } from "@pingora/shared";

export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Pingora Dashboard</h1>
      <p>Monorepo prêt — version {PINGORA_VERSION}</p>
    </main>
  );
}
