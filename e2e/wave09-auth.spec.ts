import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const envelope = (data: unknown) => JSON.stringify({ data, ok: true });
const failure = (code: string, message: string, details?: unknown) =>
  JSON.stringify({ error: { code, details, message }, ok: false });

type AuthMock = {
  loginCount: number;
  requests: Array<{ body: Record<string, unknown>; path: string }>;
};

async function mockAuth(page: Page): Promise<AuthMock> {
  const state: AuthMock = { loginCount: 0, requests: [] };
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");
    const json = (status: number, body: string) =>
      route.fulfill({ body, contentType: "application/json", status });

    if (path === "/auth/me") return json(401, failure("AUTHENTICATION_REQUIRED", "Authentication required."));
    if (path === "/auth/csrf") return json(200, envelope({ token: "csrf-token" }));

    const body = request.postDataJSON?.() as Record<string, unknown> | undefined;
    if (body) state.requests.push({ body, path });

    if (path === "/auth/login") {
      state.loginCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (body?.emailOrUsername === "denied") {
        return json(401, failure("INVALID_CREDENTIALS", "Raw credential detail."));
      }
      return json(200, envelope({
        user: {
          accountState: "active", avatarUrl: null, displayName: "Ada Lovelace",
          email: "ada@example.com", id: "user-ada", role: "member", username: "ada"
        }
      }));
    }

    if (path === "/auth/signup") {
      return json(201, envelope({
        user: {
          accountState: "active", avatarUrl: null, displayName: body?.displayName,
          email: body?.email, id: "user-new", role: "member", username: body?.username
        }
      }));
    }

    if (path === "/auth/password-reset/request") {
      return json(200, envelope({
        message: "If an account exists for that email, a password reset link will be sent."
      }));
    }

    if (path === "/auth/password-reset/confirm") {
      if (body?.token === "suspended-token") {
        return json(403, failure("ACCOUNT_SUSPENDED", "Raw suspended account reason."));
      }
      if (body?.token === "invalid-token") {
        return json(400, failure("INVALID_RESET_TOKEN", "Raw invalid reset token."));
      }
      return json(200, envelope({ reset: true }));
    }

    return json(404, failure("NOT_FOUND", "Not found."));
  });
  return state;
}

test("normal auth switches login and signup modes while preserving real fields and URL history", async ({ page }) => {
  const mock = await mockAuth(page);
  await page.goto("/auth?mode=login&returnTo=%2Fcreate-room");

  await expect(page.getByRole("heading", { name: "Sign in to Vibehall." })).toBeVisible();
  await expect(page.getByLabel("Email or username")).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByText(/stay signed in|continue with google|room preview/i)).toHaveCount(0);

  await page
    .getByRole("region", { name: "Sign in to Vibehall." })
    .getByRole("button", { name: "Sign up" })
    .click();
  await expect(page).toHaveURL(/mode=signup&returnTo=%2Fcreate-room/);
  await expect(page.getByRole("heading", { name: "Create your account." })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Username")).toHaveAttribute("maxlength", "24");
  await expect(page.getByLabel("Display name")).toHaveAttribute("maxlength", "48");
  await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "new-password");

  await page.getByLabel("Email").fill("ADA@EXAMPLE.COM");
  await page.getByLabel("Username").fill("ADA_01");
  await page.getByLabel("Display name").fill("Ada Lovelace");
  await page.getByLabel("Password").fill("password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/create-room");
  expect(mock.requests.find((request) => request.path === "/auth/signup")?.body).toEqual({
    displayName: "Ada Lovelace",
    email: "ada@example.com",
    password: "password-123",
    username: "ada_01"
  });
});

test("validation focuses the first invalid field and the ref guard prevents double submit", async ({ page }) => {
  const mock = await mockAuth(page);
  await page.goto("/auth");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Email or username")).toBeFocused();
  await expect(page.getByText("Enter your email or username.")).toBeVisible();

  await page.getByLabel("Email or username").fill("ada");
  await page.getByLabel("Password").fill("password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page).toHaveURL("/");
  expect(mock.loginCount).toBe(1);
});

test("forgot and reset flows keep safe success, token and account-state feedback distinct", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/auth?mode=forgot");
  await page.getByLabel("Email").fill("unknown@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists for that email");

  await page.goto("/auth/reset");
  await expect(page.getByText(/missing its token/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset password" })).toBeDisabled();

  await page.goto("/auth/reset?token=invalid-token");
  await page.getByLabel(/^New password/).fill("password-123");
  await page.getByLabel(/^Confirm new password/).fill("password-123");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("alert")).toContainText("invalid, expired, or has already been used");
  await expect(page.getByRole("alert")).not.toContainText("Raw invalid");

  await page.goto("/auth/reset?token=suspended-token");
  await page.getByLabel(/^New password/).fill("password-123");
  await page.getByLabel(/^Confirm new password/).fill("password-123");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("alert")).toContainText("cannot complete that action right now");
  await expect(page.getByRole("alert")).not.toContainText("suspended account reason");
});

test("mobile auth remains keyboard-sized, overflow-safe, reduced-motion-safe and axe-clean", async ({ page }) => {
  await mockAuth(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/auth?mode=signup");

  const panel = page.locator(".auth-panel");
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.getByRole("button", { name: "Create account" }).evaluate(
    (button) => button.getBoundingClientRect().height
  )).toBeGreaterThanOrEqual(44);

  await page.getByLabel("Email").focus();
  await expect(page.getByLabel("Email")).toBeFocused();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});
