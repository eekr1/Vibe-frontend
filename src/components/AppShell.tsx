import type { RouteDefinition } from "../lib/routes";
import { useAuth } from "../auth/AuthContext";

type AppShellProps = {
  activeRoute: RouteDefinition;
  onNavigate: (path: string) => void;
  routes: RouteDefinition[];
};

export function AppShell({ activeRoute, onNavigate, routes }: AppShellProps) {
  const Page = activeRoute.component;
  const { currentUser, isCheckingSession, logout } = useAuth();

  function navigateAuth(mode: "login" | "signup", returnTo = `${window.location.pathname}${window.location.search}`) {
    const params = new URLSearchParams({ mode, returnTo });
    onNavigate(`/auth?${params.toString()}`);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => onNavigate("/")} type="button">
          <span className="brand-mark">V</span>
          <span>Vibehall</span>
        </button>
        <nav className="nav" aria-label="Primary navigation">
          {routes.filter((route) => route.showInPrimaryNav !== false).map((route) => (
            <button
              className={route.path === activeRoute.path ? "nav-item is-active" : "nav-item"}
              key={route.path}
              onClick={() => onNavigate(route.path)}
              type="button"
            >
              {route.label}
            </button>
          ))}
        </nav>
        <div className="account-strip">
          {isCheckingSession ? (
            <span className="account-chip">Checking account</span>
          ) : currentUser ? (
            <>
              <span className="account-chip">{currentUser.displayName}</span>
              <button className="text-action compact" onClick={() => void logout()} type="button">
                Log out
              </button>
            </>
          ) : (
            <button className="secondary-action compact" onClick={() => navigateAuth("login")} type="button">
              Log in
            </button>
          )}
        </div>
      </header>

      <main className="main-surface">
        <section className="runtime-band">
          <div>
            <p className="eyebrow">Vibehall Video</p>
            <h1>{activeRoute.title}</h1>
          </div>
          <div className="runtime-status" aria-label="Live platform status">
            <span className="status-dot" />
            Live rooms ready
          </div>
        </section>

        <Page onNavigate={onNavigate} />
      </main>
      <footer className="trust-footer" aria-label="Platform trust links">
        <button type="button" onClick={() => onNavigate("/terms")}>
          Terms
        </button>
        <button type="button" onClick={() => onNavigate("/privacy")}>
          Privacy
        </button>
        <button type="button" onClick={() => onNavigate("/community-guidelines")}>
          Guidelines
        </button>
        <button type="button" onClick={() => onNavigate("/support")}>
          Support
        </button>
      </footer>
    </div>
  );
}
