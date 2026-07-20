import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ActionFeedback,
  ConnectionBanner,
  EmptyState,
  InlineError,
  InlineLoader,
  MediaPlaceholder,
  MessageSkeleton,
  RoomCardSkeleton,
  SkeletonBlock,
  SkeletonText,
  dedupeToasts,
  type ToastItem
} from "../src/components/feedback";
import { blocksWholeSurface, canRetrySafely, preservesExistingContent } from "../src/components/feedback/stateModel";
import { ApiClientError } from "../src/lib/api";
import { mapErrorToSafeMessage, safeErrorText } from "../src/lib/errorMapping";

const projectRoot = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

function toast(id: string, dedupeKey = id): ToastItem {
  return { createdAt: 1, dedupeKey, durationMs: 3000, id, message: id, type: "info" };
}

describe("Wave 03 state model and context preservation", () => {
  it("separates initial blocking from refresh, local, offline, and reconnect states", () => {
    expect(blocksWholeSurface("initial-loading", "page")).toBe(true);
    expect(blocksWholeSurface("refreshing", "page")).toBe(false);
    expect(blocksWholeSurface("initial-loading", "component")).toBe(false);
    expect(preservesExistingContent("refreshing")).toBe(true);
    expect(preservesExistingContent("loading-more")).toBe(true);
    expect(preservesExistingContent("reconnecting")).toBe(true);
    expect(preservesExistingContent("offline")).toBe(true);
    expect(preservesExistingContent("initial-loading")).toBe(false);
  });

  it("only offers retry for GET or mutations protected by an idempotency key", () => {
    expect(canRetrySafely({ method: "GET" })).toBe(true);
    expect(canRetrySafely({ idempotencyKey: "client-message-1", method: "POST" })).toBe(true);
    expect(canRetrySafely({ method: "POST" })).toBe(false);
    expect(canRetrySafely({ method: "GET", pending: true })).toBe(false);
  });

  it("keeps loaded Discover and Messages content instead of clearing it on refresh failure", () => {
    const discover = source("src/pages/DiscoverShellPage.tsx");
    const messages = source("src/pages/MessagesPage.tsx");
    expect(discover).toContain("const isInitialLoading = isLoading && rooms.length === 0 && !error");
    expect(discover).not.toContain("setRooms([])");
    expect(messages).not.toContain("setConversations([])");
    expect(messages).toContain("silent: true");
  });
});

