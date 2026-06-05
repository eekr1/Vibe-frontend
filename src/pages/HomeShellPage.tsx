import { useAuth } from "../auth/AuthContext";

export function HomeShellPage() {
  const { currentUser } = useAuth();

  return (
    <section className="shell-grid">
      <article className="surface-panel primary-panel">
        <p className="eyebrow">App boot</p>
        <h2>Frontend routing, layout, and global state surfaces are ready.</h2>
        <p>
          This shell is now prepared for Wave 3 auth screens and later room-centered product
          surfaces.
        </p>
      </article>
      <article className="surface-panel">
        <p className="eyebrow">API target</p>
        <h2>{import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api"}</h2>
      </article>
      <article className="surface-panel">
        <p className="eyebrow">Realtime target</p>
        <h2>{import.meta.env.VITE_WS_URL ?? "http://localhost:4000/realtime"}</h2>
      </article>
      <article className="surface-panel">
        <p className="eyebrow">Session</p>
        <h2>{currentUser ? currentUser.displayName : "Guest browsing"}</h2>
      </article>
    </section>
  );
}
