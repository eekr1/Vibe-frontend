import type { CurrentUser } from "../auth/AuthContext";
import { apiRequest } from "../lib/api";

export async function getMyProfile() {
  const data = await apiRequest<{ user: CurrentUser }>("/users/me/profile");
  return data.user;
}

export async function updateMyProfile(input: { avatarUrl?: string | null; displayName?: string }) {
  const data = await apiRequest<{ user: CurrentUser }>("/users/me/profile", {
    body: input,
    method: "PATCH"
  });
  return data.user;
}
