import {
  CaretDownIcon,
  GearIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UserCircleIcon,
  UsersThreeIcon
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import type { RouteDefinition } from "../lib/routes";
import { ConversationPanel } from "../social/ConversationPanel";
import { getNotificationSummary, type NotificationSummary } from "../social/socialApi";
import { SocialRail } from "../social/SocialRail";
import { Avatar, Button, IconButton, PopoverMenu } from "./ui";

type AppShellProps = {
  activeRoute: RouteDefinition;
  onNavigate: (path: string) => void;
  routes: RouteDefinition[];
};

type DesktopHeaderProps = {
  accountArea: ReactNode;
  activeRoute: RouteDefinition;
  onNavigate: (path: string) => void;
  primaryRoutes: RouteDefinition[];
  variant: "app" | "home";
};

const hiddenSocialShells = new Set<RouteDefinition["shell"]>(["admin", "room", "utility"]);
const emptySummary: NotificationSummary = { actionableCount: 0, unreadCount: 0 };

function displayCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function DesktopHeader({
  accountArea,
  activeRoute,
  onNavigate,
  primaryRoutes,
  variant
}: DesktopHeaderProps) {
  return (
    <header className={"topbar topbar--" + variant} data-shell-variant={variant}>
      <div className="topbar-inner">
        <button
          aria-label="Go to Vibehall home"
          className="brand"
          onClick={() => onNavigate("/")}
          type="button"
        >
          <span className="brand-name">Vibehall</span>
        </button>

        <nav aria-label="Primary navigation" className="nav">
          {primaryRoutes.map((route) => {
            const active = route.path === activeRoute.path;
            return (
              <button
                aria-current={active ? "page" : undefined}
                className={active ? "nav-item is-active" : "nav-item"}
                key={route.path}
                onClick={() => onNavigate(route.path)}
                type="button"
              >
                {route.label}
              </button>
            );
          })}
        </nav>

        <div aria-label="Account and social actions" className="shell-actions">
          {accountArea}
        </div>
      </div>
    </header>
  );
}

function HomeHeader(props: Omit<DesktopHeaderProps, "variant">) {
  return <DesktopHeader {...props} variant="home" />;
}

function AppHeader(props: Omit<DesktopHeaderProps, "variant">) {
  return <DesktopHeader {...props} variant="app" />;
}

export function AppShell({ activeRoute, onNavigate, routes }: AppShellProps) {
  const Page = activeRoute.component;
  const { currentUser, isCheckingSession, logout } = useAuth();
  const primaryRoutes = routes.filter((route) => route.showInPrimaryNav === true);
  const socialEligible = Boolean(currentUser && !hiddenSocialShells.has(activeRoute.shell));
  const [socialExpanded, setSocialExpanded] = useState(
    () => window.localStorage.getItem("vibehall:social-rail-open") === "true"
  );
  const [socialSummary, setSocialSummary] = useState<NotificationSummary>(emptySummary);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const socialBadge = socialSummary.unreadCount + socialSummary.actionableCount;

  const [dockedConversationId, setDockedConversationId] = useState<string | null>(null);
  const [dockedMinimized, setDockedMinimized] = useState(false);

  const closeProfileMenu = useCallback(() => setProfileMenuOpen(false), []);

  useEffect(() => {
    window.localStorage.setItem("vibehall:social-rail-open", socialExpanded ? "true" : "false");
  }, [socialExpanded]);

  useEffect(() => {
    setProfileMenuOpen(false);
    if (!socialEligible) {
      setDockedConversationId(null);
      setDockedMinimized(false);
    }
  }, [activeRoute.path, socialEligible]);

  useEffect(() => {
    if (isCheckingSession) return;
    if (!socialEligible) {
      setSocialSummary(emptySummary);
      return;
    }

    let active = true;
    getNotificationSummary()
      .then((summary) => {
        if (active) setSocialSummary(summary);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [socialEligible, isCheckingSession, currentUser?.id]);

  function navigateAuth(
    mode: "login" | "signup",
    returnTo = window.location.pathname + window.location.search
  ) {
    const params = new URLSearchParams({ mode, returnTo });
    onNavigate("/auth?" + params.toString());
  }

  function navigateFromProfile(path: string) {
    closeProfileMenu();
    onNavigate(path);
  }

  const accountArea = isCheckingSession ? (
    <span aria-label="Checking account" className="account-placeholder" role="status">
      <span aria-hidden="true" className="account-placeholder-avatar" />
      <span aria-hidden="true" className="account-placeholder-copy" />
    </span>
  ) : currentUser ? (
    <div className="account-strip">
      {socialEligible ? (
        <span className="shell-social-control">
          <IconButton
            aria-controls="social-rail"
            aria-expanded={socialExpanded}
            className="shell-social-action"
            icon={<UsersThreeIcon size={20} />}
            label={
              socialBadge
                ? "Social updates, " + socialBadge + " unread or actionable"
                : "Social"
            }
            onClick={() => setSocialExpanded((value) => !value)}
            variant="text"
          />
          {socialBadge ? (
            <span aria-hidden="true" className="social-badge shell-social-badge">
              {displayCount(socialBadge)}
            </span>
          ) : null}
        </span>
      ) : null}

      <button
        aria-expanded={profileMenuOpen}
        aria-haspopup="menu"
        className="account-button"
        onClick={() => setProfileMenuOpen((value) => !value)}
        ref={profileTriggerRef}
        type="button"
      >
        <Avatar displayName={currentUser.displayName} size="small" src={currentUser.avatarUrl} />
        <span className="account-copy">
          <span className="account-name">{currentUser.displayName}</span>
          <span className="account-meta">@{currentUser.username}</span>
        </span>
        <CaretDownIcon aria-hidden="true" className="account-caret" size={14} />
      </button>
    </div>
  ) : (
    <div className="shell-auth-actions">
      <Button onClick={() => navigateAuth("login")} size="small" variant="secondary">
        Log in
      </Button>
      <Button onClick={() => navigateAuth("signup")} size="small" variant="text">
        Sign up
      </Button>
    </div>
  );

  const shellClasses = [
    "app-shell",
    "app-shell--" + activeRoute.shell,
    socialEligible ? "has-social-rail" : "",
    socialEligible && socialExpanded ? "is-social-rail-expanded" : ""
  ].filter(Boolean).join(" ");

  if (activeRoute.shell === "room") {
    return (
      <div className={shellClasses}>
        <main className="room-surface">
          <Page onNavigate={onNavigate} />
        </main>
      </div>
    );
  }

  const Header = activeRoute.shell === "home" ? HomeHeader : AppHeader;

  return (
    <div className={shellClasses}>
      <Header
        accountArea={accountArea}
        activeRoute={activeRoute}
        onNavigate={onNavigate}
        primaryRoutes={primaryRoutes}
      />

      {profileMenuOpen && currentUser ? (
        <PopoverMenu
          align="end"
          anchorRef={profileTriggerRef}
          className="profile-menu"
          id="profile-menu"
          label="Account menu"
          onClose={closeProfileMenu}
        >
          <button onClick={() => navigateFromProfile("/profile")} role="menuitem" type="button">
            <UserCircleIcon aria-hidden="true" size={18} />
            <span>Profile</span>
          </button>
          <button onClick={() => navigateFromProfile("/settings")} role="menuitem" type="button">
            <GearIcon aria-hidden="true" size={18} />
            <span>Settings</span>
          </button>
          {currentUser.role === "admin" ? (
            <button onClick={() => navigateFromProfile("/admin")} role="menuitem" type="button">
              <ShieldCheckIcon aria-hidden="true" size={18} />
              <span>Admin</span>
            </button>
          ) : null}
          <span aria-hidden="true" className="profile-menu-separator" />
          <button
            className="is-danger"
            onClick={() => {
              closeProfileMenu();
              void logout();
            }}
            role="menuitem"
            type="button"
          >
            <SignOutIcon aria-hidden="true" size={18} />
            <span>Log out</span>
          </button>
        </PopoverMenu>
      ) : null}

      <main className="main-surface">
        <section aria-labelledby="page-title" className="page-masthead">
          <p className="eyebrow">{activeRoute.label}</p>
          <h1 id="page-title">{activeRoute.title}</h1>
        </section>

        <Page onNavigate={onNavigate} />
      </main>

      {socialEligible ? (
        <>
          <SocialRail
            mode="rail"
            onBadgeChange={setSocialSummary}
            onClose={() => setSocialExpanded(false)}
            onNavigate={onNavigate}
            onOpenConversation={(id) => {
              setDockedConversationId(id);
              setDockedMinimized(false);
            }}
            onToggle={() => setSocialExpanded((value) => !value)}
            open={socialExpanded}
            summary={socialSummary}
          />
          {dockedConversationId ? (
            <div className="docked-conversation-wrapper">
              <ConversationPanel
                conversationId={dockedConversationId}
                minimized={dockedMinimized}
                onClose={() => setDockedConversationId(null)}
                onMinimizeToggle={() => setDockedMinimized((value) => !value)}
                onNavigate={onNavigate}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <footer aria-label="Platform trust links" className="trust-footer">
        <div className="trust-footer-inner">
          <div className="trust-footer-copy">
            <strong>Vibehall</strong>
            <span>Shared rooms, clear rules, calm support.</span>
          </div>
          <nav aria-label="Trust and support navigation" className="trust-footer-links">
            <button onClick={() => onNavigate("/terms")} type="button">Terms</button>
            <button onClick={() => onNavigate("/privacy")} type="button">Privacy</button>
            <button onClick={() => onNavigate("/community-guidelines")} type="button">Guidelines</button>
            <button onClick={() => onNavigate("/support")} type="button">Support</button>
          </nav>
        </div>
      </footer>
    </div>
  );
}
