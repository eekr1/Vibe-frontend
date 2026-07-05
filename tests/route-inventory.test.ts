import { describe, expect, it } from "vitest";
import { routes } from "../src/lib/routes";

describe("Wave 32 route inventory", () => {
  it("does not expose social or messaging navigation before capability waves", () => {
    const paths = routes.map((route) => route.path);
    expect(paths).not.toContain("/friends");
    expect(paths).not.toContain("/messages");
    expect(paths).not.toContain("/notifications");
  });

  it("reserves the Wave 34 profile/settings routes without exposing later social routes", () => {
    expect(routes.some((route) => route.path === "/profile")).toBe(true);
    expect(routes.some((route) => route.path === "/settings")).toBe(true);
    expect(routes.find((route) => route.path === "/users/:username")?.match?.("/users/Ada_01")).toBe(true);
    expect(routes.find((route) => route.path === "/users/:username")?.match?.("/users/ada/extra")).toBe(false);
  });
});
