import {
  CaretDownIcon,
  ChatCircleDotsIcon,
  ClockCounterClockwiseIcon,
  CompassIcon,
  EnvelopeIcon,
  GearIcon,
  HouseIcon,
  LifebuoyIcon,
  ListIcon,
  PlusCircleIcon,
  ProhibitIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UserCircleIcon,
  UsersThreeIcon,
  XIcon
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import type { RouteDefinition } from "../lib/routes";
import { ConversationPanel } from "../social/ConversationPanel";
import { getNotificationSummary, type NotificationSummary } from "../social/socialApi";
import { SocialRail } from "../social/SocialRail";
import { Avatar, Button, Drawer, IconButton, PopoverMenu } from "./ui";

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

type MobileHeaderProps = {
  activeRoute: RouteDefinition;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onNavigateHome: () => void;
  onSocialOpen: () => void;
  socialBadge: number;
  socialEligible: boolean;
  socialOpen: boolean;
};

type MobileMenuItemProps = {
  active: boolean;
  icon: ReactElement;
  label: string;
  onSelect: () => void;
};

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

function MobileHeader({
  activeRoute,
  menuOpen,
  onMenuToggle,
  onNavigateHome,
  onSocialOpen,
  socialBadge,
  socialEligible,
  socialOpen
}: MobileHeaderProps) {
  return (
    <header className='mobile-header' data-shell-variant={activeRoute.shell}>
      <IconButton
        aria-controls='mobile-navigation-drawer'
        aria-expanded={menuOpen}
        className='mobile-header-action'
        icon={<ListIcon size={22} />}
        label='Open navigation menu'
        onClick={onMenuToggle}
        variant='text'
      />
      <button
        aria-label='Go to Vibehall home'
        className='mobile-header-context'
        onClick={onNavigateHome}
        type='button'
      >
        <span className='mobile-header-brand'>Vibehall</span>
        <span className='mobile-header-page'>{activeRoute.label}</span>
      </button>
      {socialEligible ? (
        <span className='mobile-social-trigger'>
          <IconButton
            aria-controls='tablet-social-drawer'
            aria-expanded={socialOpen}
            className='mobile-header-action'
            icon={<UsersThreeIcon size={21} />}
            label={socialBadge ? 'Open Social, ' + socialBadge + ' unread or actionable' : 'Open Social'}
            onClick={onSocialOpen}
            variant='text'
          />
          {socialBadge ? (
            <span aria-hidden='true' className='social-badge mobile-social-badge'>
              {displayCount(socialBadge)}
            </span>
          ) : null}
        </span>
      ) : (
        <span aria-hidden='true' className='mobile-header-spacer' />
      )}
    </header>
  );
}

function MobileMenuItem({ active, icon, label, onSelect }: MobileMenuItemProps) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={active ? 'mobile-menu-item is-active' : 'mobile-menu-item'}
      onClick={onSelect}
      type='button'
    >
      <span aria-hidden='true' className='mobile-menu-icon'>{icon}</span>
      <span>{label}</span>
    </button>
  );
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [socialDrawerOpen, setSocialDrawerOpen] = useState(false);
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
    setMobileMenuOpen(false);
    setSocialDrawerOpen(false);
    if (!socialEligible) {
      setDockedConversationId(null);
      setDockedMinimized(false);
    }
  }, [activeRoute.path, socialEligible]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1041px)');
    const mobile = window.matchMedia('(max-width: 639px)');
    const syncResponsiveOverlays = () => {
      if (desktop.matches) {
        setMobileMenuOpen(false);
        setSocialDrawerOpen(false);
      } else {
        setProfileMenuOpen(false);
        if (mobile.matches) setSocialDrawerOpen(false);
      }
    };
    syncResponsiveOverlays();
    desktop.addEventListener('change', syncResponsiveOverlays);
    mobile.addEventListener('change', syncResponsiveOverlays);
    return () => {
      desktop.removeEventListener('change', syncResponsiveOverlays);
      mobile.removeEventListener('change', syncResponsiveOverlays);
    };
  }, []);

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

  function navigateFromMobileMenu(path: string) {
    setMobileMenuOpen(false);
    onNavigate(path);
  }

  function mobilePathIsActive(path: string) {
    const target = new URL(path, window.location.origin);
    if (target.pathname !== window.location.pathname) return false;
    const targetView = target.searchParams.get('view');
    const currentView = new URLSearchParams(window.location.search).get('view');
    return targetView ? targetView === currentView : currentView === null;
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

  const primaryMobileItems = primaryRoutes
    .filter((route) => currentUser || route.path !== '/create-room')
    .map((route) => ({
      icon: route.path === '/'
        ? <HouseIcon size={20} />
        : route.path === '/discover'
          ? <CompassIcon size={20} />
          : <PlusCircleIcon size={20} />,
      label: route.label,
      path: route.path
    }));
  const socialMobileItems = currentUser ? [
    { icon: <UsersThreeIcon size={20} />, label: 'Friends', path: '/friends' },
    { icon: <ChatCircleDotsIcon size={20} />, label: 'Messages', path: '/messages' },
    { icon: <EnvelopeIcon size={20} />, label: 'Invites', path: '/friends?view=invites' },
    { icon: <ClockCounterClockwiseIcon size={20} />, label: 'People You Watched With', path: '/friends?view=watched' },
    { icon: <ProhibitIcon size={20} />, label: 'Blocked', path: '/friends?view=blocked' },
    { icon: <GearIcon size={20} />, label: 'Settings', path: '/settings' }
  ] : [];

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
      <div className='desktop-shell-header'>
        <Header
          accountArea={accountArea}
          activeRoute={activeRoute}
          onNavigate={onNavigate}
          primaryRoutes={primaryRoutes}
        />
      </div>
      <MobileHeader
        activeRoute={activeRoute}
        menuOpen={mobileMenuOpen}
        onMenuToggle={() => {
          setSocialDrawerOpen(false);
          setMobileMenuOpen((value) => !value);
        }}
        onNavigateHome={() => onNavigate('/')}
        onSocialOpen={() => {
          setMobileMenuOpen(false);
          setSocialDrawerOpen(true);
        }}
        socialBadge={socialBadge}
        socialEligible={socialEligible}
        socialOpen={socialDrawerOpen}
      />

      {mobileMenuOpen ? (
        <Drawer
          className='mobile-navigation-drawer'
          id='mobile-navigation-drawer'
          onClose={() => setMobileMenuOpen(false)}
          titleId='mobile-navigation-title'
        >
          <div className='mobile-menu-header'>
            <div>
              <p className='eyebrow'>Navigation</p>
              <h2 id='mobile-navigation-title'>Vibehall</h2>
            </div>
            <IconButton
              icon={<XIcon size={20} />}
              label='Close navigation menu'
              onClick={() => setMobileMenuOpen(false)}
              variant='text'
            />
          </div>

          {isCheckingSession ? (
            <span aria-label='Checking account' className='mobile-menu-identity is-loading' role='status'>
              <span aria-hidden='true' className='account-placeholder-avatar' />
              <span aria-hidden='true' className='account-placeholder-copy' />
            </span>
          ) : currentUser ? (
            <div className='mobile-menu-identity'>
              <Avatar displayName={currentUser.displayName} size='default' src={currentUser.avatarUrl} />
              <span className='account-copy'>
                <strong className='account-name'>{currentUser.displayName}</strong>
                <span className='account-meta'>@{currentUser.username}</span>
              </span>
            </div>
          ) : null}

          <nav aria-label='Mobile navigation' className='mobile-menu-navigation'>
            <div className='mobile-menu-group'>
              <p className='mobile-menu-group-label'>Main</p>
              {primaryMobileItems.map((item) => (
                <MobileMenuItem
                  active={mobilePathIsActive(item.path)}
                  icon={item.icon}
                  key={item.path}
                  label={item.label}
                  onSelect={() => navigateFromMobileMenu(item.path)}
                />
              ))}
            </div>

            {socialMobileItems.length ? (
              <div className='mobile-menu-group'>
                <p className='mobile-menu-group-label'>Social</p>
                {socialMobileItems.map((item) => (
                  <MobileMenuItem
                    active={mobilePathIsActive(item.path)}
                    icon={item.icon}
                    key={item.path}
                    label={item.label}
                    onSelect={() => navigateFromMobileMenu(item.path)}
                  />
                ))}
              </div>
            ) : null}

            <div className='mobile-menu-group'>
              <p className='mobile-menu-group-label'>Account</p>
              {currentUser ? (
                <>
                  <MobileMenuItem
                    active={mobilePathIsActive('/profile')}
                    icon={<UserCircleIcon size={20} />}
                    label='Profile'
                    onSelect={() => navigateFromMobileMenu('/profile')}
                  />
                  <MobileMenuItem
                    active={mobilePathIsActive('/support')}
                    icon={<LifebuoyIcon size={20} />}
                    label='Help & Support'
                    onSelect={() => navigateFromMobileMenu('/support')}
                  />
                  {currentUser.role === 'admin' ? (
                    <MobileMenuItem
                      active={mobilePathIsActive('/admin')}
                      icon={<ShieldCheckIcon size={20} />}
                      label='Admin'
                      onSelect={() => navigateFromMobileMenu('/admin')}
                    />
                  ) : null}
                  <button
                    className='mobile-menu-item is-danger'
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void logout();
                    }}
                    type='button'
                  >
                    <SignOutIcon aria-hidden='true' size={20} />
                    <span>Log out</span>
                  </button>
                </>
              ) : !isCheckingSession ? (
                <div className='mobile-menu-auth-actions'>
                  <Button fullWidth onClick={() => navigateAuth('login')} variant='secondary'>Log in</Button>
                  <Button fullWidth onClick={() => navigateAuth('signup')} variant='primary'>Sign up</Button>
                </div>
              ) : null}
            </div>
          </nav>
        </Drawer>
      ) : null}

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
        {activeRoute.shell !== "home" ? (
          <section aria-labelledby="page-title" className="page-masthead">
            <p className="eyebrow">{activeRoute.label}</p>
            <h1 id="page-title">{activeRoute.title}</h1>
          </section>
        ) : null}

        <Page onNavigate={onNavigate} />
      </main>

      {socialEligible ? (
        <>
          <div className='desktop-social-rail'>
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
          </div>
          {socialDrawerOpen ? (
            <Drawer
              className='tablet-social-drawer'
              id='tablet-social-drawer'
              onClose={() => setSocialDrawerOpen(false)}
              titleId='tablet-social-drawer-title'
            >
              <SocialRail
                id='tablet-social-rail'
                mode='drawer'
                onBadgeChange={setSocialSummary}
                onClose={() => setSocialDrawerOpen(false)}
                onNavigate={onNavigate}
                onOpenConversation={(id) => {
                  setSocialDrawerOpen(false);
                  setDockedConversationId(id);
                  setDockedMinimized(false);
                }}
                onToggle={() => undefined}
                open
                summary={socialSummary}
                titleId='tablet-social-drawer-title'
              />
            </Drawer>
          ) : null}
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
