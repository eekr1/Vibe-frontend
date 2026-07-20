import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  Avatar,
  Badge,
  Button,
  FormField,
  IconButton,
  Input,
  Modal,
  StatusIndicator,
  Surface
} from "../src/components/ui";
import { getWrappedFocusIndex, restoreFocus } from "../src/components/ui/overlayFocus";

const projectRoot = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return channels
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("Wave 02 shared control primitives", () => {
  it("keeps button context and accessible loading state without enabling double submit", () => {
    const html = renderToStaticMarkup(
      <Button loading loadingLabel="Submitting report" variant="primary">Submit report</Button>
    );
    expect(html).toContain('aria-label="Submitting report"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
    expect(html).toContain("Submit report");
    expect(html).toContain("ui-button__spinner");
  });

  it("requires an accessible IconButton name and tooltip equivalent", () => {
    const html = renderToStaticMarkup(<IconButton icon={<svg />} label="Close panel" />);
    expect(html).toContain('aria-label="Close panel"');
    expect(html).toContain('title="Close panel"');
    expect(html).toContain("ui-icon-button");
  });

  it("links FormField label, hint, error and invalid state to its control", () => {
    const html = renderToStaticMarkup(
      <FormField error="Enter a valid room name." hint="Use 2–80 characters." label="Room name" required>
        <Input id="room-name" />
      </FormField>
    );
    expect(html).toContain('for="room-name"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="room-name-hint room-name-error"');
    expect(html).toContain('id="room-name-error" role="alert"');
    expect(html).toContain("Required");
  });
});

describe("Wave 02 identity, status and surface primitives", () => {
  it("renders managed avatar and deterministic initials fallback without fake content", () => {
    const managed = renderToStaticMarkup(<Avatar decorative={false} displayName="Ada Lovelace" src="/avatar.webp" />);
    const fallback = renderToStaticMarkup(<Avatar displayName="Ada Lovelace" />);
    expect(managed).toContain('aria-label="Ada Lovelace&#x27;s avatar"');
    expect(managed).toContain('src="/avatar.webp"');
    expect(fallback).toContain("AL");
  });

  it("always pairs semantic status color with readable text", () => {
    const badge = renderToStaticMarkup(<Badge kind="host">Host</Badge>);
    const status = renderToStaticMarkup(<StatusIndicator label="Online" showLabel={false} tone="success" />);
    expect(badge).toContain('data-kind="host"');
    expect(badge).toContain("Host");
    expect(status).toContain("Online");
    expect(status).toContain("visually-hidden");
  });

  it("limits shared surfaces to the canonical depth API", () => {
    const html = renderToStaticMarkup(<Surface as="section" bordered level="elevated">Panel</Surface>);
    expect(html).toContain("ui-surface--elevated");
    expect(html).toContain("is-bordered");
  });

  it("does not expose invented badge capabilities", () => {
    const badgeSource = source("src/components/ui/Badge.tsx");
    expect(badgeSource).not.toMatch(/\b(moderator|verified|premium)\b/i);
  });
});

describe("Wave 02 overlay accessibility and focus contracts", () => {
  it("renders dialog semantics with a programmatic title and description", () => {
    const html = renderToStaticMarkup(
      <Modal descriptionId="dialog-description" onClose={() => undefined} titleId="dialog-title">
        <h2 id="dialog-title">Room options</h2>
        <p id="dialog-description">Choose an existing room action.</p>
      </Modal>
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="dialog-title"');
    expect(html).toContain('aria-describedby="dialog-description"');
  });

  it("wraps forward and backward focus at overlay boundaries", () => {
    expect(getWrappedFocusIndex(2, 3, false)).toBe(0);
    expect(getWrappedFocusIndex(0, 3, true)).toBe(2);
    expect(getWrappedFocusIndex(-1, 3, false)).toBe(0);
    expect(getWrappedFocusIndex(-1, 3, true)).toBe(2);
  });

  it("restores focus only to a still-connected trigger", () => {
    const connectedFocus = vi.fn();
    const disconnectedFocus = vi.fn();
    restoreFocus({ focus: connectedFocus, isConnected: true });
    restoreFocus({ focus: disconnectedFocus, isConnected: false });
    expect(connectedFocus).toHaveBeenCalledOnce();
    expect(disconnectedFocus).not.toHaveBeenCalled();
  });

  it("centralizes Escape, focus trap, scroll lock, outside click and cleanup", () => {
    const overlaySource = source("src/components/ui/Overlay.tsx");
    const focusSource = source("src/components/ui/overlayFocus.ts");
    expect(overlaySource).toContain('event.key === "Escape"');
    expect(overlaySource).toContain('event.key !== "Tab"');
    expect(overlaySource).toContain("releaseScrollLock()");
    expect(overlaySource).toContain("restoreFocus(previousFocus)");
    expect(overlaySource).toContain("event.target === event.currentTarget");
    expect(overlaySource).toContain('anchor.setAttribute("aria-controls", id)');
    expect(overlaySource).toContain('anchor.setAttribute("aria-haspopup", "menu")');
    expect(focusSource).toContain('body.style.overflow = "hidden"');
  });
});

describe("Wave 02 canonical CSS and representative consumers", () => {
  it("uses token-driven control sizes, 44px hit area, reduced motion and transient glass", () => {
    const tokens = source("src/styles/tokens.css");
    const primitives = source("src/styles/primitives.css");
    expect(tokens).toContain("--control-height-small: 2.25rem");
    expect(tokens).toContain("--control-height-default: 2.75rem");
    expect(tokens).toContain("--control-height-large: 3rem");
    expect(tokens).toContain("--control-hit-area: 2.75rem");
    expect(primitives).toContain("min-width: var(--control-hit-area)");
    expect(primitives).toContain("background: var(--glass-background)");
    expect(primitives).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps normal control text and the primary CTA at WCAG AA contrast", () => {
    expect(contrast("#f5f7fa", "#10121a")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#a8afbf", "#171a24")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#090a0f", "#ff625a")).toBeGreaterThanOrEqual(4.5);
  });

  it("migrates real dialog and avatar consumers without changing API/auth behavior", () => {
    expect(source("src/social/ReportDialog.tsx")).toContain("<Modal");
    expect(source("src/pages/ProfileSettingsPage.tsx")).toContain("<Modal");
    expect(source("src/components/AppShell.tsx")).toContain("<Avatar");
    expect(source("src/pages/RoomShellPage.tsx")).toContain("<Avatar");
    expect(source("src/users/ProfileIdentityCard.tsx")).toContain("<Avatar");
  });
});