describe("Wave 03 loading and empty primitives", () => {
  it("hides skeleton geometry from assistive technology", () => {
    const html = renderToStaticMarkup(<><SkeletonBlock /><SkeletonText lines={2} /><RoomCardSkeleton /><MessageSkeleton /></>);
    expect(html.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).not.toContain("fake");
  });

  it("announces functional loading once while keeping decorative motion hidden", () => {
    const html = renderToStaticMarkup(<InlineLoader label="Refreshing connections" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain("Refreshing connections");
  });

  it("reserves stable media space and distinguishes loading from failure", () => {
    const loading = renderToStaticMarkup(<MediaPlaceholder />);
    const failed = renderToStaticMarkup(<MediaPlaceholder label="Thumbnail unavailable" state="error" />);
    expect(loading).toContain('aria-busy="true"');
    expect(failed).toContain('aria-label="Thumbnail unavailable"');
    expect(failed).toContain("media-placeholder--error");
  });

  it("gives no-data and no-results distinct semantic variants without invented content", () => {
    const noData = renderToStaticMarkup(<EmptyState description="Open the first room." title="The hall is quiet right now." />);
    const noResults = renderToStaticMarkup(<EmptyState title="No rooms match your search." variant="no-results" />);
    expect(noData).toContain("state-empty--no-data");
    expect(noData).toContain("aria-labelledby");
    expect(noData).toContain("<h2");
    expect(noResults).toContain("state-empty--no-results");
  });
});

describe("Wave 03 safe errors, retry, and connection feedback", () => {
  it("maps raw backend and database detail to bounded user-safe families", () => {
    const prisma = mapErrorToSafeMessage(new ApiClientError("PrismaClientKnownRequestError P2002 at C:\\server\\db", "P2002"));
    const blocked = mapErrorToSafeMessage(new ApiClientError("Alice blocked Bob", "BLOCKED_BY_USER"));
    const unknown = mapErrorToSafeMessage(new Error("socket close 1006 /internal/path"));
    expect(prisma.category).toBe("conflict");
    expect(prisma.message).not.toMatch(/Prisma|P2002|server|db/i);
    expect(blocked.category).toBe("permission");
    expect(blocked.message).not.toMatch(/Alice|Bob|block/i);
    expect(unknown.message).not.toMatch(/socket|1006|internal/i);
  });

  it("uses contextual fallback only for unknown failures", () => {
    const known = safeErrorText(new ApiClientError("socket detail", "NETWORK_ERROR"), "The room list could not load.");
    const unknown = safeErrorText(new Error("internal detail"), "The room list could not load.");
    expect(known).toBe("Check your connection and try again.");
    expect(unknown).toBe("The room list could not load.");
  });

  it("does not render raw social or Room API and socket messages", () => {
    const relationshipActions = source("src/social/RelationshipActions.tsx");
    const roomInvite = source("src/social/RoomInviteCard.tsx");
    const room = source("src/pages/RoomShellPage.tsx");
    expect(relationshipActions).not.toContain("return error.message");
    expect(roomInvite).not.toContain("return error.message");
    expect(room).not.toContain("setRealtimeError(ack.error.message)");
    expect(room).not.toContain("setRealtimeError(payload.message)");
    expect(room).not.toContain("Room ended: ${payload.reason}");
  });

  it("renders recoverable errors with a named retry control and no raw details", () => {
    const html = renderToStaticMarkup(<InlineError description="Check your connection and try again." onRetry={() => undefined} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Try again");
    expect(html).toContain("ui-button");
  });

  it("separates offline, reconnecting, degraded, and failed presentation", () => {
    const html = ["offline", "reconnecting", "degraded", "failed"]
      .map((kind) => renderToStaticMarkup(<ConnectionBanner kind={kind as "offline" | "reconnecting" | "degraded" | "failed"} />))
      .join(" ");
    expect(html).toContain("You’re offline.");
    expect(html).toContain("Reconnecting…");
    expect(html).toContain("Connection is limited.");
    expect(html).toContain("We could not reconnect.");
  });
});

describe("Wave 03 toast and accessibility contracts", () => {
  it("deduplicates equivalent feedback and caps simultaneous toast density", () => {
    const first = dedupeToasts([], toast("one", "copy"));
    const duplicate = dedupeToasts(first, toast("two", "copy"));
    const capped = [toast("two"), toast("three"), toast("four")].reduce((items, item) => dedupeToasts(items, item), first);
    expect(duplicate).toHaveLength(1);
    expect(capped).toHaveLength(3);
    expect(capped.map((item) => item.id)).toEqual(["two", "three", "four"]);
  });

  it("pairs feedback tone with Phosphor icon markup and readable text", () => {
    const html = renderToStaticMarkup(<ActionFeedback tone="success">Changes saved.</ActionFeedback>);
    expect(html).toContain('role="status"');
    expect(html).toContain("<svg");
    expect(html).toContain("Changes saved.");
  });

  it("mounts one global toast owner and uses a real deduplicated copy action", () => {
    const main = source("src/main.tsx");
    const createRoom = source("src/pages/CreateRoomPage.tsx");
    expect(main.match(/<ToastProvider>/g)).toHaveLength(1);
    expect(createRoom).toContain('dedupeKey: "private-room-invite-copy"');
    expect(createRoom).toContain('type: "success"');
    expect(createRoom).toContain('type: "error"');
  });

  it("keeps motion calm, reduced-motion static, toast safe-area aware, and media at 16:9", () => {
    const css = source("src/styles/feedback.css");
    expect(css).toContain("aspect-ratio: 16 / 9");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation: none");
    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).toContain("z-index: var(--z-critical)");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("uses the shared system across public, member, host, admin, social, and DM surfaces", () => {
    expect(source("src/pages/DiscoverShellPage.tsx")).toContain("<RoomCardSkeleton");
    expect(source("src/pages/FriendsPage.tsx")).toContain("<UserRowSkeleton");
    expect(source("src/pages/RoomShellPage.tsx")).toContain("<InlineLoader");
    expect(source("src/pages/AdminShellPage.tsx")).toContain("<InlineError");
    expect(source("src/social/SocialRail.tsx")).toContain("<ConnectionBanner");
    expect(source("src/social/DirectMessageList.tsx")).toContain("<MessageSkeleton");
  });
});
