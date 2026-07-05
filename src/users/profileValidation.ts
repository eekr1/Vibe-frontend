export type ProfileDraft = { bio: string; displayName: string };

export function normalizeProfileText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function validateProfileDraft(draft: ProfileDraft) {
  const displayName = normalizeProfileText(draft.displayName);
  const bio = normalizeProfileText(draft.bio);
  const errors: Partial<Record<keyof ProfileDraft, string>> = {};
  if (displayName.length < 2 || displayName.length > 48) errors.displayName = "Display name must be 2–48 characters.";
  if (bio.length > 160) errors.bio = "Bio must be 160 characters or fewer.";
  if (/[<>]/.test(bio) || /!?\[[^\]]*\]\([^)]*\)/.test(bio) || /(?:https?:\/\/|www\.)\S+/i.test(bio) || /(?:^|\s)(?:#{1,6}\s|[-*>]\s)|(?:\*\*|__|~~|`)/.test(bio)) {
    errors.bio = "Bio must be plain text without HTML, Markdown, or links.";
  }
  return { errors, normalized: { bio: bio || null, displayName }, valid: Object.keys(errors).length === 0 };
}
