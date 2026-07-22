import { expect, test, type Page, type Route } from "@playwright/test";

const me = { accountState: "active", avatarUrl: null, displayName: "Ada Lovelace", email: "ada@example.test", id: "me", role: "member", username: "ada" };
const profile = (id: string, displayName: string, username: string) => ({ avatar: { initials: displayName.split(" ").map((part) => part[0]).join(""), kind: "initials" }, bio: null, displayName, id, memberSince: "2026-07", username, viewer: "authenticated" });
const grace = profile("grace", "Grace Hopper", "grace");
const alan = profile("alan", "Alan Turing", "alan");
const bob = profile("bob", "Bob Stone", "bob");
const envelope = (data: unknown) => JSON.stringify({ data, ok: true });
const failure = (code: string, message: string) => JSON.stringify({ error: { code, message }, ok: false });

async function mockRailApi(page: Page) {
  let summary = { actionableCount: 1, unreadCount: 2 };
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const method = request.method();
    const json = (status: number, body: string) => route.fulfill({ body, contentType: "application/json", status });
    if (path === "/auth/csrf") return json(200, envelope({ token: "csrf-token" }));
    if (path === "/auth/me") return json(200, envelope({ user: me }));
    if (path === "/social/notifications/summary" && method === "GET") return json(200, envelope(summary));
    if (path === "/social/notifications/read-all" && method === "POST") { summary = { actionableCount: 0, unreadCount: 0 }; return json(200, envelope(summary)); }
    if (path === "/social/friends" && method === "GET") return json(200, envelope({ items: [bob, grace], nextCursor: null }));
    if (path === "/social/room-invites" && method === "GET") return json(200, envelope({ items: [], nextCursor: null }));
    if (path === "/social/friend-requests" && method === "GET") return json(200, envelope({ items: [
      { createdAt: "2026-07-07T10:00:00.000Z", direction: "incoming", expiresAt: "2026-08-06T10:00:00.000Z", profile: alan },
      { createdAt: "2026-07-07T11:00:00.000Z", direction: "outgoing", expiresAt: "2026-08-06T11:00:00.000Z", profile: profile("mira", "Mira Patel", "mira") }
    ], nextCursor: null }));
    if (path === "/social/presence/friends" && method === "GET") return json(200, envelope({ degraded: false, items: [
      { lastSeen: null, status: "online", userId: "grace" },
      { lastSeen: "today", status: "offline", userId: "bob" }
    ] }));
    if (path === "/social/relationships/grace") return json(200, envelope({ relationship: { actions: ["unfriend", "block", "report"], state: "friends" } }));
    if (path === "/social/relationships/bob") return json(200, envelope({ relationship: { actions: ["unfriend", "block", "report"], state: "friends" } }));
    if (path === "/social/relationships/alan") return json(200, envelope({ relationship: { actions: ["accept", "decline", "block", "report"], state: "incoming_pending" } }));
    if (path === "/social/relationships/mira") return json(200, envelope({ relationship: { actions: ["cancel", "block", "report"], state: "outgoing_pending" } }));
    if (path === "/social/friend-requests/alan/accept" && method === "POST") return json(200, envelope({ state: "friends" }));
    return json(404, failure("NOT_FOUND", "Not found."));
  });
}

test("Social Rail opens from topbar, sorts presence and reconciles request attention", async ({ page }) => {
  await mockRailApi(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Social updates, 3 unread or actionable/ })).toBeVisible();
  await page.getByRole("button", { name: /Social updates/ }).click();
  await expect(page.locator("#social-rail .social-rail-panel")).toBeVisible();
  await expect(page.getByText("Grace Hopper")).toBeVisible();
  await expect(page.getByText("Online")).toBeVisible();
  await expect(page.getByText("Bob Stone")).toBeVisible();
  await expect(page.getByText("Last seen today")).toBeVisible();

  await page.getByLabel("Social sections").getByRole("tab", { name: /Requests/ }).click();
  await expect(page.getByText(/Incoming .* expires/)).toBeVisible();
  await expect(page.getByText(/Outgoing .* expires/)).toBeVisible();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByRole("button", { exact: true, name: "Social" })).toBeVisible();
});

test("Social Rail respects route eligibility and local open preference", async ({ page }) => {
  await mockRailApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Social updates/ }).click();
  await expect(page.locator("#social-rail")).toHaveClass(/is-expanded/);
  await page.goto("/discover");
  await expect(page.locator("#social-rail")).toHaveClass(/is-expanded/);
  await page.goto("/auth");
  await expect(page.getByRole("button", { name: /Social updates/ })).toHaveCount(0);
});

test("Room route removes every global shell-owned surface", async ({ page }) => {
  await mockRailApi(page);
  await page.goto("/room");
  await expect(page.locator(".topbar")).toHaveCount(0);
  await expect(page.locator(".page-masthead")).toHaveCount(0);
  await expect(page.locator("#social-rail")).toHaveCount(0);
  await expect(page.locator(".docked-conversation-wrapper")).toHaveCount(0);
  await expect(page.locator(".trust-footer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Social updates/ })).toHaveCount(0);
});
