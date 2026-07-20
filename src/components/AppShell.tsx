import { useEffect, useState } from "react";
import type { RouteDefinition } from "../lib/routes";
import { useAuth } from "../auth/AuthContext";
import { getNotificationSummary, type NotificationSummary } from "../social/socialApi";
import { SocialRail } from "../social/SocialRail";
import { ConversationPanel } from "../social/ConversationPanel";
import { Avatar } from "./ui";

type AppShellProps = {
  activeRoute: RouteDefinition;
  onNavigate: (path: string) => void;
  routes: RouteDefinition[];
};

const hiddenSocialRoutes = new Set(["*", "/admin", "/auth", "/auth/reset", "/community-guidelines", "/privacy", "/support", "/terms"]);
const emptySummary: NotificationSummary = { actionableCount: 0, unreadCount: 0 };

export function AppShell({ activeRoute, onNavigate, routes }: AppShellProps) {
  const Page = activeRoute.component;
  const { currentUser, isCheckingSession, logout } = useAuth();
  const primaryRoutes = routes.filter((route) => route.showInPrimaryNav === true);
  const socialEligible = Boolean(currentUser && !hiddenSocialRoutes.has(activeRoute.path));
  const socialMode = activeRoute.path === "/room" ? "drawer" : "rail";
  const [socialOpen, setSocialOpen] = useState(() => window.localStorage.getItem("vibehall:social-rail-open") === "true");
  const [socialSummary, setSocialSummary] = useState<NotificationSummary>(emptySummary);
  const socialBadge = socialSummary.unreadCount + socialSummary.actionableCount;

  const [dockedConversationId, setDockedConversationId] = useState<string | null>(null);
  const [dockedMinimized, setDockedMinimized] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("vibehall:social-rail-open", socialOpen ? "true" : "false");
  }, [socialOpen]);

  useEffect(() => {
    if (isCheckingSession) return;
    if (!socialEligible) { setSocialOpen(false); setSocialSummary(emptySummary); return; }
    let active = true;
    getNotificationSummary().then((summary) => { if (active) setSocialSummary(summary); }).catch(() => undefined);
    return () => { active = false; };
  }, [socialEligible, isCheckingSession, currentUser?.id]);

  function navigateAuth(mode: "login" | "signup", returnTo = `${window.location.pathname}${window.location.search}`) {
    const params = new URLSearchParams({ mode, returnTo });
    onNavigate(`/auth?${params.toString()}`);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => onNavigate("/")} type="button" aria-label="Go to Vibehall home">
            <span className="brand-mark">V</span>
            <span className="brand-copy">
              <span className="brand-name">Vibehall</span>
              <span className="brand-subtitle">Shared video rooms</span>
            </span>
          </button>

          <nav className="nav" aria-label="Primary navigation">
            {primaryRoutes.map((route) => (
              <button
                aria-current={route.path === activeRoute.path ? "page" : undefined}
                className={route.path === activeRoute.path ? "nav-item is-active" : "nav-item"}
                key={route.path}
                onClick={() => onNavigate(route.path)}
                type="button"
              >
                {route.label}
              </button>
            ))}
          </nav>

          <div className="shell-actions" aria-label="Account and room actions">
            <button className="primary-action compact shell-create-action" onClick={() => onNavigate("/create-room")} type="button">
              Create room
            </button>

            <div className="account-strip">
              {isCheckingSession ? (
                <span className="account-chip is-loading">Checking account</span>
              ) : currentUser ? (
                <>
                  {socialEligible ? (
                    <button aria-controls="social-rail" aria-expanded={socialOpen} aria-label={`Social updates${socialBadge ? `, ${socialBadge} unread or actionable` : ""}`} className="text-action compact shell-social-action" onClick={() => setSocialOpen((value) => !value)} type="button">
                      Social{socialBadge ? <span className="social-badge" aria-hidden="true">{socialBadge}</span> : null}
                    </button>
                  ) : null}
                  <button className="text-action compact shell-friends-action" onClick={() => onNavigate("/friends")} type="button">
                    Friends
                  </button>
                  <button className="account-button" onClick={() => onNavigate("/profile")} type="button">
                    <Avatar displayName={currentUser.displayName} size="small" src={currentUser.avatarUrl} />
                    <span className="account-copy">
                      <span className="account-name">{currentUser.displayName}</span>
                      <span className="account-meta">Profile</span>
                    </span>
                  </button>
                  {currentUser.role === "admin" ? (
                    <button className="text-action compact" onClick={() => onNavigate("/admin")} type="button">
                      Admin
                    </button>
                  ) : null}
                  <button className="text-action compact" onClick={() => void logout()} type="button">
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <button className="secondary-action compact" onClick={() => navigateAuth("login")} type="button">
                    Log in
                  </button>
                  <button className="text-action compact" onClick={() => navigateAuth("signup")} type="button">
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={socialEligible && socialOpen && socialMode === "rail" ? "main-surface has-social-rail" : "main-surface"}>
        <section className="page-masthead" aria-labelledby="page-title">
          <p className="eyebrow">{activeRoute.label}</p>
          <h1 id="page-title">{activeRoute.title}</h1>
        </section>

        <Page onNavigate={onNavigate} />
      </main>

      {socialEligible ? (
        <>
          <SocialRail mode={socialMode} onBadgeChange={setSocialSummary} onClose={() => setSocialOpen(false)} onNavigate={onNavigate} open={socialOpen} onOpenConversation={(id) => { setDockedConversationId(id); setDockedMinimized(false); }} />
          {dockedConversationId && (
            <div className="docked-conversation-wrapper">
              <ConversationPanel
                conversationId={dockedConversationId}
                minimized={dockedMinimized}
                onClose={() => setDockedConversationId(null)}
                onMinimizeToggle={() => setDockedMinimized(!dockedMinimized)}
                onNavigate={onNavigate}
              />
            </div>
          )}
        </>
      ) : null}

      <footer className="trust-footer" aria-label="Platform trust links">
        <div className="trust-footer-inner">
          <div className="trust-footer-copy">
            <strong>Vibehall</strong>
            <span>Shared rooms, clear rules, calm support.</span>
          </div>
          <nav className="trust-footer-links" aria-label="Trust and support navigation">
            <button type="button" onClick={() => onNavigate("/terms")}>Terms</button>
            <button type="button" onClick={() => onNavigate("/privacy")}>Privacy</button>
            <button type="button" onClick={() => onNavigate("/community-guidelines")}>Guidelines</button>
            <button type="button" onClick={() => onNavigate("/support")}>Support</button>
          </nav>
        </div>
      </footer>
    </div>
  );
}
