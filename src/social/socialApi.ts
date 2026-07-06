import { apiRequest } from "../lib/api";
import type { MemberProfile, RelationshipState } from "../users/profileApi";

type CursorPage<T> = { items: T[]; nextCursor: string | null };
type RequestResult = { state: "friends" | "none" | "outgoing_pending" };

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
