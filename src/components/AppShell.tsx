import type { RouteDefinition } from "../lib/routes";
import { useAuth } from "../auth/AuthContext";

type AppShellProps = {
  activeRoute: RouteDefinition;
  onNavigate: (path: string) => void;
  routes: RouteDefinition[];
};

function getInitials(displayName: string) {
  return displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "V";
}

export function AppShell({ activeRoute, onNavigate, routes }: AppShellProps) {
  const Page = activeRoute.component;
  const { currentUser, isCheckingSession, logout } = useAuth();
  const primaryRoutes = routes.filter((route) => route.showInPrimaryNav === true);

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
                  <button className="text-action compact shell-friends-action" onClick={() => onNavigate("/friends")} type="button">
                    Friends
                  </button>
                  <button className="account-button" onClick={() => onNavigate("/profile")} type="button">
                    {currentUser.avatarUrl ? (
                      <img alt="" className="account-avatar" height="28" src={currentUser.avatarUrl} width="28" />
                    ) : (
                      <span className="account-avatar" aria-hidden="true">{getInitials(currentUser.displayName)}</span>
                    )}
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

      <main className="main-surface">
        <section className="page-masthead" aria-labelledby="page-title">
          <p className="eyebrow">{activeRoute.label}</p>
          <h1 id="page-title">{activeRoute.title}</h1>
        </section>

        <Page onNavigate={onNavigate} />
      </main>

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
