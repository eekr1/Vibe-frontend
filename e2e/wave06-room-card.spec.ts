import { expect, test, type Page, type Route } from "@playwright/test";

const envelope = (data: unknown) => JSON.stringify({ data, ok: true });
const failure = (code: string, message: string) => JSON.stringify({ error: { code, message }, ok: false });

function room(id: string, thumbnailUrl: string | null) {
  return {
    activeParticipantCount: id === "room-live" ? 3 : 1,
    card: {
      capacityLabel: id === "room-live" ? "3/12" : "1/8",
      isNearlyFull: id === "room-live",
      searchText: id === "room-live" ? "Lo-fi Night Ada Music" : "Quiet Study Deniz Focus",
      thumbnailAlt: id === "room-live" ? "Lo-fi Night YouTube thumbnail" : "Quiet Study YouTube thumbnail"
    },
    category: id === "room-live"
      ? { id: "category-music", name: "Music", slug: "music" }
      : { id: "category-focus", name: "Focus", slug: "focus" },
    createdAt: "2026-07-23T00:00:00.000Z",
    endedAt: null,
    host: {
      avatarUrl: null,
      displayName: id === "room-live" ? "Ada Lovelace" : "Deniz Kaya",
      id: `host-${id}`,
      username: id === "room-live" ? "ada" : "deniz"
    },
    id,
    participantLimit: id === "room-live" ? 12 : 8,
    slug: id,
    source: {
      provider: "youtube",
      thumbnailUrl,
      title: id === "room-live" ? "Lo-fi Night" : "Quiet Study",
      url: "https://youtube.com/watch?v=example",
      videoId: "example"
    },
    state: "live",
    title: id === "room-live" ? "Lo-fi Night" : "Quiet Study",
    updatedAt: "2026-07-23T00:00:00.000Z",
    visibility: "public"
  };
}

async function mockDiscover(page: Page) {
  await page.route("**/thumbnail.svg", (route) => route.fulfill({
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#24345a"/></svg>',
    contentType: "image/svg+xml",
    status: 200
  }));

  await page.route("**/api/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    const json = (status: number, body: string) => route.fulfill({ body, contentType: "application/json", status });

    if (path === "/auth/me") {
      return json(401, failure("AUTHENTICATION_REQUIRED", "Authentication required."));
    }
    if (path === "/categories") {
      return json(200, envelope({ categories: [
        { id: "category-music", name: "Music", slug: "music" },
        { id: "category-focus", name: "Focus", slug: "focus" }
      ] }));
    }
    if (path === "/discover/rooms") {
      return json(200, envelope({
        filters: { categoryId: null, categorySlug: null, search: "", sort: "newest" },
        nextCursor: null,
        rooms: [room("room-live", "/thumbnail.svg"), room("room-fallback", null)]
      }));
    }
    return json(404, failure("NOT_FOUND", "Not found."));
  });
}

test("desktop RoomCard uses real fields, stable media, static aura, focus and the existing Room target", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await mockDiscover(page);
  await page.goto("/discover");

  const card = page.getByRole("button", {
    name: "Enter Lo-fi Night, hosted by Ada Lovelace. Live Music room with 3 of 12 people inside."
  });
  await expect(card).toBeVisible();
  await expect(card.getByText("Nearly full")).toBeVisible();
  await expect(card.getByText("3/12 inside")).toBeVisible();
  await expect(card.locator(".room-card-thumbnail")).toHaveAttribute("loading", "lazy");
  await expect(card.locator(".room-card-thumbnail")).toHaveAttribute("width", "640");
  await expect(card.locator(".room-card-thumbnail")).toHaveAttribute("height", "360");

  const media = card.locator(".room-card-media");
  const mediaBox = await media.boundingBox();
  expect(mediaBox).not.toBeNull();
  expect((mediaBox?.width ?? 0) / (mediaBox?.height ?? 1)).toBeCloseTo(16 / 9, 1);

  const frame = card.locator("xpath=..");
  await expect(frame).toHaveAttribute("data-thumbnail-state", "loaded");
  const aura = frame.locator(".room-card-aura");
  await expect(aura).toHaveCount(1);
  await expect(aura).toHaveCSS("opacity", "0.14");

  await card.focus();
  await expect(card).toBeFocused();
  await expect(card).not.toHaveCSS("transform", "none");
  await expect(frame.locator(".room-card-entry")).toHaveCSS("opacity", "1");

  await card.click();
  await expect(page).toHaveURL(/\/room\?roomId=room-live$/);
});

test("missing media stays neutral and mobile/reduced-motion keeps a visible static entry affordance", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockDiscover(page);
  await page.goto("/discover");

  const fallbackCard = page.getByRole("button", {
    name: "Enter Quiet Study, hosted by Deniz Kaya. Live Focus room with 1 of 8 people inside."
  });
  await expect(fallbackCard).toBeVisible();
  await expect(fallbackCard.locator(".room-card-media-placeholder")).toHaveAttribute(
    "aria-label",
    "Thumbnail unavailable for Quiet Study"
  );
  await expect(fallbackCard.locator("img")).toHaveCount(0);
  await expect(fallbackCard.locator(".room-card-entry")).toHaveCSS("opacity", "1");

  await fallbackCard.focus();
  await expect(fallbackCard).toHaveCSS("transform", "none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
