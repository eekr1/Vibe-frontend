import { describe, expect, it } from "vitest";
import { normalizeProfileText, validateProfileDraft } from "../src/users/profileValidation";

describe("Wave 34 profile form validation", () => {
  it("normalizes display name and bio before submit", () => {
    expect(validateProfileDraft({ bio: "  Quiet   movie fan ", displayName: " Ada   L. " })).toMatchObject({
      normalized: { bio: "Quiet movie fan", displayName: "Ada L." }, valid: true
    });
  });

  it.each(["<b>hello</b>", "[site](https://example.test)", "https://example.test", "**bold**", "# heading"])("rejects non-plain bio content: %s", (bio) => {
    expect(validateProfileDraft({ bio, displayName: "Ada" }).valid).toBe(false);
  });

  it("enforces normalized display-name and bio length", () => {
    expect(validateProfileDraft({ bio: "", displayName: " a " }).valid).toBe(false);
    expect(validateProfileDraft({ bio: "x".repeat(161), displayName: "Ada" }).valid).toBe(false);
  });

  it("uses Unicode NFKC normalization", () => expect(normalizeProfileText("Ａｄａ")).toBe("Ada"));
});
