import { expect, test, type Page, type Route } from '@playwright/test';

const member = {
  accountState: 'active',
  avatarUrl: null,
  displayName: 'Ada Lovelace',
  email: 'ada@example.test',
  id: 'member-1',
  role: 'member',
  username: 'ada'
};
const admin = { ...member, id: 'admin-1', role: 'admin', username: 'admin' };
const envelope = (data: unknown) => JSON.stringify({ data, ok: true });
const failure = (code: string, message: string) => JSON.stringify({ error: { code, message }, ok: false });

async function mockShellApi(page: Page, user: typeof member | null) {
  await page.route('**/api/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const json = (status: number, body: string) => route.fulfill({ body, contentType: 'application/json', status });
    if (path === '/auth/me') {
      return user
        ? json(200, envelope({ user }))
        : json(401, failure('AUTHENTICATION_REQUIRED', 'Authentication required.'));
    }
    if (path === '/social/notifications/summary') {
      return json(200, envelope({ actionableCount: 1, unreadCount: 2 }));
    }
    if (path === '/social/friends' || path === '/social/friend-requests' || path === '/social/room-invites') {
      return json(200, envelope({ items: [], nextCursor: null }));
    }
    if (path === '/social/presence/friends') {
      return json(200, envelope({ degraded: false, items: [] }));
    }
    if (path === '/social/dm/conversations') {
      return json(404, failure('FEATURE_DISABLED', 'Messages disabled.'));
    }
    return json(404, failure('NOT_FOUND', 'Not found.'));
  });
}

test('mobile guest menu is compact, trapped and route-closing', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await mockShellApi(page, null);
  await page.goto('/');

  await expect(page.locator('.desktop-shell-header')).toBeHidden();
  await expect(page.locator('.mobile-header')).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Open navigation menu' });
  await expect(trigger).toHaveCSS('min-height', '44px');
  await trigger.click();

  const menu = page.getByRole('dialog', { name: 'Vibehall' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Discover' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Create room' })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: 'Friends' })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Sign up' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');

  await trigger.click();
  await page.getByRole('dialog', { name: 'Vibehall' }).getByRole('button', { name: 'Discover' }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole('dialog', { name: 'Vibehall' })).toHaveCount(0);
});

test('mobile member menu exposes real account and social routes without admin leakage', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await mockShellApi(page, member);
  await page.goto('/');

  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Vibehall' });
  await expect(menu.getByText('Ada Lovelace')).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Create room' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Friends' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Messages' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Invites' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'People You Watched With' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Blocked' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Admin' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Open Social/ })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await menu.getByRole('button', { name: 'Messages' }).click();
  await expect(page).toHaveURL(/\/messages$/);
  await expect(menu).toHaveCount(0);
});

test('tablet admin uses the shared Social Drawer with escape, outside-close and focus restore', async ({ page }) => {
  await page.setViewportSize({ height: 1112, width: 834 });
  await mockShellApi(page, admin);
  await page.goto('/discover');

  const menuTrigger = page.getByRole('button', { name: 'Open navigation menu' });
  await menuTrigger.click();
  const menu = page.getByRole('dialog', { name: 'Vibehall' });
  await expect(menu.getByRole('button', { name: 'Admin' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menuTrigger).toBeFocused();

  const socialTrigger = page.getByRole('button', { name: /Open Social, 3 unread or actionable/ });
  await expect(socialTrigger).toBeVisible();
  const socialBox = await socialTrigger.boundingBox();
  expect(socialBox?.width).toBeGreaterThanOrEqual(44);
  expect(socialBox?.height).toBeGreaterThanOrEqual(44);
  await socialTrigger.click();

  const drawer = page.getByRole('dialog', { name: 'Friends now' });
  await expect(drawer).toBeVisible();
  await expect(page.locator('#tablet-social-rail')).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'People You Watched With' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Blocked' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(socialTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(socialTrigger).toBeFocused();

  await socialTrigger.click();
  await page.locator('.ui-overlay-backdrop--drawer').click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole('dialog', { name: 'Friends now' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Room stays free of every desktop, tablet and mobile global shell surface', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await mockShellApi(page, member);
  await page.goto('/room');
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.locator('.mobile-header')).toHaveCount(0);
  await expect(page.locator('.page-masthead')).toHaveCount(0);
  await expect(page.locator('#social-rail')).toHaveCount(0);
  await expect(page.locator('#tablet-social-rail')).toHaveCount(0);
  await expect(page.locator('.docked-conversation-wrapper')).toHaveCount(0);
  await expect(page.locator('.trust-footer')).toHaveCount(0);
});
