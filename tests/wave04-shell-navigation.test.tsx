import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { notFoundRoute, routes } from "../src/lib/routes";

const projectRoot = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return channels
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("Wave 04 route-aware shell contract", () => {
  it("maps every real route to an explicit shell family", () => {
    expect(Object.fromEntries(routes.map((route) => [route.path, route.shell]))).toEqual({
      "/": "home",
      "/admin": "admin",
      "/auth": "utility",
      "/auth/reset": "utility",
      "/community-guidelines": "utility",
      "/create-room": "app",
      "/discover": "app",
      "/friends": "app",
      "/messages": "app",
      "/privacy": "utility",
      "/profile": "app",
      "/room": "room",
      "/settings": "app",
      "/support": "utility",
      "/terms": "utility",
      "/users/:username": "app"
    });
    expect(notFoundRoute.shell).toBe("utility");
  });

  it("keeps only real Home, Discover and Create room primary paths", () => {
    expect(routes.filter((route) => route.showInPrimaryNav).map((route) => route.path)).toEqual([
      "/",
      "/discover",
      "/create-room"
    ]);
    expect(routes.map((route) => route.path)).not.toContain("/notifications");
    expect(routes.map((route) => route.path)).not.toContain("/search");
    expect(routes.map((route) => route.path)).not.toContain("/feed");
  });

  it("preserves custom-router navigation and route-owned active state", () => {
    const app = source("src/App.tsx");
    const shell = source("src/components/AppShell.tsx");
    expect(app.match(/vibehall:before-navigate/g)).toHaveLength(2);
    expect(app).toContain("window.history.pushState");
    expect(app).toContain("popstate");
    expect(app).toContain("<AppShell activeRoute={activeRoute}");
    expect(shell).toContain("const active = route.path === activeRoute.path");
    expect(shell).toContain("aria-current={active");
    expect(shell).not.toContain("setActiveRoute");
  });
});

describe("Wave 04 role, menu and Room exclusion contract", () => {
  it("uses separate Home and app headers with canonical starting heights", () => {
    const shell = source("src/components/AppShell.tsx");
    const css = source("src/styles/shell.css");
    expect(shell).toContain("function HomeHeader");
    expect(shell).toContain("function AppHeader");
    expect(shell).toContain("activeRoute.shell ===");
    expect(css).toContain("--shell-header-height: 4rem");
    expect(css).toContain("--shell-header-height: 4.5rem");
  });

  it("keeps bootstrap neutral and role affordances bounded", () => {
    const shell = source("src/components/AppShell.tsx");
    expect(shell).toContain("Checking account");
    expect(shell).toContain("account-placeholder-avatar");
    expect(shell).toContain('navigateAuth("login")');
    expect(shell).toContain('navigateAuth("signup")');
    expect(shell).toContain("<Avatar");
    expect(shell).toContain("currentUser.role");
    expect(shell).not.toContain("fake");
  });

  it("uses the shared PopoverMenu for account actions and admin-only access", () => {
    const shell = source("src/components/AppShell.tsx");
    expect(shell).toContain("<PopoverMenu");
    expect(shell).toContain("Account menu");
    expect(shell).toContain('navigateFromProfile("/profile")');
    expect(shell).toContain('navigateFromProfile("/settings")');
    expect(shell).toContain('navigateFromProfile("/admin")');
    expect(shell).toContain("void logout()");
  });

  it("returns Room before every global shell-owned surface", () => {
    const shell = source("src/components/AppShell.tsx");
    const roomBranch = shell.match(/if \(activeRoute\.shell[^}]+room[^}]+\) \{([\s\S]*?)const Header/)?.[1] ?? "";
    expect(roomBranch).toContain("room-surface");
    expect(roomBranch).toContain("<Page onNavigate={onNavigate}");
    expect(roomBranch).not.toContain("<Header");
    expect(roomBranch).not.toContain("page-masthead");
    expect(roomBranch).not.toContain("<SocialRail");
    expect(roomBranch).not.toContain("<ConversationPanel");
    expect(roomBranch).not.toContain("trust-footer");
    expect(roomBranch).not.toContain("<PopoverMenu");
  });
});

describe("Wave 04 Desktop Social Rail and visual safety contract", () => {
  it("uses real notification summary without hard-coded counts", () => {
    const shell = source("src/components/AppShell.tsx");
    const rail = source("src/social/SocialRail.tsx");
    expect(shell).toContain("getNotificationSummary()");
    expect(shell).toContain("socialSummary.unreadCount + socialSummary.actionableCount");
    expect(rail).toContain("summary: NotificationSummary");
    expect(rail).toContain("summary.unreadCount + summary.actionableCount");
  });

  it("provides named collapsed shortcuts and an expanded panel for real routes", () => {
    const rail = source("src/social/SocialRail.tsx");
    expect(rail).toContain("is-expanded");
    expect(rail).toContain("is-collapsed");
    expect(rail).toContain("Collapse Social Rail");
    expect(rail).toContain('label="Friends"');
    expect(rail).toContain('label="Messages"');
    expect(rail).toContain('label="Room invites"');
    expect(rail).toContain('label="Friend requests"');
    expect(rail).toContain('label="Settings"');
    expect(rail).not.toContain("/members");
  });

  it("keeps preference local and isolates social failure from primary navigation", () => {
    const shell = source("src/components/AppShell.tsx");
    const rail = source("src/social/SocialRail.tsx");
    expect(shell).toContain("vibehall:social-rail-open");
    expect(shell).toContain("localStorage");
    expect(shell).toContain(".catch(() => undefined)");
    expect(rail.indexOf("social-rail-compact")).toBeLessThan(rail.indexOf("{open ? ("));
    expect(rail).toContain("<InlineError");
  });

  it("keeps permanent surfaces matte with canonical sizes and reduced motion", () => {
    const shellCss = source("src/styles/shell.css");
    const pagesCss = source("src/styles/pages.css");
    expect(shellCss).not.toContain("backdrop-filter");
    expect(shellCss).toContain("--social-rail-closed-width: 4rem");
    expect(shellCss).toContain("--social-rail-open-width: 15rem");
    expect(pagesCss).toContain("background: var(--color-surface-standard)");
    expect(pagesCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(pagesCss).toContain("transition-duration: var(--motion-reduced)");
  });

  it("keeps normal and active navigation above WCAG AA contrast", () => {
    expect(contrast("#a8afbf", "#090a0f")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ff625a", "#090a0f")).toBeGreaterThanOrEqual(4.5);
  });
});
