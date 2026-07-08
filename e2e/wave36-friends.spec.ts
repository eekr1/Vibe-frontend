import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const me = { accountState: "active", avatarUrl: null, displayName: "Ada Lovelace", email: "ada@example.test", id: "me", role: "member", username: "ada" };
const profile = (id: string, displayName: string, username: string) => ({ avatar: { initials: displayName.split(" ").map((part) => part[0]).join(""), kind: "initials" }, bio: null, displayName, id, memberSince: "2026-07", username, viewer: "authenticated" });
const grace = profile("grace", "Grace Hopper", "grace");
const alan = profile("alan", "Alan Turing", "alan");
const lin = profile("lin", "Lin Chen", "lin");
const bob = profile("bob", "Bob Stone", "bob");
const envelope = (data: unknown) => JSON.stringify({ data, ok: true });
const failure = (code: string, message: string) => JSON.stringify({ error: { code, message }, ok: false });

async function mockSocial(page: Page) {
  let friends = [grace];
  let requests = [
    { createdAt: "2026-07-06T10:00:00.000Z", direction: "incoming", expiresAt: "2026-08-05T10:00:00.000Z", profile: alan },
    { createdAt: "2026-07-06T11:00:00.000Z", direction: "outgoing", expiresAt: "2026-08-05T11:00:00.000Z", profile: bob }
  ];
  let blocked = [{ blockedAt: "2026-07-05T10:00:00.000Z", profile: lin }];
  let watched = [{ encounteredAt: "2026-07-06T09:00:00.000Z", label: "Watched together recently", profile: profile("mira", "Mira Patel", "mira") }];
  const requestedPaths: string[] = [];

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request(); const path = new URL(request.url()).pathname.replace(/^\/api/, ""); const method = request.method(); requestedPaths.push(`${method} ${path}`);
    const json = (status: number, body: string) => route.fulfill({ body, contentType: "application/json", status });
    if (path === "/auth/csrf") return json(200, envelope({ token: "csrf-token" }));
    if (path === "/auth/me") return json(200, envelope({ user: me }));
    if (path === "/social/friends" && method === "GET") return json(200, envelope({ items: friends, nextCursor: null }));
    if (path === "/social/friend-requests" && method === "GET") return json(200, envelope({ items: requests, nextCursor: null }));
    if (path === "/social/blocks" && method === "GET") return json(200, envelope({ items: blocked, nextCursor: null }));
    if (path === "/social/people-watched" && method === "GET") return json(200, envelope({ items: watched, nextCursor: null }));
    if (path === "/social/room-invites" && method === "GET") return json(200, envelope({ items: [], nextCursor: null }));
    if (path === "/social/friend-requests/alan/accept" && method === "POST") { requests = requests.filter((item) => item.profile.id !== "alan"); friends = [...friends, alan]; return json(200, envelope({ state: "friends" })); }
    if (path === "/social/friend-requests/bob/cancel" && method === "POST") { requests = requests.filter((item) => item.profile.id !== "bob"); return json(200, envelope({ state: "none" })); }
    if (path === "/social/friend-requests" && method === "POST") {
      const target = (request.postDataJSON() as { targetUserId: string }).targetUserId;
      if (target === "restricted") return json(429, failure("FRIEND_REQUEST_COOLDOWN", "Please wait before sending another request."));
      if (target === "mira") { friends = [...friends, watched[0].profile]; watched = []; return json(200, envelope({ state: "friends" })); }
      return json(200, envelope({ state: "outgoing_pending" }));
    }
    if (path === "/social/friends/grace" && method === "DELETE") { friends = friends.filter((item) => item.id !== "grace"); return json(200, envelope({ state: "none" })); }
    if (path === "/social/blocks" && method === "POST") { const target = (request.postDataJSON() as { targetUserId: string }).targetUserId; const found = friends.find((item) => item.id === target) ?? watched.find((item) => item.profile.id === target)?.profile; if (found) blocked = [...blocked, { blockedAt: new Date().toISOString(), profile: found }]; friends = friends.filter((item) => item.id !== target); watched = watched.filter((item) => item.profile.id !== target); return json(200, envelope({ roomIds: [], state: "blocked" })); }
    if (path === "/social/blocks/lin" && method === "DELETE") { blocked = blocked.filter((item) => item.profile.id !== "lin"); return json(200, envelope({ state: "none" })); }
    if (path === "/social/people-watched/mira/dismiss" && method === "POST") { watched = []; return json(200, envelope({ dismissed: true })); }
    const relationship = path.match(/^\/social\/relationships\/([^/]+)$/)?.[1];
    if (relationship) {
      if (friends.some((item) => item.id === relationship)) return json(200, envelope({ relationship: { actions: ["unfriend", "block", "report"], state: "friends" } }));
      if (blocked.some((item) => item.profile.id === relationship)) return json(200, envelope({ relationship: { actions: ["unblock", "report"], state: "blocked" } }));
      return json(200, envelope({ relationship: { actions: ["send", "block", "report"], state: "none" } }));
    }
    if (path === "/users/me/profile") return json(200, envelope({ capabilities: { socialEnabled: true }, profile: { ...grace, id: me.id, username: me.username, displayName: me.displayName, viewer: "self" }, settings: { friendRequestPrivacy: "everyone", invitePrivacy: "friends", lastSeenPrivacy: "friends", onlinePrivacy: "friends", updatedAt: "2026-07-06T00:00:00.000Z" }, user: me }));
    if (path === "/users/restricted/profile") return json(200, envelope({ profile: profile("restricted", "Restricted Example", "restricted"), relationship: { actions: ["send", "block", "report"], state: "none" } }));
    if (/^\/users\/[^/]+\/profile$/.test(path)) return json(200, envelope({ profile: grace, relationship: { actions: ["unfriend", "block", "report"], state: "friends" } }));
    return json(404, failure("NOT_FOUND", "Not found."));
  });
  return { requestedPaths };
}

