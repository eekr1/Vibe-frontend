import { useAuth } from "../auth/AuthContext";

export function HomeShellPage() {
  const { currentUser } = useAuth();

  return (
    <section className="shell-grid">
      <article className="surface-panel primary-panel">
        <p className="eyebrow">Watch together</p>
        <h2>Host a room, invite people in, and keep the whole session in sync.</h2>
        <p>
          Vibehall is built around shared YouTube rooms: one host controls the timeline,
          participants chat live, and moderation/reporting stays traceable.
        </p>
      </article>
      <article className="surface-panel">
        <p className="eyebrow">Discover</p>
        <h2>Find public rooms that are live right now.</h2>
        <p>Browse before logging in, then sign in only when you are ready to join or host.</p>
      </article>
      <article className="surface-panel">
        <p className="eyebrow">Private rooms</p>
        <h2>Share a direct invite link for smaller sessions.</h2>
        <p>Private rooms stay out of Discover and require the room password after login.</p>
      </article>
      <article className="surface-panel">
        <p className="eyebrow">Session</p>
        <h2>{currentUser ? currentUser.displayName : "Guest browsing"}</h2>
        <p>{currentUser ? "You are ready to create or join rooms." : "You can explore public rooms before joining."}</p>
      </article>
    </section>
  );
}
