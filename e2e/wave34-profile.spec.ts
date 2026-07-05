import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const user = { accountState: "active", avatarUrl: null as string | null, displayName: "Ada Lovelace", email: "ada@example.test", id: "user-1", role: "member", username: "ada" };
const initialsAvatar = { initials: "AL", kind: "initials" as const };
const managedAvatar = { kind: "managed" as const, urls: { large: "https://cdn.test/avatars/v2/512.webp", small: "https://cdn.test/avatars/v2/128.webp" }, version: "v2" };

function envelope(data: unknown) { return JSON.stringify({ data, ok: true }); }
function failure(code: string, message: string) { return JSON.stringify({ error: { code, message }, ok: false }); }

async function mockApi(page: Page, options: { authenticated?: boolean; deletionFailsOnce?: boolean; memberView?: boolean; socialEnabled?: boolean; unavailable?: boolean; uploadFailsOnce?: boolean } = {}) {
  let profile = { avatar: initialsAvatar as typeof initialsAvatar | typeof managedAvatar, bio: "Calm rooms, old films, good company.", displayName: user.displayName, id: user.id, memberSince: "2024-02", username: user.username, viewer: "self" as const };
  let currentUser = { ...user };
  let settings = { friendRequestPrivacy: "everyone", invitePrivacy: "friends", lastSeenPrivacy: "friends", onlinePrivacy: "friends", updatedAt: "2026-07-05T00:00:00.000Z" };
  let signedIn = options.authenticated ?? true;
  let deletionAttempts = 0;
  let uploadAttempts = 0;
  if (options.memberView) currentUser = { ...currentUser, id: "user-2", username: "grace" };

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const method = request.method();
    const json = (status: number, body: string, headers: Record<string, string> = {}) => route.fulfill({ body, contentType: "application/json", headers, status });

    if (path === "/auth/csrf") return json(200, envelope({ token: signedIn ? "csrf-token" : null }));
    if (path === "/auth/me") return signedIn ? json(200, envelope({ user: currentUser })) : json(401, failure("AUTH_REQUIRED", "Log in to continue."));
    if (path === "/auth/logout" && method === "POST") { signedIn = false; return json(200, envelope({ loggedOut: true })); }
    if (path === "/users/me/profile" && method === "GET") return json(200, envelope({ capabilities: { socialEnabled: options.socialEnabled ?? true }, profile, settings, user: currentUser }));
    if (path === "/users/me/profile" && method === "PATCH") {
      const body = request.postDataJSON() as { bio?: string | null; displayName?: string };
      profile = { ...profile, bio: body.bio ?? profile.bio, displayName: body.displayName ?? profile.displayName };
      currentUser = { ...currentUser, displayName: profile.displayName };
      return json(200, envelope({ profile, user: currentUser }));
    }
    if (path === "/users/me/social-settings" && method === "PATCH") { settings = { ...settings, ...(request.postDataJSON() as typeof settings) }; return json(200, envelope({ settings })); }
    if (path === "/users/me/avatar" && method === "POST") {
      expect(await request.headerValue("content-type")).toContain("multipart/form-data");
      uploadAttempts += 1;
      if (options.uploadFailsOnce && uploadAttempts === 1) return json(503, failure("UPLOAD_FAILED", "Avatar upload temporarily failed."));
      profile = { ...profile, avatar: managedAvatar }; currentUser = { ...currentUser, avatarUrl: managedAvatar.urls.small };
      return json(201, envelope({ avatar: managedAvatar }));
    }
    if (path === "/users/me/avatar" && method === "DELETE") { profile = { ...profile, avatar: initialsAvatar }; currentUser = { ...currentUser, avatarUrl: null }; return json(200, envelope({ avatar: initialsAvatar })); }
    if (path === "/users/me/account-deletion" && method === "POST") {
      deletionAttempts += 1;
      if (options.deletionFailsOnce && deletionAttempts === 1) return json(409, failure("DELETION_REJECTED", "Password verification failed."));
      return json(202, envelope({ deletion: { requestedAt: new Date().toISOString(), state: "requested" } }));
    }
    if (/^\/users\/[^/]+\/profile$/.test(path)) {
      if (options.unavailable) return json(404, failure("NOT_FOUND", "Profile unavailable."));
      const viewer = signedIn ? (currentUser.id === profile.id ? "owner_preview" : "authenticated") : "guest";
      return json(200, envelope({ profile: { ...profile, ...(viewer === "guest" ? { authenticationRequiredForActions: true } : {}), viewer } }), viewer === "guest" ? { "X-Robots-Tag": "noindex, nofollow" } : {});
    }
    return json(404, failure("NOT_FOUND", "Not found."));
  });
}

