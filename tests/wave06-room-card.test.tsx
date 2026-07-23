import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RoomCard } from "../src/rooms/RoomCard";
import type { Room } from "../src/rooms/roomApi";

const projectRoot = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(projectRoot, "..");
const source = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");
const workspaceSource = (path: string) => readFileSync(resolve(workspaceRoot, path), "utf8");

function roomFixture(overrides: Partial<Room> = {}): Room {
  return {
    activeParticipantCount: 3,
    card: {
      capacityLabel: "3/12",
      isNearlyFull: true,
      searchText: "Lo-fi Night Ada Music",
      thumbnailAlt: "Lo-fi Night YouTube thumbnail"
    },
    category: { id: "category-1", name: "Music", slug: "music" },
    createdAt: "2026-07-23T00:00:00.000Z",
    endedAt: null,
    host: {
      avatarUrl: null,
      displayName: "Ada Lovelace",
      id: "user-1",
      username: "ada"
    },
    id: "room-1",
    participantLimit: 12,
    slug: "lo-fi-night",
    source: {
      provider: "youtube",
      thumbnailUrl: "https://img.youtube.com/vi/example/hqdefault.jpg",
      title: "Lo-fi Night",
      url: "https://youtube.com/watch?v=example",
      videoId: "example"
    },
    state: "live",
    title: "Lo-fi Night",
    updatedAt: "2026-07-23T00:00:00.000Z",
    visibility: "public",
    ...overrides
  };
}

describe("Wave 06 shared RoomCard", () => {
  it("renders the real room, host, category, live and participant fields with one accessible entry target", () => {
    const html = renderToStaticMarkup(<RoomCard onNavigate={() => undefined} room={roomFixture()} />);

    expect(html).toContain('class="room-card"');
    expect(html).toContain("Lo-fi Night");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Music");
    expect(html).toContain("Live");
    expect(html).toContain("Nearly full");
    expect(html).toContain("3/12 inside");
    expect(html).toContain(
      'aria-label="Enter Lo-fi Night, hosted by Ada Lovelace. Live Music room with 3 of 12 people inside."'
    );
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it("reserves native 640x360 media space and lets the page owner select image loading priority", () => {
    const lazyHtml = renderToStaticMarkup(<RoomCard onNavigate={() => undefined} room={roomFixture()} />);
    const eagerHtml = renderToStaticMarkup(
      <RoomCard onNavigate={() => undefined} room={roomFixture()} thumbnailLoading="eager" />
    );

    expect(lazyHtml).toContain('data-thumbnail-state="loading"');
    expect(lazyHtml).toContain('loading="lazy"');
    expect(lazyHtml).toContain('decoding="async"');
    expect(lazyHtml).toContain('width="640"');
    expect(lazyHtml).toContain('height="360"');
    expect(lazyHtml).toContain('alt="Lo-fi Night YouTube thumbnail"');
    expect(eagerHtml).toContain('loading="eager"');
  });

  it("uses a neutral media failure state without a broken image when the thumbnail is missing", () => {
    const room = roomFixture({ source: { ...roomFixture().source, thumbnailUrl: null } });
    const html = renderToStaticMarkup(<RoomCard onNavigate={() => undefined} room={room} />);

    expect(html).toContain('data-thumbnail-state="error"');
    expect(html).toContain('aria-label="Thumbnail unavailable for Lo-fi Night"');
    expect(html).toContain("media-placeholder--error");
    expect(html).not.toContain("<img");
  });

  it("does not expose private or ended rooms through the shared public/live card", () => {
    const privateHtml = renderToStaticMarkup(
      <RoomCard onNavigate={() => undefined} room={roomFixture({ visibility: "private" })} />
    );
    const endedHtml = renderToStaticMarkup(
      <RoomCard onNavigate={() => undefined} room={roomFixture({ state: "ended" })} />
    );

    expect(privateHtml).toBe("");
    expect(endedHtml).toBe("");
  });

  it("uses the existing Room type and custom-router target without a join mutation or duplicate card model", () => {
    const card = source("src/rooms/RoomCard.tsx");
    const api = source("src/rooms/roomApi.ts");
    const backendRooms = workspaceSource("Vibe backend/src/routes/rooms.ts");

    expect(card).toContain('import type { Room } from "./roomApi"');
    expect(card).toContain("room: Room");
    expect(card).toContain("onNavigate(`/room?roomId=${encodeURIComponent(room.id)}`)");
    expect(card).not.toContain("joinRoom");
    expect(card).not.toMatch(/type RoomCard(Data|Room|Model)/);
    for (const field of ["capacityLabel", "isNearlyFull", "thumbnailAlt", "activeParticipantCount"]) {
      expect(api).toContain(field);
      expect(backendRooms).toContain(field);
    }
  });

  it("migrates only the Discover card render while preserving query, filter, sort and pagination behavior", () => {
    const discover = source("src/pages/DiscoverShellPage.tsx");

    expect(discover).toContain('import { RoomCard } from "../rooms/RoomCard"');
    expect(discover).toContain("<RoomCard key={room.id} onNavigate={onNavigate} room={room} />");
    expect(discover).toContain("listPublicRooms({");
    expect(discover).toContain("categorySlug: categorySlug || undefined");
    expect(discover).toContain("search: deferredSearch");
    expect(discover).toContain("sort");
    expect(discover).toContain("cursor: nextCursor");
    expect(discover).toContain("setRooms((currentRooms) => [...currentRooms, ...result.rooms])");
    expect(discover).not.toContain('className="room-card"');
  });

  it("keeps RoomCard selectors in one shared stylesheet with canonical aura and interaction bounds", () => {
    const tokens = source("src/styles/tokens.css");
    const cardCss = source("src/styles/room-card.css");
    const pagesCss = source("src/styles/pages.css");
    const styles = source("src/styles.css");

    expect(styles).toContain('@import "./styles/room-card.css";');
    expect(tokens).toContain("--room-card-media-aspect-ratio: 16 / 9");
    expect(tokens).toContain("--room-card-aura-blur: 96px");
    expect(tokens).toContain("--room-card-aura-blur-mobile: 80px");
    expect(tokens).toContain("--room-card-aura-opacity: 0.14");
    expect(cardCss).toContain("filter: blur(var(--room-card-aura-blur))");
    expect(cardCss).toContain("clip-path: inset(-1.25rem");
    expect(cardCss).toContain("@media (hover: hover) and (pointer: fine)");
    expect(cardCss).toContain("@media (hover: none)");
    expect(cardCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cardCss).not.toContain("random");
    expect(pagesCss).toContain(".room-card-grid");
    expect(pagesCss.replaceAll(".room-card-grid", "")).not.toMatch(/\.room-card(?:-|\s|,|\{)/);
  });

  it("keeps the Wave 03 skeleton on the same media aspect token and card geometry", () => {
    const feedback = source("src/styles/feedback.css");
    const component = source("src/components/feedback/Feedback.tsx");

    expect(feedback).toContain("aspect-ratio: var(--room-card-media-aspect-ratio)");
    expect(feedback).toContain("border-radius: var(--radius-lg)");
    expect(component).toContain("state-skeleton-card__body");
    expect(component).toContain("state-skeleton-card__identity");
  });

  it("contains no invented popularity, trending, favorite or synthetic aura data", () => {
    const card = source("src/rooms/RoomCard.tsx");

    for (const forbidden of ["popularity", "trending", "favorite", "Math.random", "dominantColor"]) {
      expect(card).not.toContain(forbidden);
    }
  });
});
