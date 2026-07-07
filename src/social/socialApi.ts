import { apiRequest } from "../lib/api";
import type { MemberProfile, RelationshipState } from "../users/profileApi";

type CursorPage<T> = { items: T[]; nextCursor: string | null };
type RequestResult = { state: "friends" | "none" | "outgoing_pending" };
export type FriendPresence = { lastSeen: "earlier" | "recently" | "this_week" | "today" | null; status: "offline" | "online" | "unavailable"; userId: string };
export type NotificationSummary = { actionableCount: number; unreadCount: number };
export type SocialNotification = {
  actionState: "actionable" | "blocked" | "cancelled" | "completed" | "declined" | "expired" | "invalidated" | "none";
  actorUserId: string | null;
  createdAt: string;
  id: string;
  payload: unknown;
  readAt: string | null;
  source: "relationship";
  sourceId: string;
  state: "active" | "terminal";
  terminalAt: string | null;
  terminalReason: string | null;
  type: "friend_request_accepted" | "friend_request_received";
  updatedAt: string;
};

export function getRelationship(targetUserId: string) { return apiRequest<{ relationship: RelationshipState }>(`/social/relationships/${encodeURIComponent(targetUserId)}`); }
export function sendFriendRequest(targetUserId: string) { return apiRequest<RequestResult>("/social/friend-requests", { body: { targetUserId }, method: "POST" }); }
export function cancelFriendRequest(targetUserId: string) { return apiRequest<RequestResult>(`/social/friend-requests/${encodeURIComponent(targetUserId)}/cancel`, { method: "POST" }); }
export function respondToFriendRequest(targetUserId: string, action: "accept" | "decline") { return apiRequest<RequestResult>(`/social/friend-requests/${encodeURIComponent(targetUserId)}/${action}`, { method: "POST" }); }
export function removeFriend(targetUserId: string) { return apiRequest<RequestResult>(`/social/friends/${encodeURIComponent(targetUserId)}`, { method: "DELETE" }); }
export function blockMember(targetUserId: string) { return apiRequest<{ roomIds: string[]; state: "blocked" }>("/social/blocks", { body: { targetUserId }, method: "POST" }); }
export function unblockMember(targetUserId: string) { return apiRequest<RequestResult>(`/social/blocks/${encodeURIComponent(targetUserId)}`, { method: "DELETE" }); }
export function listFriends(cursor?: string) { return apiRequest<CursorPage<MemberProfile>>(`/social/friends${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`); }
export function listFriendRequests(cursor?: string) { return apiRequest<CursorPage<{ createdAt: string; direction: "incoming" | "outgoing"; expiresAt: string; profile: MemberProfile }>>(`/social/friend-requests${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`); }
export function listBlockedMembers(cursor?: string) { return apiRequest<CursorPage<{ blockedAt: string; profile: MemberProfile }>>(`/social/blocks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`); }
export function listPeopleWatched(cursor?: string) { return apiRequest<CursorPage<{ encounteredAt: string; label: "Watched together recently"; profile: MemberProfile }>>(`/social/people-watched${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`); }
export function dismissPeopleWatched(targetUserId: string) { return apiRequest<{ dismissed: true }>(`/social/people-watched/${encodeURIComponent(targetUserId)}/dismiss`, { method: "POST" }); }

export function listNotifications(cursor?: string) { return apiRequest<CursorPage<SocialNotification>>(`/social/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`); }
export function getNotificationSummary() { return apiRequest<NotificationSummary>("/social/notifications/summary"); }
export function markNotificationRead(notificationId: string) { return apiRequest<NotificationSummary>(`/social/notifications/${encodeURIComponent(notificationId)}/read`, { method: "POST" }); }
export function markAllNotificationsRead() { return apiRequest<NotificationSummary>("/social/notifications/read-all", { method: "POST" }); }
export function listFriendPresence() { return apiRequest<{ degraded: boolean; items: FriendPresence[] }>("/social/presence/friends"); }
