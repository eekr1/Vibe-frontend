import { io, type Socket } from "socket.io-client";
import type { CurrentUser } from "../auth/AuthContext";
import type { NotificationSummary, FriendPresence } from "../social/socialApi";
import type { ModerationAction, ModerationActionType, Room, RoomMessage, RoomParticipant } from "./roomApi";

export type PlaybackState = {
  positionSeconds: number;
  sourceTime: string;
  status: "paused" | "playing";
  updatedAt: string;
};

export type PlaybackActionType = "jump_backward" | "jump_forward" | "pause" | "play" | "seek";

export type RealtimeEnvelope<TPayload> = TPayload & {
  eventId: string;
  occurredAt: string;
};

export type RoomStateSnapshot = {
  currentUserRole: "host" | "participant";
  participants: RoomParticipant[];
  playback: PlaybackState;
  room: Room;
};

export type PresenceUpdate = {
  activeParticipantCount: number;
  participants: RoomParticipant[];
  roomId: string;
};

export type RealtimeAck<TData = unknown> =
  | {
      data?: TData;
      ok: true;
      requestId?: string;
    }
  | {
      error: {
        code: string;
        message: string;
      };
      ok: false;
      requestId?: string;
    };

type ServerToClientEvents = {
  "access.feedback": (payload: RealtimeEnvelope<{ code: string; message: string; roomId?: string }>) => void;
  "chat.message.created": (payload: RealtimeEnvelope<{ message: RoomMessage; roomId: string }>) => void;
  "connection.error": (payload: RealtimeEnvelope<{ code: string; message: string }>) => void;
  "connection.ready": (
    payload: RealtimeEnvelope<{ connectedAt: string; socketId: string; user: CurrentUser }>
  ) => void;
  "moderation.action.applied": (
    payload: RealtimeEnvelope<{
      action: ModerationAction;
      actorUserId: string;
      createdAt: string;
      reason: string | null;
      roomId: string;
      targetUserId: string;
    }>
  ) => void;
  "dm.conversation.deleted_for_user": (payload: RealtimeEnvelope<{ cleanupAfter: string | null; conversationId: string; userId: string }>) => void;
  "dm.delivered.updated": (payload: RealtimeEnvelope<{ conversationId: string; messageId: string; userId: string }>) => void;
  "dm.message.created": (payload: RealtimeEnvelope<{ conversationId: string; messageId: string; recipientUserId: string; senderUserId: string }>) => void;
  "dm.read.updated": (payload: RealtimeEnvelope<{ conversationId: string; messageId: string; userId: string }>) => void;
  "notification.invalidated": (payload: RealtimeEnvelope<{ reason: "block" | "friendship" | "notification" | "request" | "unblock"; summary: NotificationSummary }>) => void;
  "playback.state.updated": (
    payload: RealtimeEnvelope<{ playback: PlaybackState; roomId: string; updatedByUserId: string }>
  ) => void;
  "presence.friend.updated": (payload: RealtimeEnvelope<{ presence: FriendPresence; reason: "offline" | "online" | "reconciled" }>) => void;
  "presence.friends.snapshot": (payload: RealtimeEnvelope<{ degraded: boolean; items: FriendPresence[] }>) => void;
  "relationship.invalidated": (payload: RealtimeEnvelope<{ reason: "block" | "friendship" | "request" | "unblock" }>) => void;
  "room.access.revoked": (
    payload: RealtimeEnvelope<{
      actionType: ModerationActionType;
      reason: "user_banned" | "user_kicked";
      roomId: string;
    }>
  ) => void;
  "room.ended": (
    payload: RealtimeEnvelope<{
      endedAt: string;
      endedByUserId: string;
      reason: "host_closed" | "host_left" | "system_cleanup";
      roomId: string;
    }>
  ) => void;
  "room.presence.updated": (payload: RealtimeEnvelope<PresenceUpdate>) => void;
  "room.state.snapshot": (payload: RealtimeEnvelope<RoomStateSnapshot>) => void;
  "room.subscription.closed": (payload: RealtimeEnvelope<{ roomId: string }>) => void;
  "room.subscription.ready": (payload: RealtimeEnvelope<{ roomId: string }>) => void;
  "room.user.joined": (
    payload: RealtimeEnvelope<{ joinedAt: string; roomId: string; user: RoomParticipant["user"] }>
  ) => void;
  "room.user.left": (payload: RealtimeEnvelope<{ leftAt: string; roomId: string; userId: string }>) => void;
};

type ClientToServerEvents = {
  "chat.message.send": (
    payload: { body: string; requestId: string; roomId: string },
    callback: (ack: RealtimeAck<{ message: RoomMessage }>) => void
  ) => void;
  "playback.state.set": (
    payload: {
      actionType?: PlaybackActionType;
      positionSeconds: number;
      requestId: string;
      roomId: string;
      sourceTime?: string;
      status: PlaybackState["status"];
    },
    callback: (ack: RealtimeAck<{ playback: PlaybackState }>) => void
  ) => void;
  "room.subscribe": (
    payload: { requestId: string; roomId: string },
    callback: (ack: RealtimeAck<RoomStateSnapshot>) => void
  ) => void;
  "room.unsubscribe": (
    payload: { requestId: string; roomId: string },
    callback: (ack: RealtimeAck) => void
  ) => void;
};

export type RoomRealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const DEFAULT_REALTIME_URL = "http://localhost:4000/realtime";

export function createRoomRealtimeSocket(): RoomRealtimeSocket {
  return io(import.meta.env.VITE_WS_URL ?? DEFAULT_REALTIME_URL, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    withCredentials: true
  });
}
