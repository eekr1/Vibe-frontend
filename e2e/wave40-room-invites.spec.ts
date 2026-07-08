import { expect, test, type Page, type Route } from "@playwright/test";

const me = { accountState: "active", avatarUrl: null, displayName: "Ada Lovelace", email: "ada@example.test", id: "me", role: "member", username: "ada" };
const profile = (id: string, displayName: string, username: string) => ({ avatar: { initials: displayName.split(" ").map((part) => part[0]).join(""), kind: "initials" }, bio: null, displayName, id, memberSince: "2026-07", username, viewer: "authenticated" });
const grace = profile("grace", "Grace Hopper", "grace");
const envelope = (data: unknown) => JSON.stringify({ data, ok: true });
const failure = (code: string, message: string) => JSON.stringify({ error: { code, message }, ok: false });
const host = { avatarUrl: null, displayName: "Ada Lovelace", id: "me", username: "ada" };
const room = (id: string, title: string, visibility: "private" | "public") => ({
  activeParticipantCount: 1,
  card: { capacityLabel: "1/8", isNearlyFull: false, searchText: title, thumbnailAlt: title },
  category: { id: "music", name: "Music", slug: "music" },
  createdAt: "2026-07-08T10:00:00.000Z",
  endedAt: null,
  host,
  id,
  participantLimit: 8,
  slug: id,
  source: { provider: "youtube", thumbnailUrl: null, title: "Test video", url: "https://youtu.be/dQw4w9WgXcQ", videoId: "dQw4w9WgXcQ" },
  state: "live",
  title,
  updatedAt: "2026-07-08T10:00:00.000Z",
  visibility
});

const pendingPrivateInvite = {
  acceptedAt: null,
  actions: { canAccept: true, canDecline: true, canRevoke: false },
  createdAt: "2026-07-08T10:00:00.000Z",
  expiresAt: "2026-08-07T10:00:00.000Z",
  id: "invite-private",
  inviter: { displayName: "Ada Lovelace", id: "ada-host", username: "ada" },
  kind: "private",
  recipient: { displayName: "Ada Lovelace", id: "me", username: "ada" },
  respondedAt: null,
  revokedAt: null,
  room: { activeParticipantCount: 1, hostUserId: "ada-host", id: "private-room", participantLimit: 8, state: "live", title: "Hidden Late Night Room", visibility: "private" },
  state: "pending",
  terminalAt: null,
  terminalReason: null,
  updatedAt: "2026-07-08T10:00:00.000Z"
};

