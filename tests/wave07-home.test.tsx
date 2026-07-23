import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { CurrentUser } from "../src/auth/AuthContext";
import { routes } from "../src/lib/routes";
import { getHomeOpenRoomPath, HOME_ROOM_LIMIT, selectHomeRooms } from "../src/pages/HomeShellPage";
import type { Room } from "../src/rooms/roomApi";

const projectRoot = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

function roomFixture(id: string, overrides: Partial<Room> = {}): Room {
  return {
    activeParticipantCount: 3,
    category: { id: "music", name: "Music", slug: "music" },
    createdAt: "2026-07-23T00:00:00.000Z",
    endedAt: null,
    host: { avatarUrl: null, displayName: "Ada Lovelace", id: "host-ada", username: "ada" },
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
    title: "Room " + id,
    updatedAt: "2026-07-23T00:00:00.000Z",
    visibility: "public",
    ...overrides
  };
}

const member: CurrentUser = {
  accountState: "active",
  avatarUrl: null,
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  id: "user-ada",
  role: "member",
  username: "ada"
};

describe("Wave 07 Home CTA and real-room contracts", () => {
  it("keeps Enter the hall public and routes Open a room by resolved auth state", () => {
    expect(getHomeOpenRoomPath(null, false)).toBe("/auth?mode=login&returnTo=%2Fcreate-room");
    expect(getHomeOpenRoomPath(member, false)).toBe("/create-room");
    expect(getHomeOpenRoomPath(null, true)).toBe("/create-room");

    const home = source("src/pages/HomeShellPage.tsx");
    expect(home).toContain('onClick={() => onNavigate("/discover")}');
    expect(home).toContain("onClick={() => onNavigate(openRoomPath)}");
  });

  it("preserves server order, filters non-public/non-live rows and caps the Home subset", () => {
    const rooms = [
      roomFixture("public-1"),
      roomFixture("private", { visibility: "private" }),
      roomFixture("ended", { state: "ended" }),
      ...Array.from({ length: 8 }, (_, index) => roomFixture("public-" + (index + 2)))
    ];

    const selected = selectHomeRooms(rooms);
    expect(selected).toHaveLength(HOME_ROOM_LIMIT);
    expect(selected.map((room) => room.id)).toEqual([
      "public-1", "public-2", "public-3", "public-4", "public-5", "public-6"
    ]);
  });

  it("uses the existing Discover request, shared RoomCard and shared state primitives", () => {
    const home = source("src/pages/HomeShellPage.tsx");
    expect(home).toContain("listPublicRooms({ limit: HOME_ROOM_LIMIT })");
    expect(home).toContain("<RoomCard key={room.id}");
    expect(home).toContain("<RoomCardSkeleton");
    expect(home).toContain("<EmptyState");
    expect(home).toContain("<SectionError");
    expect(home).toContain("requestSequence.current !== requestId");
    expect(home).not.toMatch(/preview-live-pill|preview-play-mark|home-story-card|home-split-band/);
    expect(home).not.toMatch(/trending|popularity|verified|no sign up required|no tracking|anonymous/i);
  });
});

describe("Wave 07 Home semantics, asset and visual boundaries", () => {
  it("owns exactly one Home h1 while the shell keeps route metadata and non-Home mastheads", () => {
    const homeRoute = routes.find((route) => route.path === "/");
    const home = source("src/pages/HomeShellPage.tsx");
    const shell = source("src/components/AppShell.tsx");

    expect(homeRoute).toMatchObject({
      path: "/",
      shell: "home",
      title: "Live rooms for shared YouTube moments"
    });
    expect(home.match(/<h1\b/g)).toHaveLength(1);
    expect(home).toContain('<h1 id="home-title">');
    expect(shell).toContain('activeRoute.shell !== "home"');
  });

  it("ships a stable decorative hero asset without making RoomCard media eager", () => {
    const home = source("src/pages/HomeShellPage.tsx");
    const roomCard = source("src/rooms/RoomCard.tsx");
    const asset = statSync(resolve(projectRoot, "public/images/vibehall-home-hall.webp"));

    expect(asset.size).toBeLessThanOrEqual(100_000);
    expect(home).toContain('alt=""');
    expect(home).toContain('aria-hidden="true"');
    expect(home).toContain('fetchPriority="high"');
    expect(home).toContain('height="896"');
    expect(home).toContain('width="1792"');
    expect(roomCard).toContain('thumbnailLoading = "lazy"');
  });

  it("keeps Home styling token-driven, matte and responsive", () => {
    const pages = source("src/styles/pages.css");
    const responsive = source("src/styles/responsive.css");

    expect(pages).toContain("color: var(--color-accent)");
    expect(pages).toContain("background: var(--color-surface-standard)");
    expect(pages).toContain("@media (prefers-reduced-motion: reduce)");
    expect(pages).not.toMatch(/#[a-fA-F0-9]{3,8}/);
    expect(pages).not.toContain("backdrop-filter");
    expect(responsive).toContain("@media (max-width: 760px)");
    expect(responsive).toContain("grid-auto-columns: min(82vw, 18rem)");
  });
});