import { useAuth } from "../auth/AuthContext";
import { AuthRequiredGate } from "../components/AuthRequiredGate";

type RoomShellPageProps = {
  onNavigate: (path: string) => void;
};

export function RoomShellPage({ onNavigate }: RoomShellPageProps) {
  const { currentUser, isCheckingSession } = useAuth();
  const returnTo = "/room";

  if (!isCheckingSession && !currentUser) {
    return (
      <AuthRequiredGate
        onLogin={() => onNavigate(`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`)}
        onSignup={() => onNavigate(`/auth?mode=signup&returnTo=${encodeURIComponent(returnTo)}`)}
      />
    );
  }

  return (
    <section className="room-frame">
      <div className="video-plane">
        <span>Room video surface</span>
      </div>
      <aside className="room-side">
        <p className="eyebrow">Room</p>
        <h2>Host-led session shell</h2>
        <p>Wave 4 and Wave 7 will attach room state, presence, chat, and playback control.</p>
      </aside>
    </section>
  );
}
