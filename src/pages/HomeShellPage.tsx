import { useAuth } from "../auth/AuthContext";

type HomeShellPageProps = {
  onNavigate: (path: string) => void;
};

export function HomeShellPage({ onNavigate }: HomeShellPageProps) {
  const { currentUser } = useAuth();
  const primaryLabel = currentUser ? "Create a room" : "Discover live rooms";
  const primaryPath = currentUser ? "/create-room" : "/discover";
  const secondaryLabel = currentUser ? "Discover rooms" : "Create a room";
  const secondaryPath = currentUser ? "/discover" : "/create-room";

  return (
    <section className="home-page">
      <article className="home-hero surface-panel">
        <div className="home-hero-copy">
          <p className="eyebrow">Live social video rooms</p>
          <h2>Turn a YouTube link into a room people can join right now.</h2>
          <p>
            Vibehall gives every shared watch moment a host, a live timeline, readable chat, and a clear path from
            browsing to joining. Guests can look around first; members enter the room when they are ready.
          </p>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => onNavigate(primaryPath)} type="button">
              {primaryLabel}
            </button>
            <button className="secondary-action" onClick={() => onNavigate(secondaryPath)} type="button">
              {secondaryLabel}
            </button>
          </div>
        </div>

        <div className="home-room-preview" aria-label="Vibehall room flow preview">
          <div className="preview-player">
            <span className="preview-live-pill">Live room</span>
            <div className="preview-play-mark" aria-hidden="true">Play</div>
          </div>
          <div className="preview-room-body">
            <div>
              <p className="eyebrow">Host-led session</p>
              <h3>One shared timeline, one room conversation.</h3>
            </div>
            <div className="preview-room-meta">
              <span>Public or private</span>
              <span>Members join live</span>
              <span>Clear moderation</span>
            </div>
          </div>
        </div>
      </article>

      <div className="home-story-grid">
        <article className="surface-panel home-story-card">
          <span className="story-index">01</span>
          <p className="eyebrow">Find a room</p>
          <h3>Browse what is live without signing in.</h3>
          <p>Discover stays open for guests, so the platform can feel alive before account friction appears.</p>
        </article>
        <article className="surface-panel home-story-card">
          <span className="story-index">02</span>
          <p className="eyebrow">Join the moment</p>
          <h3>Room entry keeps identity and safety clear.</h3>
          <p>When a guest chooses a room, Vibehall preserves the intent and asks them to log in or sign up.</p>
        </article>
        <article className="surface-panel home-story-card">
          <span className="story-index">03</span>
          <p className="eyebrow">Host quickly</p>
          <h3>Create a live session from one YouTube link.</h3>
          <p>Members choose a title, category, size, and visibility, then move directly into the live room.</p>
        </article>
      </div>

      <section className="home-split-band">
        <article className="surface-panel home-callout">
          <p className="eyebrow">For the next room</p>
          <h2>{currentUser ? `Welcome back, ${currentUser.displayName}.` : "Start by looking around."}</h2>
          <p>
            {currentUser
              ? "Open a new room when you want to host, or browse public rooms when you want to join what is already happening."
              : "You can browse public rooms first. Creating or entering a room starts the member flow so every live session has real identity behind it."}
          </p>
        </article>
        <article className="surface-panel home-safety-note">
          <p className="eyebrow">Calm by design</p>
          <ul className="live-moment-list">
            <li>Public rooms appear in Discover only while they are live.</li>
            <li>Private rooms stay invite-link based and outside public browsing.</li>
            <li>Room reports and host moderation remain part of the experience.</li>
          </ul>
        </article>
      </section>
    </section>
  );
}