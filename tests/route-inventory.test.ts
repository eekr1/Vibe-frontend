import { describe, expect, it } from "vitest";
import { routes } from "../src/lib/routes";

describe("Wave 32 route inventory", () => {
  it("does not expose social or messaging navigation before capability waves", () => {
    const paths = routes.map((route) => route.path);
    expect(paths).not.toContain("/friends");
    expect(paths).not.toContain("/messages");
    expect(paths).not.toContain("/notifications");
  });
});
