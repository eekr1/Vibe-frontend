import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiClientError } from "../src/lib/api";
import {
  createAuthModePath,
  createAuthPayload,
  getAuthErrorFeedback,
  readAuthModeFromLocation,
  validateAuthForm,
  type AuthFormValues
} from "../src/pages/AuthPage";
import { routes } from "../src/lib/routes";

const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");
const values = (overrides: Partial<AuthFormValues> = {}): AuthFormValues => ({
  displayName: "", email: "", emailOrUsername: "", password: "",
  resetConfirmPassword: "", resetEmail: "", username: "", ...overrides
});

describe("Wave 09 auth modes and payload contract", () => {
  it("keeps the four existing modes on the two approved routes", () => {
    expect(readAuthModeFromLocation("/auth", "")).toBe("login");
    expect(readAuthModeFromLocation("/auth", "?mode=signup")).toBe("signup");
    expect(readAuthModeFromLocation("/auth", "?mode=forgot")).toBe("forgot");
    expect(readAuthModeFromLocation("/auth/reset", "?token=reset-token")).toBe("reset");
    expect(routes.filter((route) => route.path.startsWith("/auth")).map((route) => route.path))
      .toEqual(["/auth", "/auth/reset"]);
  });

  it("preserves the existing internal return target while switching normal auth modes", () => {
    expect(createAuthModePath("signup", "/create-room"))
      .toBe("/auth?mode=signup&returnTo=%2Fcreate-room");
    expect(createAuthModePath("forgot", "/room?roomId=room-1"))
      .toBe("/auth?mode=forgot&returnTo=%2Froom%3FroomId%3Droom-1");
  });

  it("submits only backend-approved fields and normalizes backend-normalized text", () => {
    const input = values({
      displayName: "  Ada Lovelace  ",
      email: "  ADA@EXAMPLE.COM ",
      emailOrUsername: "  ADA ",
      password: "password-123",
      resetEmail: " RESET@EXAMPLE.COM ",
      username: "  ADA_01 "
    });
    expect(createAuthPayload("login", input)).toEqual({ emailOrUsername: "ADA", password: "password-123" });
    expect(createAuthPayload("signup", input)).toEqual({
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      password: "password-123",
      username: "ada_01"
    });
    expect(createAuthPayload("forgot", input)).toEqual({ email: "reset@example.com" });
    expect(createAuthPayload("reset", input, " token-value ")).toEqual({
      password: "password-123",
      token: "token-value"
    });
  });
});

describe("Wave 09 validation and safe feedback", () => {
  it("matches backend login, signup and reset length and character boundaries", () => {
    expect(validateAuthForm("login", values())).toMatchObject({
      emailOrUsername: expect.any(String),
      password: expect.any(String)
    });
    expect(validateAuthForm("signup", values({
      displayName: "A",
      email: "not-email",
      password: "short",
      username: "a!"
    }))).toEqual({
      displayName: "Display name must be between 2 and 48 characters.",
      email: "Enter a valid email address.",
      password: "Password must be between 8 and 128 characters.",
      username: "Username must be between 3 and 24 characters."
    });
    expect(validateAuthForm("reset", values({
      password: "password-123",
      resetConfirmPassword: "different"
    }), "valid-reset-token")).toEqual({
      resetConfirmPassword: "The new passwords do not match."
    });
  });

  it("keeps password-reset request copy enumeration-safe and reset-token errors explicit", () => {
    const auth = source("src/pages/AuthPage.tsx");
    const backend = source("../Vibe backend/src/routes/auth.ts");
    expect(auth).toContain("if an account exists");
    expect(backend).toContain("If an account exists for that email");
    expect(getAuthErrorFeedback(
      new ApiClientError("raw", "INVALID_RESET_TOKEN"),
      "reset"
    ).message).toContain("invalid, expired, or has already been used");
  });

  it("does not render raw credential or account-state details", () => {
    expect(getAuthErrorFeedback(
      new ApiClientError("Invalid email, username, or password.", "INVALID_CREDENTIALS"),
      "login"
    ).message).toBe("We couldn’t sign you in. Check your details and try again.");
    expect(getAuthErrorFeedback(
      new ApiClientError("This account is suspended.", "ACCOUNT_SUSPENDED"),
      "reset"
    ).message).toBe("This account cannot complete that action right now.");
    expect(getAuthErrorFeedback(new TypeError("fetch failed"), "login").message)
      .toBe("We couldn’t reach Vibehall. Check your connection and try again.");
  });
});

describe("Wave 09 visual, primitive and accessibility boundaries", () => {
  it("consumes shared controls and feedback without Room Gate or fake auth capability", () => {
    const auth = source("src/pages/AuthPage.tsx");
    expect(auth).toContain("Button, FormField, Input");
    expect(auth).toContain("ActionFeedback, InlineError");
    expect(auth).toContain("submitting.current");
    expect(auth).toContain("requestAnimationFrame");
    expect(auth).toContain('"current-password"');
    expect(auth).toContain('"new-password"');
    expect(auth).not.toMatch(/stay signed|google|apple|social login|room preview/i);
  });

  it("uses matte canonical surfaces, responsive touch sizing and reduced-motion handling", () => {
    const forms = source("src/styles/forms.css");
    const responsive = source("src/styles/responsive.css");
    expect(forms).toContain(".auth-page .auth-panel");
    expect(forms).toContain("background: var(--color-surface-elevated)");
    expect(forms).not.toMatch(/\.auth-page \.auth-panel\s*\{[^}]*glass/s);
    expect(forms).toContain("@media (prefers-reduced-motion: reduce)");
    expect(responsive).toContain(".auth-page .ui-button--large");
    expect(responsive).toContain("env(safe-area-inset-bottom)");
  });
});