test("guest and member direct profiles are layered, no-index and privacy-safe", async ({ page }) => {
  await mockApi(page, { authenticated: false });
  const guestProfileResponse = page.waitForResponse((response) => /\/api\/users\/ada\/profile$/.test(response.url()));
  await page.goto("/users/ada");
  const guestPayload = await (await guestProfileResponse).json() as Record<string, unknown>;
  expect(JSON.stringify(guestPayload)).not.toMatch(/ada@example\.test|accountState|role|avatarUrl/);
  await expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
  await expect(page.getByLabel("Ada Lovelace", { exact: true }).getByRole("button", { name: "Log in" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
  await expect(page.getByText("ada@example.test")).toHaveCount(0);
  await expect(page.getByText("Account state")).toHaveCount(0);
  await page.unrouteAll({ behavior: "wait" });

  await mockApi(page, { authenticated: true, memberView: true });
  await page.goto("/users/ada");
  await expect(page.getByText(/Presence will appear/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage settings" })).toHaveCount(0);
});

test("unavailable profile is generic and leaks no account-state reason", async ({ page }) => {
  await mockApi(page, { authenticated: true, unavailable: true });
  await page.goto("/users/missing");
  await expect(page.getByRole("heading", { name: "This member profile cannot be shown." })).toBeVisible();
  await expect(page.getByText(/banned|suspended|blocked/i)).toHaveCount(0);
});

test("self profile and settings edit, privacy, managed avatar lifecycle and deletion complete", async ({ page }) => {
  await mockApi(page, { authenticated: true, socialEnabled: true });
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
  await page.getByRole("button", { name: "Manage profile and privacy" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByLabel("Display name").fill("Ada Byron");
  await page.getByLabel("Bio").fill("Quiet screenings and thoughtful rooms.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile details saved.")).toBeFocused();

  await page.getByLabel("Friend requests").selectOption("nobody");
  await page.getByLabel("Online status").selectOption("nobody");
  await page.getByRole("button", { name: "Save privacy" }).click();
  await expect(page.getByText("Privacy preferences saved.")).toBeFocused();

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAwMDAxMDAwMAAAAcIAQF7nN1NAAAAAElFTkSuQmCC", "base64");
  await page.getByLabel("Image from this device").setInputFiles({ buffer: png, mimeType: "image/png", name: "avatar.png" });
  await expect(page.getByLabel("Square avatar crop preview")).toBeVisible();
  await page.getByLabel("Crop size").focus();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Upload avatar" }).click();
  await expect(page.getByText(/Avatar updated/)).toBeFocused();
  await expect(page.getByRole("img", { name: "Ada Byron's avatar" }).first()).toHaveAttribute("src", /v2/);
  await page.getByRole("button", { name: "Remove avatar" }).click();
  await expect(page.getByText(/Avatar updated/)).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include("main").analyze();
  expect(accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

  await page.getByRole("button", { name: "Delete account permanently" }).click();
  await expect(page.getByRole("heading", { name: "Delete your Vibehall account?" })).toBeFocused();
  await page.getByLabel("Current password").fill("correct horse battery staple");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("heading", { name: "You have been signed out." })).toBeVisible();
});

test("settings stay compact and overflow-safe with long content", async ({ page }) => {
  await mockApi(page, { authenticated: true });
  await page.setViewportSize({ height: 900, width: 640 });
  await page.goto("/settings");
  await page.getByLabel("Display name").fill("W".repeat(48));
  await page.getByLabel("Bio").fill("Long calm profile text ".repeat(7).slice(0, 160));
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const overflow = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
});

test("social flag off gates unfinished controls without dead navigation", async ({ page }) => {
  await mockApi(page, { authenticated: true, socialEnabled: false });
  await page.goto("/settings");
  await expect(page.getByText(/safely disabled/)).toBeVisible();
  await expect(page.getByLabel("Bio")).toBeDisabled();
  await expect(page.getByLabel("Image from this device")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete account permanently" })).toBeDisabled();
  await expect(page.getByRole("link", { name: /Blocked/i })).toHaveCount(0);
});

test("avatar and deletion failures remain recoverable", async ({ page }) => {
  await mockApi(page, { authenticated: true, deletionFailsOnce: true, uploadFailsOnce: true });
  await page.goto("/settings");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAwMDAxMDAwMAAAAcIAQF7nN1NAAAAAElFTkSuQmCC", "base64");
  await page.getByLabel("Image from this device").setInputFiles({ buffer: png, mimeType: "image/png", name: "avatar.png" });
  await page.getByRole("button", { name: "Upload avatar" }).click();
  await expect(page.getByText("Avatar upload temporarily failed.")).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText(/Avatar updated/)).toBeFocused();

  await page.getByRole("button", { name: "Replace avatar" }).click();
  await expect(page.getByLabel("Image from this device")).toBeFocused();
  await page.getByRole("button", { name: "Delete account permanently" }).click();
  await page.getByLabel("Current password").fill("wrong then right");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("Password verification failed.")).toBeFocused();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("heading", { name: "You have been signed out." })).toBeVisible();
});
