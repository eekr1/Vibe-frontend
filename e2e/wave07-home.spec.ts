import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const envelope = (data: unknown) => JSON.stringify({ data, ok: true });
const failure = (code: string, message: string) => JSON.stringify({ error: { code, message }, ok: false });

type HomeMock = {
  auth?: "guest" | "member";
  discover?: "empty" | "error" | "rooms" | "retry";
  discoverDelayMs?: number;
};

function room(id: string, overrides: Record<string, unknown> = {}) {
  return {
    activeParticipantCount: 3,
    card: {
      capacityLabel: "3/12",
      isNearlyFull: false,
      searchText: "Night room Ada Music " + id,
      thumbnailAlt: "Night room " + id + " YouTube thumbnail"
    },
    category: { id: "category-music", name: "Music", slug: "music" },
    createdAt: "2026-07-23T00:00:00.000Z",
    endedAt: null,
    host: { avatarUrl: null, displayName: "Ada Lovelace", id: "host-ada", username: "ada" },
    id,
    participantLimit: 12,
    slug: id,
    source: {
      provider: "youtube",
      thumbnailUrl: "/thumbnail.svg",
      title: "Night room " + id,
      url: "https://youtube.com/watch?v=example",
      videoId: "example"
    },
    state: "live",
    title: "Night room " + id,
    updatedAt: "2026-07-23T00:00:00.000Z",
    visibility: "public",
    ...overrides
  };
}

async function mockHome(page: Page, options: HomeMock = {}) {
  let discoverRequests = 0;

  await page.route("**/thumbnail.svg", (route) => route.fulfill({
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#24345a"/></svg>',
    contentType: "image/svg+xml",
    status: 200
  }));

  await page.route("**/api/**", async (route: Route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname.replace(/^\/api/, "");
    const json = (status: number, body: string) => route.fulfill({ body, contentType: "application/json", status });

    if (path === "/auth/me") {
      if (options.auth === "member") {
        return json(200, envelope({
          user: {
            accountState: "active",
            avatarUrl: null,
            displayName: "Ada Lovelace",
            email: "ada@example.com",
            id: "user-ada",
            role: "member",
            username: "ada"
          }
        }));
      }
      return json(401, failure("AUTHENTICATION_REQUIRED", "Authentication required."));
    }

    if (path === "/social/notifications/summary") {
      return json(200, envelope({ actionableCount: 0, readCount: 0, unreadCount: 0 }));
    }

    if (path === "/discover/rooms") {
      discoverRequests += 1;
      if (options.discoverDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.discoverDelayMs));
      }
      if (options.discover === "error" || (options.discover === "retry" && discoverRequests === 1)) {
        return json(503, failure("SERVICE_UNAVAILABLE", "Service unavailable."));
      }
      if (options.discover === "empty") {
        return json(200, envelope({
          filters: { categoryId: null, categorySlug: null, search: "", sort: "newest" },
          nextCursor: null,
          rooms: []
        }));
      }
      return json(200, envelope({
        filters: { categoryId: null, categorySlug: null, search: "", sort: "newest" },
        nextCursor: null,
        rooms: [
          room("room-live"),
          room("room-private", { visibility: "private" }),
          room("room-ended", { state: "ended" })
        ]
      }));
    }

    return json(404, failure("NOT_FOUND", "Not found."));
  });
}

test("guest Home delivers the first-view promise, real room evidence and safe CTA targets", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await mockHome(page, { auth: "guest", discover: "rooms" });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turn a YouTube link into a shared room.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Enter Night room room-live/ })).toBeVisible();
  await expect(page.getByText("Night room room-private")).toHaveCount(0);
  await expect(page.getByText("Night room room-ended")).toHaveCount(0);
  await expect(page.locator(".home-hero-visual img")).toHaveAttribute("loading", "eager");
  await expect(page.locator(".room-card-thumbnail")).toHaveAttribute("loading", "lazy");

  const liveCard = page.locator(".room-card").first();
  const cardBox = await liveCard.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cardBox?.y ?? 901).toBeLessThan(900);

  await page.getByRole("button", { name: "Open a room" }).first().click();
  await expect(page).toHaveURL(/\/auth\?mode=login&returnTo=%2Fcreate-room$/);

  await page.goto("/");
  await page.getByRole("button", { name: "Enter the hall" }).first().click();
  await expect(page).toHaveURL(/\/discover$/);
});

test("member Home sends Open a room directly to the existing Create Room route", async ({ page }) => {
  await mockHome(page, { auth: "member", discover: "rooms" });
  await page.goto("/");

  await expect(page.getByText("Ada Lovelace").first()).toBeVisible();
  await page.getByRole("button", { name: "Open a room" }).first().click();
  await expect(page).toHaveURL(/\/create-room$/);
});

test("Home keeps the hero available across loading, empty and local retry states", async ({ page }) => {
  await mockHome(page, { auth: "guest", discover: "rooms", discoverDelayMs: 400 });
  await page.goto("/");
  await expect(page.getByRole("status", { name: "Loading live rooms" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter the hall" }).first()).toBeEnabled();
  await expect(page.getByRole("button", { name: /Enter Night room room-live/ })).toBeVisible();

  await page.unrouteAll({ behavior: "wait" });
  await mockHome(page, { auth: "guest", discover: "empty" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "The hall is quiet right now." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open a room" }).last()).toBeVisible();

  await page.unrouteAll({ behavior: "wait" });
  await mockHome(page, { auth: "guest", discover: "retry" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "We couldn’t load live rooms." })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: /Enter Night room room-live/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("Home remains keyboard-accessible, motion-safe and overflow-free on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockHome(page, { auth: "guest", discover: "rooms" });
  await page.goto("/");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const enterHall = page.getByRole("button", { name: "Enter the hall" }).first();
  await enterHall.focus();
  await expect(enterHall).toBeFocused();
  await expect(enterHall).toHaveCSS("transform", "none");

  const card = page.getByRole("button", { name: /Enter Night room room-live/ });
  await card.focus();
  await expect(card).toBeFocused();
  await expect(card).toHaveCSS("transform", "none");
  expect(await card.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44;
  })).toBe(true);
});