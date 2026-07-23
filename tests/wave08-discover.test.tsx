import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createDiscoverPath,
  createDiscoverRequest,
  DISCOVER_ROOM_LIMIT,
  DISCOVER_SEARCH_MAX_LENGTH,
  getDiscoverEmptyStateCopy,
  readDiscoverQuery,
  selectDiscoverRooms
} from "../src/pages/DiscoverShellPage";
import type { Room, RoomCategory } from "../src/rooms/roomApi";

const projectRoot = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");
const categories: RoomCategory[] = [
  { id: "category-music", name: "Music", slug: "music" },
  { id: "category-gaming", name: "Gaming", slug: "gaming" }
];

function roomFixture(id: string, overrides: Partial<Room> = {}): Room {
  return {
    activeParticipantCount: 3,
    category: categories[0],
    createdAt: "2026-07-23T00:00:00.000Z",
    endedAt: null,
    host: { avatarUrl: null, displayName: "Ada", id: "host-ada", username: "ada" },
    id,
    participantLimit: 12,
    slug: id,
    source: {
      provider: "youtube",
      thumbnailUrl: null,
      title: "Night room",
      url: "https://youtube.com/watch?v=example",
      videoId: "example"
    },
    state: "live",
    title: `Room ${id}`,
    updatedAt: "2026-07-23T00:00:00.000Z",
    visibility: "public",
    ...overrides
  };
}

describe("Wave 08 Discover query contract", () => {
  it("hydrates allowed URL values and safely falls back from invalid sort and category values", () => {
    expect(readDiscoverQuery("?search=night&categorySlug=music&sort=active", categories)).toEqual({
      categorySlug: "music",
      search: "night",
      sort: "active"
    });
    expect(readDiscoverQuery("?categorySlug=unknown&sort=popular", categories)).toEqual({
      categorySlug: "",
      search: "",
      sort: "newest"
    });
  });

  it("bounds search input to the backend maximum and writes one canonical Discover URL", () => {
    const overlongSearch = "x".repeat(DISCOVER_SEARCH_MAX_LENGTH + 20);
    expect(readDiscoverQuery(`?search=${overlongSearch}`).search).toHaveLength(DISCOVER_SEARCH_MAX_LENGTH);
    expect(createDiscoverPath({ categorySlug: "music", search: "  night drive  ", sort: "active" }))
      .toBe("/discover?search=night+drive&categorySlug=music&sort=active");
    expect(createDiscoverPath({ categorySlug: "", search: "", sort: "newest" })).toBe("/discover");
  });

  it("sends only the supported search, categorySlug, sort, cursor and limit fields", () => {
    const request = createDiscoverRequest(
      { categorySlug: "music", search: " night ", sort: "nearly-full" },
      "cursor-12"
    );
    expect(request).toEqual({
      categorySlug: "music",
      cursor: "cursor-12",
      limit: DISCOVER_ROOM_LIMIT,
      search: "night",
      sort: "nearly-full"
    });
    expect(Object.keys(request).sort()).toEqual(["categorySlug", "cursor", "limit", "search", "sort"]);
  });
});

describe("Wave 08 Discover policy and state boundaries", () => {
  it("defensively renders only backend-provided public and live rooms", () => {
    const selected = selectDiscoverRooms([
      roomFixture("live"),
      roomFixture("private", { visibility: "private" }),
      roomFixture("ended", { state: "ended" })
    ]);
    expect(selected.map((room) => room.id)).toEqual(["live"]);
  });

  it("keeps no-live, no-search and no-filter copy distinct", () => {
    expect(getDiscoverEmptyStateCopy("", undefined).title).toBe("The hall is quiet right now.");
    expect(getDiscoverEmptyStateCopy("night", undefined).title).toBe("No rooms match your search.");
    expect(getDiscoverEmptyStateCopy("", categories[0]).title).toBe("No live Music rooms yet.");
  });

  it("keeps stale responses, helper errors and load-more failures local to their owners", () => {
    const discover = source("src/pages/DiscoverShellPage.tsx");
    expect(discover).toContain("queryRequestSequence.current !== requestId");
    expect(discover).toContain("activeQueryKey.current !== queryKey");
    expect(discover).toContain("setCategoryError");
    expect(discover).toContain("setLoadMoreError");
    expect(discover).not.toContain("setRooms([])");
    expect(discover).not.toMatch(/trending|popular tags|verified|people search/i);
  });

  it("uses one page-owned heading, shared RoomCard/state primitives and semantic result announcements", () => {
    const discover = source("src/pages/DiscoverShellPage.tsx");
    const shell = source("src/components/AppShell.tsx");
    expect(discover.match(/<h1\b/g)).toHaveLength(1);
    expect(discover).toContain("<RoomCard onNavigate={onNavigate} room={room} />");
    expect(discover).toContain("<RoomCardSkeleton />");
    expect(discover).toContain('aria-live="polite"');
    expect(discover).toContain('aria-busy={isRefreshing}');
    expect(discover).toContain('aria-label="Quick category filters"');
    expect(discover).toContain("categories.map((category) => (");
    expect(discover).toContain("aria-pressed={appliedCategorySlug === category.slug}");
    expect(discover).toContain("onClick={() => updateCategory(category.slug)}");
    expect(shell).toContain('activeRoute.path !== "/discover"');
  });

  it("keeps the composition matte, token-driven, responsive and motion-safe", () => {
    const pages = source("src/styles/pages.css");
    const responsive = source("src/styles/responsive.css");
    expect(pages).toContain(".discover-query-toolbar");
    expect(pages).toContain(".discover-category-shortcuts");
    expect(pages).toContain("overflow-x: auto");
    expect(pages).toContain("background: var(--color-surface-standard)");
    expect(pages).not.toContain("backdrop-filter");
    expect(responsive).toContain(".discover-query-selects");
    expect(source("src/styles/room-card.css")).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
