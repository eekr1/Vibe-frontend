import { useAuth } from "../auth/AuthContext";

type HomeShellPageProps = {
  onNavigate: (path: string) => void;
};

export function HomeShellPage({ onNavigate }: HomeShellPageProps) {
  const { currentUser } = useAuth();

  return (
    <section className="shell-grid">
      <article className="surface-panel primary-panel">
        <p className="eyebrow">Live social video rooms</p>
        <h2>Watch YouTube together in rooms that feel live from the first click.</h2>
        <p>
          Vibehall turns a video link into a shared room: one host leads the timeline, people join the
          current moment, and chat stays tied to the session.
        </p>
        <div className="hero-actions">
          <button className="primary-action" onClick={() => onNavigate("/discover")} type="button">
            Discover live rooms
          </button>
          <button className="secondary-action" onClick={() => onNavigate("/create-room")} type="button">
            Create a room
          </button>
        </div>
      </article>
      <article className="surface-panel">
        <p className="eyebrow">Browse what is live</p>
        <h2>Discover public rooms before you sign in.</h2>
        <p>See what people are watching now. When you choose a room, Vibehall keeps your path and asks you to log in.</p>
      </article>
      <article className="surface-panel">
        <p className="eyebrow">Host the moment</p>
        <h2>Open a room from one YouTube link.</h2>
        <p>Pick a title, category, room size, and visibility. Public rooms appear in Discover; private rooms use a direct invite link.</p>
      </article>
      <article className="surface-panel">
        <p className="eyebrow">Your next step</p>
        <h2>{currentUser ? `Welcome back, ${currentUser.displayName}` : "Start as a guest"}</h2>
        <p>
          {currentUser
            ? "You can join a live room, open your own session, or update your room identity."
            : "Browse first. Create an account only when you are ready to enter or host a room."}
        </p>
      </article>
      <article className="surface-panel live-moment-panel">
        <p className="eyebrow">How it works</p>
        <ul className="live-moment-list">
          <li>Paste a YouTube link.</li>
          <li>Create a public or private room.</li>
          <li>Invite people into the same timeline.</li>
          <li>Watch, chat, report, and moderate with clear room context.</li>
        </ul>
      </article>
    </section>
  );
}
