import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const envelope = (data: unknown) => JSON.stringify({ data, ok: true });
const failure = (code: string, message: string) => JSON.stringify({ error: { code, message }, ok: false });

type DiscoverMockOptions = {
  auth?: "guest" | "member";
  initialDelayMs?: number;
  loadMoreFailsOnce?: boolean;
};

function room(id: string, overrides: Record<string, unknown> = {}) {
  return {
    activeParticipantCount: 3,
    card: {
      capacityLabel: "3/12",
      isNearlyFull: false,
      searchText: `Night room Ada Music ${id}`,
      thumbnailAlt: `Night room ${id} YouTube thumbnail`
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
      thumbnailUrl: null,
      title: `Night room ${id}`,
      url: "https://youtube.com/watch?v=example",
      videoId: "example"
    },
    state: "live",
    title: `Night room ${id}`,
    updatedAt: "2026-07-23T00:00:00.000Z",
    visibility: "public",
    ...overrides
  };
}

async function mockDiscover(page: Page, options: DiscoverMockOptions = {}) {
  const discoverRequests: URL[] = [];
  let initialRequestSeen = false;
  let loadMoreAttempts = 0;

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

    if (path === "/categories") {
      return json(200, envelope({
        categories: [
          { id: "category-music", name: "Music", slug: "music" },
          { id: "category-gaming", name: "Gaming", slug: "gaming" }
        ]
      }));
    }

    if (path === "/discover/rooms") {
      discoverRequests.push(requestUrl);
      const search = requestUrl.searchParams.get("search") ?? "";
      const categorySlug = requestUrl.searchParams.get("categorySlug") ?? "";
      const sort = requestUrl.searchParams.get("sort") ?? "newest";
      const cursor = requestUrl.searchParams.get("cursor");

      if (!initialRequestSeen && options.initialDelayMs) {
        initialRequestSeen = true;
        await new Promise((resolve) => setTimeout(resolve, options.initialDelayMs));
      }

      if (search === "slow") {
        await new Promise((resolve) => setTimeout(resolve, 650));
      }
      if (search === "fast") {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }

      if (cursor) {
        loadMoreAttempts += 1;
        if (options.loadMoreFailsOnce && loadMoreAttempts === 1) {
          return json(503, failure("SERVICE_UNAVAILABLE", "Service unavailable."));
        }
        return json(200, envelope({
          filters: { categoryId: null, categorySlug, search, sort },
          nextCursor: null,
          rooms: [room("page-2"), room("page-2-private", { visibility: "private" })]
        }));
      }

      if (search === "none" || categorySlug === "gaming") {
        return json(200, envelope({
          filters: { categoryId: null, categorySlug, search, sort },
          nextCursor: null,
          rooms: []
        }));
      }

      const roomId = search || `${categorySlug || "all"}-${sort}`;
      return json(200, envelope({
        filters: { categoryId: null, categorySlug, search, sort },
        nextCursor: search ? null : "cursor-12",
        rooms: [
          room(roomId),
          room(`${roomId}-private`, { visibility: "private" }),
          room(`${roomId}-ended`, { state: "ended" })
        ]
      }));
    }

    return json(404, failure("NOT_FOUND", "Not found."));
  });

  return { discoverRequests };
}

test("Discover hydrates URL query, writes supported values and restores controls with browser history", async ({ page }) => {
  const mock = await mockDiscover(page);
  await page.goto("/discover?search=night&categorySlug=music&sort=active");

  const search = page.getByRole("searchbox", { name: "Search live rooms" });
  const category = page.getByRole("combobox", { name: "Category" });
  const sort = page.getByRole("combobox", { name: "Sort rooms" });
  await expect(search).toHaveValue("night");
  await expect(category).toHaveValue("music");
  await expect(sort).toHaveValue("active");
  await expect(page.getByRole("button", { name: /Enter Night room night,/ })).toBeVisible();

  await search.fill("lofi");
  await expect(page).toHaveURL(/search=lofi/);
  await expect(page.getByRole("button", { name: /Enter Night room lofi,/ })).toBeVisible();
  await sort.selectOption("nearly-full");
  await expect(page).toHaveURL(/sort=nearly-full/);

  await page.goBack();
  await expect(sort).toHaveValue("active");
  await expect(search).toHaveValue("lofi");
  await search.fill("ambient");
  await expect(page).toHaveURL(/search=ambient/);
  await page.goBack();
  await expect(search).toHaveValue("lofi");
  await page.goBack();
  await expect(search).toHaveValue("night");
  await expect(category).toHaveValue("music");

  for (const requestUrl of mock.discoverRequests) {
    expect([...requestUrl.searchParams.keys()].every((key) =>
      ["categorySlug", "cursor", "limit", "search", "sort"].includes(key)
    )).toBe(true);
  }
});

test("Discover preserves the grid during quiet refresh and ignores a late stale response", async ({ page }) => {
  await mockDiscover(page);
  await page.goto("/discover");

  const search = page.getByRole("searchbox", { name: "Search live rooms" });
  await expect(page.getByRole("button", { name: /Enter Night room all-newest,/ })).toBeVisible();
  await search.fill("slow");
  await page.waitForRequest((request) => request.url().includes("search=slow"));
  await expect(page.getByRole("button", { name: /Enter Night room all-newest,/ })).toBeVisible();
  await expect(page.locator(".discover-refresh-status")).toContainText("Updating rooms");

  await search.fill("fast");
  await expect(page.getByRole("button", { name: /Enter Night room fast,/ })).toBeVisible();
  await page.waitForTimeout(750);
  await expect(page.getByRole("button", { name: /Enter Night room slow,/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Enter Night room fast,/ })).toBeVisible();
});

test("Discover separates empty and load-more failure states while preserving policy and Room handoff", async ({ page }) => {
  await mockDiscover(page, { loadMoreFailsOnce: true });
  await page.goto("/discover");

  await expect(page.getByText("Night room all-newest-private")).toHaveCount(0);
  await expect(page.getByText("Night room all-newest-ended")).toHaveCount(0);
  await page.getByRole("button", { name: "Load more rooms" }).click();
  await expect(page.getByText("This part of Vibehall is not available right now.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Enter Night room all-newest,/ })).toBeVisible();
  await page.getByRole("button", { name: "Retry load more" }).click();
  await expect(page.getByRole("button", { name: /Enter Night room page-2,/ })).toBeVisible();
  await expect(page.getByText("Night room page-2-private")).toHaveCount(0);

  const search = page.getByRole("searchbox", { name: "Search live rooms" });
  await search.fill("none");
  await expect(page.getByRole("heading", { name: "No rooms match your search." })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("combobox", { name: "Category" }).selectOption("gaming");
  await expect(page.getByRole("heading", { name: "No live Gaming rooms yet." })).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: /Enter Night room all-newest,/ }).click();
  await expect(page).toHaveURL(/\/room\?roomId=all-newest$/);
});

test("Discover remains accessible, motion-safe and overflow-free on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockDiscover(page, { initialDelayMs: 350 });
  await page.goto("/discover");

  await expect(page.getByRole("list", { name: "Loading public rooms" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Discover" })).toBeVisible();
  const card = page.getByRole("button", { name: /Enter Night room all-newest,/ });
  await expect(card).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const search = page.getByRole("searchbox", { name: "Search live rooms" });
  await search.focus();
  await expect(search).toBeFocused();
  await card.focus();
  await expect(card).toBeFocused();
  await expect(card).toHaveCSS("transform", "none");
  expect(await card.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44;
  })).toBe(true);
});
