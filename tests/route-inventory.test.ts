import { describe, expect, it } from "vitest";
import { routes } from "../src/lib/routes";

describe("social route inventory", () => {
  it("exposes Wave 36 friends without exposing later messaging surfaces", () => {
    const paths = routes.map((route) => route.path);
    expect(paths).toContain("/friends");
    expect(paths).not.toContain("/messages");
    expect(paths).not.toContain("/notifications");
  });

  it("keeps profile and settings routes alongside the friends experience", () => {
    expect(routes.some((route) => route.path === "/profile")).toBe(true);
    expect(routes.some((route) => route.path === "/settings")).toBe(true);
    expect(routes.find((route) => route.path === "/users/:username")?.match?.("/users/Ada_01")).toBe(true);
    expect(routes.find((route) => route.path === "/users/:username")?.match?.("/users/ada/extra")).toBe(false);
  });
});
