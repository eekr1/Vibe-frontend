import { apiRequest } from "../lib/api";
import type { MemberProfile, RelationshipState } from "../users/profileApi";

type CursorPage<T> = { items: T[]; nextCursor: string | null };
type RequestResult = { state: "friends" | "none" | "outgoing_pending" };
export type FriendPresence = { lastSeen: "earlier" | "recently" | "this_week" | "today" | null; status: "offline" | "online" | "unavailable"; userId: string };
export type NotificationSummary = { actionableCount: number; unreadCount: number };
export type RoomInvite = {
  acceptedAt: string | null;
  actions: {
    canAccept: boolean;
    canDecline: boolean;
    canRevoke: boolean;
  };
  createdAt: string;
  expiresAt: string;
  id: string;
  inviter: { displayName: string; id: string; username: string };
  kind: "private" | "public";
  recipient: { displayName: string; id: string; username: string };
  respondedAt: string | null;
  revokedAt: string | null;
  room: {
    activeParticipantCount: number;
    hostUserId: string;
    id: string;
    participantLimit: number;
    state: "deleted" | "ended" | "live";
    title: string;
    visibility: "private" | "public";
  };
  state: "accepted" | "declined" | "expired" | "invalidated" | "pending" | "revoked";
  terminalAt: string | null;
  terminalReason: "account_deleted" | "blocked" | "room_deleted" | "room_ended" | "room_moderation" | null;
  updatedAt: string;
};
export type SocialNotification = {
  actionState: "actionable" | "blocked" | "cancelled" | "completed" | "declined" | "expired" | "invalidated" | "none" | "revoked";
  actorUserId: string | null;
  createdAt: string;
  id: string;
  payload: unknown;
  readAt: string | null;
  source: "relationship" | "room_invite";
  sourceId: string;
  state: "active" | "terminal";
  terminalAt: string | null;
  terminalReason: string | null;
  type: "friend_request_accepted" | "friend_request_received" | "room_invite_received" | "direct_message" | "direct_message_received";
  updatedAt: string;
};

export type DirectMessage = {
  body: string;
  clientMessageId: string;
  conversationId: string;
  createdAt: string;
  id: string;
  linkTokens: Array<{ end: number; start: number; url: string }>;
  senderUserId: string;
  state: "visible" | "deleted";
  updatedAt: string;
};

export type Conversation = {
  cleanupAfter: string | null;
  conversationId: string;
  createdAt: string;
  deletedAt: string | null;
  deliveredThroughMessageId: string | null;
  heldForModeration: boolean;
  lastMessage: DirectMessage | null;
  lastMessageAt: string | null;
  lastOpenedAt: string | null;
  partner: { displayName: string; id: string; username: string };
  readOnly: boolean;
  readThroughMessageId: string | null;
  unreadCount: number;
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
export function listRoomInvites(cursor?: string) { return apiRequest<CursorPage<RoomInvite>>(`/social/room-invites${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`); }
export function getRoomInvite(inviteId: string) { return apiRequest<{ invite: RoomInvite }>(`/social/room-invites/${encodeURIComponent(inviteId)}`); }
export function sendRoomInvite(roomId: string, recipientUserId: string) { return apiRequest<{ invite: RoomInvite }>("/social/room-invites", { body: { recipientUserId, roomId }, method: "POST" }); }
export function acceptRoomInvite(inviteId: string) { return apiRequest<{ invite: RoomInvite }>(`/social/room-invites/${encodeURIComponent(inviteId)}/accept`, { method: "POST" }); }
export function declineRoomInvite(inviteId: string) { return apiRequest<{ invite: RoomInvite }>(`/social/room-invites/${encodeURIComponent(inviteId)}/decline`, { method: "POST" }); }
export function revokeRoomInvite(inviteId: string) { return apiRequest<{ invite: RoomInvite }>(`/social/room-invites/${encodeURIComponent(inviteId)}/revoke`, { method: "POST" }); }

export function listNotifications(cursor?: string) { return apiRequest<CursorPage<SocialNotification>>(`/social/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`); }
export function getNotificationSummary() { return apiRequest<NotificationSummary>("/social/notifications/summary"); }
export function markNotificationRead(notificationId: string) { return apiRequest<NotificationSummary>(`/social/notifications/${encodeURIComponent(notificationId)}/read`, { method: "POST" }); }
export function markAllNotificationsRead() { return apiRequest<NotificationSummary>("/social/notifications/read-all", { method: "POST" }); }
export function listFriendPresence() { return apiRequest<{ degraded: boolean; items: FriendPresence[] }>("/social/presence/friends"); }

export function listDirectMessageConversations() { return apiRequest<Conversation[]>("/social/dm/conversations"); }
export function listDirectMessages(conversationId: string, cursor?: string) { return apiRequest<CursorPage<DirectMessage>>(`/social/dm/conversations/${encodeURIComponent(conversationId)}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`); }
export function sendDirectMessage(body: string, clientMessageId: string, targetUserId: string) { return apiRequest<{ conversationId: string; created: boolean; message: DirectMessage }>("/social/dm/messages", { body: { body, clientMessageId, targetUserId }, method: "POST" }); }
export function markDirectMessagesDelivered(conversationId: string, messageId: string) { return apiRequest<{ advanced: boolean }>(`/social/dm/conversations/${encodeURIComponent(conversationId)}/delivered`, { body: { messageId }, method: "POST" }); }
export function markDirectMessagesRead(conversationId: string, messageId: string) { return apiRequest<{ advanced: boolean }>(`/social/dm/conversations/${encodeURIComponent(conversationId)}/read`, { body: { messageId }, method: "POST" }); }
export function deleteDirectMessageConversationForUser(conversationId: string) { return apiRequest<{ deleted: true }>(`/social/dm/conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE" }); }
