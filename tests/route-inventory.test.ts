import { describe, expect, it } from "vitest";
import { routes } from "../src/lib/routes";

describe("social route inventory", () => {
  it("exposes the approved social surfaces without adding unplanned global discovery", () => {
    const paths = routes.map((route) => route.path);
    expect(paths).toContain("/friends");
    expect(paths).toContain("/messages");
    expect(paths).not.toContain("/notifications");
    expect(paths).not.toContain("/members");
    expect(paths).not.toContain("/feed");
  });

  it("keeps profile and settings routes alongside the friends/messages experience", () => {
    expect(routes.some((route) => route.path === "/profile")).toBe(true);
    expect(routes.some((route) => route.path === "/settings")).toBe(true);
    expect(routes.find((route) => route.path === "/users/:username")?.match?.("/users/Ada_01")).toBe(true);
    expect(routes.find((route) => route.path === "/users/:username")?.match?.("/users/ada/extra")).toBe(false);
  });
});
