import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routes } from '../src/lib/routes';

const projectRoot = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(projectRoot, path), 'utf8');

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

describe('Wave 05 responsive shell source contract', () => {
  it('derives mobile primary destinations from the Wave 04 route source', () => {
    const shell = source('src/components/AppShell.tsx');
    expect(shell).toContain('const primaryMobileItems = primaryRoutes');
    expect(routes.filter((route) => route.showInPrimaryNav).map((route) => route.path)).toEqual([
      '/',
      '/discover',
      '/create-room'
    ]);
    expect(shell).not.toContain('setActiveRoute');
  });

  it('uses one desktop-to-tablet squeeze point and one mobile boundary', () => {
    const shell = source('src/components/AppShell.tsx');
    const css = source('src/styles/shell.css');
    expect(shell).toContain(`window.matchMedia('(min-width: 1041px)')`);
    expect(shell).toContain(`window.matchMedia('(max-width: 639px)')`);
    expect(css).toContain('@media (max-width: 1040px)');
    expect(css).toContain('@media (max-width: 639px)');
  });

  it('keeps desktop and responsive shell controls mutually hidden', () => {
    const css = source('src/styles/shell.css');
    expect(css).toMatch(/\.mobile-header\s*\{\s*display: none;/);
    expect(css).toMatch(/@media \(max-width: 1040px\)[\s\S]*?\.desktop-shell-header,[\s\S]*?display: none;/);
    expect(css).toMatch(/@media \(max-width: 1040px\)[\s\S]*?\.mobile-header[\s\S]*?display: grid;/);
  });

  it('renders a minimal named header without bottom navigation or invented search', () => {
    const shell = source('src/components/AppShell.tsx');
    expect(shell).toContain(`label='Open navigation menu'`);
    expect(shell).toContain(`className='mobile-header-context'`);
    expect(shell).toContain(`label={socialBadge ? 'Open Social,`);
    expect(shell).not.toContain('mobile-bottom');
    expect(shell).not.toContain('SearchIcon');
    expect(shell).not.toContain('/notifications');
  });

  it('bounds guest, member and admin menu visibility to real session state', () => {
    const shell = source('src/components/AppShell.tsx');
    expect(shell).toContain(`route.path !== '/create-room'`);
    expect(shell).toContain('const socialMobileItems = currentUser ?');
    expect(shell).toContain(`navigateAuth('login')`);
    expect(shell).toContain(`navigateAuth('signup')`);
    expect(shell).toContain(`currentUser.role === 'admin'`);
    expect(shell).toContain(`navigateFromMobileMenu('/admin')`);
  });

  it('uses only existing social and account route families', () => {
    const shell = source('src/components/AppShell.tsx');
    for (const path of ['/friends', '/messages', '/profile', '/settings', '/support']) {
      expect(routes.some((route) => route.path === path)).toBe(true);
    }
    expect(shell).toContain(`path: '/friends?view=invites'`);
    expect(shell).toContain(`path: '/friends?view=watched'`);
    expect(shell).toContain(`path: '/friends?view=blocked'`);
    expect(shell).not.toContain('/members');
    expect(shell).not.toContain('/feed');
  });

  it('closes the menu before dispatching custom-router navigation once', () => {
    const shell = source('src/components/AppShell.tsx');
    const navigation = shell.match(/function navigateFromMobileMenu[\s\S]*?\n  }/)?.[0] ?? '';
    expect(navigation).toContain('setMobileMenuOpen(false)');
    expect(navigation.match(/onNavigate\(path\)/g)).toHaveLength(1);
  });

  it('uses the shared Drawer primitive for menu and tablet Social content', () => {
    const shell = source('src/components/AppShell.tsx');
    const rail = source('src/social/SocialRail.tsx');
    expect(shell).toMatch(/import \{[^}]*Drawer[^}]*\} from .\.\/ui./s);
    expect(shell.match(/<Drawer/g)).toHaveLength(2);
    expect(shell).toContain(`mode='drawer'`);
    expect(shell).toContain(`id='tablet-social-rail'`);
    expect(shell).toContain(`titleId='tablet-social-drawer-title'`);
    expect(rail).toContain(`aria-label='Social destinations'`);
    expect(rail).toContain(`navigate('/friends?view=watched')`);
    expect(rail).toContain(`navigate('/friends?view=blocked')`);
    expect(rail).toContain(`navigate('/settings')`);
  });

  it('inherits escape, focus trap, scroll lock and focus restore from Wave 02', () => {
    const overlay = source('src/components/ui/Overlay.tsx');
    const focus = source('src/components/ui/overlayFocus.ts');
    expect(overlay).toContain('useOverlayFocus');
    expect(overlay).toMatch(/event\.key === .Escape./);
    expect(overlay).toMatch(/event\.key !== .Tab./);
    expect(focus).toContain('acquireBodyScrollLock');
    expect(focus).toMatch(/body\.style\.overflow = .hidden./);
    expect(overlay).toContain('restoreFocus(previousFocus)');
  });

  it('keeps touch targets, safe areas, long labels and drawer scrolling bounded', () => {
    const css = source('src/styles/shell.css');
    const primitives = source('src/styles/primitives.css');
    expect(css).toContain('min-height: var(--control-hit-area)');
    expect(css).toContain('env(safe-area-inset-top)');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(primitives).toContain('overflow: auto');
    expect(primitives).toContain('overscroll-behavior: contain');
  });

  it('keeps Room ahead of every global responsive shell surface', () => {
    const shell = source('src/components/AppShell.tsx');
    const roomBranch = shell.match(/if \(activeRoute\.shell[^}]+room[^}]+\) \{([\s\S]*?)const Header/)?.[1] ?? '';
    expect(roomBranch).toContain('room-surface');
    expect(roomBranch).not.toContain('<MobileHeader');
    expect(roomBranch).not.toContain('<Drawer');
    expect(roomBranch).not.toContain('trust-footer');
  });

  it('keeps normal and active mobile navigation above WCAG AA contrast', () => {
    expect(contrast('#a8afbf', '#090a0f')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ff625a', '#090a0f')).toBeGreaterThanOrEqual(4.5);
  });
});