test("friends page closes request, local-filter, unfriend, unblock and watched-dismiss lifecycles", async ({ page }) => {
  const state = await mockSocial(page);
  await page.goto("/friends");
  await expect(page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
  await page.getByLabel("Filter your friends").fill("Grace");
  await expect(page.getByText("Grace Hopper")).toBeVisible();
  await page.getByLabel("Filter your friends").fill("Nobody");
  await expect(page.getByText("No existing friends match this filter.")).toBeVisible();
  expect(state.requestedPaths.some((path) => /search|query|members/.test(path))).toBe(false);

  await page.getByRole("button", { name: "Incoming requests" }).click();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Alan Turing")).toHaveCount(0);
  await page.getByRole("button", { name: "Outgoing requests" }).click();
  await page.getByRole("button", { name: "Cancel request" }).click();
  await expect(page.getByText("Bob Stone")).toHaveCount(0);
  await page.getByLabel("Friends sections").getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByText("Alan Turing")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Relationship actions for Alan Turing").getByRole("button", { name: "Block" }).click();
  await expect(page.getByText("Alan Turing")).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Relationship actions for Grace Hopper").getByRole("button", { name: "Unfriend" }).click();
  await expect(page.getByText("Grace Hopper")).toHaveCount(0);

  await page.getByRole("button", { name: "Blocked accounts" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Relationship actions for Lin Chen").getByRole("button", { name: "Unblock" }).click();
  await expect(page.getByText("Lin Chen")).toHaveCount(0);
  await expect(page.getByText("Alan Turing")).toBeVisible();

  await page.getByRole("button", { name: "People you watched with" }).click();
  await expect(page.getByText("Watched together recently")).toBeVisible();
  await page.getByLabel("Relationship actions for Mira Patel").getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText("Mira Patel")).toHaveCount(0);
  await page.reload();
  await page.getByLabel("Friends sections").getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByText("Mira Patel")).toBeVisible();
});

test("dismissal rollback-safe UI and cooldown states stay neutral", async ({ page }) => {
  await mockSocial(page);
  await page.goto("/friends?view=watched");
  await page.getByRole("button", { name: "Dismiss suggestion" }).click();
  await expect(page.getByText("Mira Patel")).toHaveCount(0);
  await page.goto("/users/restricted");
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText("Please wait before sending another request.")).toBeVisible();
  await expect(page.getByText(/moderation|banned|suspended/i)).toHaveCount(0);
});

test("profile and settings expose relationship and blocked-account management accessibly", async ({ page }) => {
  await mockSocial(page);
  await page.goto("/users/grace");
  await expect(page.getByLabel("Relationship actions for Grace Hopper").getByRole("button", { name: "Unfriend" })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "Blocked Accounts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Blocked accounts" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include("main").analyze();
  expect(accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});
