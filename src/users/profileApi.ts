import type { CurrentUser } from "../auth/AuthContext";
import { apiRequest, apiUploadRequest } from "../lib/api";

export type ProfileAvatar =
  | { initials: string; kind: "initials" }
  | { kind: "managed"; urls: { large: string; small: string }; version: string };

export type ProfileViewer = "admin" | "authenticated" | "friend" | "guest" | "owner_preview" | "self";

export type MemberProfile = {
  authenticationRequiredForActions?: boolean;
  avatar: ProfileAvatar;
  bio: string | null;
  displayName: string;
  id: string;
  memberSince: string;
  username: string;
  viewer: ProfileViewer;
};

export type SocialSettings = {
  friendRequestPrivacy: "everyone" | "nobody";
  invitePrivacy: "friends" | "nobody";
  lastSeenPrivacy: "friends" | "nobody";
  onlinePrivacy: "friends" | "nobody";
  updatedAt: string;
};

export type MyProfileData = {
  capabilities: { socialEnabled: boolean };
  profile: MemberProfile;
  settings: SocialSettings;
  user: CurrentUser;
};

export function getMyProfile() {
  return apiRequest<MyProfileData>("/users/me/profile");
}

export function getMemberProfile(username: string) {
  return apiRequest<{ profile: MemberProfile }>(`/users/${encodeURIComponent(username)}/profile`);
}

export function updateMyProfile(input: { bio?: string | null; displayName?: string }) {
  return apiRequest<{ profile: MemberProfile; user: CurrentUser }>("/users/me/profile", { body: input, method: "PATCH" });
}

export function getSocialSettings() {
  return apiRequest<{ settings: SocialSettings }>("/users/me/social-settings");
}

export function updateSocialSettings(input: Partial<Omit<SocialSettings, "updatedAt">>) {
  return apiRequest<{ settings: SocialSettings }>("/users/me/social-settings", { body: input, method: "PATCH" });
}

export function uploadManagedAvatar(input: { cropSize: number; cropX: number; cropY: number; file: File }, onProgress?: (percent: number) => void) {
  const body = new FormData();
  body.append("cropX", String(input.cropX));
  body.append("cropY", String(input.cropY));
  body.append("cropSize", String(input.cropSize));
  body.append("avatar", input.file, input.file.name);
  return apiUploadRequest<{ avatar: ProfileAvatar }>("/users/me/avatar", body, onProgress);
}

export function removeManagedAvatar() {
  return apiRequest<{ avatar: ProfileAvatar }>("/users/me/avatar", { method: "DELETE" });
}

export function requestAccountDeletion(input: { confirmation: "DELETE"; password: string }) {
  return apiRequest<{ deletion: { requestedAt: string | null; state: "requested" | "processing" | "completed" | "failed" } }>("/users/me/account-deletion", { body: input, method: "POST" });
}