async function mockInviteApi(page: Page) {
  let invites = [pendingPrivateInvite];
  let sentInviteCount = 0;
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const method = request.method();
    const json = (status: number, body: string) => route.fulfill({ body, contentType: "application/json", status });
    if (path === "/auth/csrf") return json(200, envelope({ token: "csrf-token" }));
    if (path === "/auth/me") return json(200, envelope({ user: me }));
    if (path === "/social/notifications/summary" && method === "GET") return json(200, envelope({ actionableCount: invites.filter((invite) => invite.state === "pending").length, unreadCount: 1 }));
    if (path === "/social/notifications/read-all" && method === "POST") return json(200, envelope({ actionableCount: 0, unreadCount: 0 }));
    if (path === "/social/friends" && method === "GET") return json(200, envelope({ items: [grace], nextCursor: null }));
    if (path === "/social/friend-requests" && method === "GET") return json(200, envelope({ items: [], nextCursor: null }));
    if (path === "/social/presence/friends" && method === "GET") return json(200, envelope({ degraded: false, items: [{ lastSeen: null, status: "online", userId: "grace" }] }));
    if (path === "/social/room-invites" && method === "GET") return json(200, envelope({ items: invites, nextCursor: null }));
    if (path === "/social/room-invites" && method === "POST") {
      sentInviteCount += 1;
      const created = { ...pendingPrivateInvite, actions: { canAccept: false, canDecline: false, canRevoke: true }, id: `sent-${sentInviteCount}`, inviter: { displayName: "Ada Lovelace", id: "me", username: "ada" }, kind: "public", recipient: { displayName: "Grace Hopper", id: "grace", username: "grace" }, room: { ...pendingPrivateInvite.room, id: "public-room", title: "Public Room", visibility: "public" } as typeof pendingPrivateInvite.room };
      invites = [created, ...invites];
      return json(201, envelope({ invite: created }));
    }
    if (path === "/social/room-invites/invite-private/accept" && method === "POST") {
      const accepted = { ...pendingPrivateInvite, acceptedAt: "2026-07-08T10:05:00.000Z", actions: { canAccept: false, canDecline: false, canRevoke: false }, respondedAt: "2026-07-08T10:05:00.000Z", state: "accepted", updatedAt: "2026-07-08T10:05:00.000Z" };
      invites = [accepted];
      return json(200, envelope({ invite: accepted }));
    }
    if (path === "/social/room-invites/invite-private/decline" && method === "POST") {
      const declined = { ...pendingPrivateInvite, actions: { canAccept: false, canDecline: false, canRevoke: false }, respondedAt: "2026-07-08T10:06:00.000Z", state: "declined", terminalAt: "2026-07-08T10:06:00.000Z", terminalReason: "declined", updatedAt: "2026-07-08T10:06:00.000Z" };
      invites = [declined];
      return json(200, envelope({ invite: declined }));
    }
    if (path === "/social/relationships/grace" && method === "GET") return json(200, envelope({ relationship: { actions: ["unfriend", "block", "report"], state: "friends" } }));
    if (path === "/rooms/public-room" && method === "GET") return json(200, envelope({ room: room("public-room", "Public Room", "public") }));
    if (path === "/rooms/private-room" && method === "GET") return json(200, envelope({ room: room("private-room", "Hidden Late Night Room", "private") }));
    if (path === "/rooms/public-room/access/check" && method === "POST") return json(200, envelope({ denialReason: null, requiresAuth: false, requiresPassword: false, room: room("public-room", "Public Room", "public"), status: "allowed" }));
    if (path === "/rooms/private-room/access/check" && method === "POST") return json(200, envelope({ denialReason: null, requiresAuth: false, requiresPassword: false, room: room("private-room", "Hidden Late Night Room", "private"), status: "allowed" }));
    if ((path === "/rooms/public-room/join" || path === "/rooms/private-room/join") && method === "POST") return json(200, envelope({ participant: { id: "participant-me", joinedAt: "2026-07-08T10:00:00.000Z", leftAt: null, role: "participant", state: "active", user: host }, room: path.includes("private") ? room("private-room", "Hidden Late Night Room", "private") : room("public-room", "Public Room", "public") }));
    if (path === "/rooms/public-room/messages" || path === "/rooms/private-room/messages") return json(200, envelope({ messages: [], participant: { id: "participant-me", joinedAt: "2026-07-08T10:00:00.000Z", leftAt: null, role: "participant", state: "active", user: host } }));
    return json(404, failure("NOT_FOUND", "Not found."));
  });
}

test("Social Rail exposes room invites and accepts private grant into room flow", async ({ page }) => {
  await mockInviteApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Social updates/ }).click();
  await page.getByLabel("Social sections").getByRole("tab", { name: /Invites/ }).click();
  await expect(page.getByText("Private invite")).toBeVisible();
  await expect(page.getByText("Hidden Late Night Room")).toBeVisible();
  await page.getByRole("button", { name: "Accept private grant" }).click();
  await expect(page).toHaveURL(/\/room\?roomId=private-room/);
  await expect(page.getByText("Private room entry")).toHaveCount(0);
});

test("Room drawer lets an active member invite a confirmed friend without compressing layout", async ({ page }) => {
  await mockInviteApi(page);
  await page.goto("/room?roomId=public-room");
  await page.getByRole("button", { name: /Social updates/ }).click();
  await expect(page.locator("#social-rail")).toHaveClass(/is-drawer/);
  await expect(page.locator("main.main-surface")).not.toHaveClass(/has-social-rail/);
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText("Invite sent to Grace Hopper.")).toBeVisible();
});
test("declined invites disappear from invite surfaces without history", async ({ page }) => {
  await mockInviteApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Social updates/ }).click();
  await page.getByLabel("Social sections").getByRole("tab", { name: /Invites/ }).click();
  await expect(page.getByText("Hidden Late Night Room")).toBeVisible();
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("Hidden Late Night Room")).toHaveCount(0);
  await expect(page.getByText("Recent invite history")).toHaveCount(0);
  await expect(page.getByText("No room invites right now.")).toBeVisible();
});