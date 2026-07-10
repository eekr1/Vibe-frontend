import { apiRequest } from "../lib/api";

export type RoomVisibility = "private" | "public";
export type RoomState = "deleted" | "ended" | "live";
export type DiscoverSort = "active" | "nearly-full" | "newest";
export type ModerationActionType = "ban" | "kick";
export type ReportReason =
  | "abusive_behavior"
  | "harassment"
  | "harmful_content"
  | "hate_speech"
  | "impersonation"
  | "inappropriate_room_title"
  | "other"
  | "spam";
export type ReportTargetType = "direct_message" | "message" | "profile" | "room" | "user";

export type RoomCategory = {
  id: string;
  name: string;
  slug: string;
};

export type RoomHost = {
  avatarUrl: string | null;
  displayName: string;
  id: string;
  username: string;
};

export type RoomSource = {
  provider: "youtube";
  thumbnailUrl: string | null;
  title: string | null;
  url: string;
  videoId: string;
};

export type Room = {
  activeParticipantCount: number;
  card?: {
    capacityLabel: string;
    isNearlyFull: boolean;
    searchText: string;
    thumbnailAlt: string;
  };
  category: RoomCategory;
  createdAt: string;
  endedAt: string | null;
  host: RoomHost;
  id: string;
  participantLimit: number;
  slug: string;
  source: RoomSource;
  state: RoomState;
  title: string;
  updatedAt: string;
  visibility: RoomVisibility;
};

export type RoomParticipant = {
  id: string;
  joinedAt: string;
  leftAt: string | null;
  role: "host" | "participant";
  state: "active" | "banned" | "kicked" | "left";
  user: RoomHost;
};

export type RoomMessage = {
  author: RoomHost;
  body: string;
  createdAt: string;
  id: string;
  roomId: string;
  state: "deleted" | "hidden" | "visible";
};

export type ModerationAction = {
  actionType: ModerationActionType;
  actor: RoomHost;
  createdAt: string;
  id: string;
  reason: string | null;
  roomId: string;
  target: RoomHost;
};

export type SafetyReport = {
  createdAt: string;
  details: string | null;
  id: string;
  messageId: string | null;
  reason: ReportReason;
  reporter: RoomHost;
  roomId: string | null;
  status: "action_taken" | "dismissed" | "escalated" | "open" | "reviewed";
  targetId: string;
  targetType: ReportTargetType;
  targetUser: RoomHost | null;
};

export type CreateRoomInput = {
  categoryId: string;
  participantLimit: number;
  privatePassword?: string;
  sourceUrl: string;
  title: string;
  visibility: RoomVisibility;
};

export type RoomAccessStatus = {
  denialReason: null | string;
  requiresAuth: boolean;
  requiresPassword: boolean;
  room: Room;
  status: "allowed" | "denied" | "password_required";
};

export type DiscoverRoomsInput = {
  categorySlug?: string;
  cursor?: string | null;
  limit?: number;
  search?: string;
  sort?: DiscoverSort;
};

export type DiscoverRoomsResult = {
  filters: {
    categoryId: string | null;
    categorySlug: string | null;
    search: string;
    sort: DiscoverSort;
  };
  nextCursor: string | null;
  rooms: Room[];
};

function toQueryString(input: DiscoverRoomsInput) {
  const params = new URLSearchParams();

  if (input.categorySlug) {
    params.set("categorySlug", input.categorySlug);
  }

  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  if (input.search?.trim()) {
    params.set("search", input.search.trim());
  }

  if (input.sort) {
    params.set("sort", input.sort);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listCategories() {
  const data = await apiRequest<{ categories: RoomCategory[] }>("/categories");
  return data.categories;
}

export async function listPublicRooms(input: DiscoverRoomsInput = {}) {
  return apiRequest<DiscoverRoomsResult>(`/discover/rooms${toQueryString(input)}`);
}

export async function createRoom(input: CreateRoomInput) {
  const data = await apiRequest<{ room: Room }>("/rooms", {
    body: input,
    method: "POST"
  });
  return data.room;
}

export async function getRoom(roomId: string) {
  const data = await apiRequest<{ room: Room }>(`/rooms/${roomId}`);
  return data.room;
}

export async function checkRoomAccess(roomId: string) {
  const data = await apiRequest<RoomAccessStatus>(`/rooms/${roomId}/access/check`, {
    method: "POST"
  });
  return data;
}

export async function joinRoom(roomId: string) {
  const data = await apiRequest<{ participant: RoomParticipant; room: Room }>(`/rooms/${roomId}/join`, {
    method: "POST"
  });
  return data;
}

export async function unlockPrivateRoom(roomId: string, password: string) {
  const data = await apiRequest<{ allowed: true; participant: RoomParticipant; room: Room }>(
    `/rooms/${roomId}/access/private-password`,
    {
      body: { password },
      method: "POST"
    }
  );
  return data;
}

export async function listRoomMessages(roomId: string) {
  const data = await apiRequest<{ messages: RoomMessage[]; participant: RoomParticipant }>(
    `/rooms/${roomId}/messages`
  );
  return data;
}

export async function sendRoomMessage(roomId: string, body: string) {
  const data = await apiRequest<{ message: RoomMessage }>(`/rooms/${roomId}/messages`, {
    body: { body },
    method: "POST"
  });
  return data.message;
}

export async function closeRoom(roomId: string) {
  const data = await apiRequest<{ room: Room }>(`/rooms/${roomId}/close`, {
    method: "POST"
  });
  return data.room;
}

export async function leaveRoom(roomId: string) {
  const data = await apiRequest<{
    endedByHost: boolean;
    participant: RoomParticipant | null;
    room: Room;
  }>(`/rooms/${roomId}/leave`, {
    method: "POST"
  });
  return data;
}

export async function applyRoomModerationAction(
  roomId: string,
  input: {
    actionType: ModerationActionType;
    reason?: string;
    targetUserId: string;
  }
) {
  const data = await apiRequest<{ action: ModerationAction }>(`/rooms/${roomId}/moderation/actions`, {
    body: input,
    method: "POST"
  });
  return data.action;
}

export async function submitReport(input: {
  details?: string;
  reason: ReportReason;
  roomId?: string;
  targetId: string;
  targetType: ReportTargetType;
}) {
  const data = await apiRequest<{ report: SafetyReport }>("/reports", {
    body: input,
    method: "POST"
  });
  return data.report;
}
