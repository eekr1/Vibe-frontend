import { apiRequest } from "../lib/api";

export type AdminAccountState = "active" | "banned" | "restricted" | "suspended";
export type AdminRole = "admin" | "member";
export type AdminRoomState = "deleted" | "ended" | "live";
export type AdminRoomVisibility = "private" | "public";
export type AdminReportStatus = "action_taken" | "dismissed" | "escalated" | "open" | "reviewed";
export type AdminReportTargetType = "message" | "room" | "user";
export type AdminModerationActionType = "ban" | "kick";
export type AdminActionType =
  | "account_banned"
  | "account_restored"
  | "account_restricted"
  | "account_suspended"
  | "message_deleted"
  | "message_hidden"
  | "room_deleted"
  | "room_ended";
export type AdminActionTargetType = "message" | "room" | "user";
export type AdminReportAction =
  | "ban_user"
  | "delete_message"
  | "delete_room"
  | "end_room"
  | "hide_message"
  | "restore_user"
  | "restrict_user"
  | "suspend_user";
export type AdminPlatformContentPageKey = "community-guidelines" | "privacy" | "support" | "terms";
export type AdminPlatformContentStatus = "draft" | "published";
export type AdminPlatformContentAuditAction = "draft_saved" | "published" | "unpublished";

export type AdminUserSummary = {
  avatarUrl: string | null;
  displayName: string;
  id: string;
  username: string;
};

export type AdminUser = AdminUserSummary & {
  accountState: AdminAccountState;
  createdAt: string;
  email: string;
  role: AdminRole;
  stats: {
    hostedRooms: number;
    messages: number;
    moderationActionsAuthored: number;
    moderationActionsReceived: number;
    participations: number;
    reportsMade: number;
    reportsReceived: number;
  };
  updatedAt: string;
};

export type AdminRoom = {
  category: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt: string;
  endedAt: string | null;
  host: AdminUserSummary;
  id: string;
  participantLimit: number;
  slug: string;
  source: {
    provider: string;
    url: string;
    videoId: string;
  };
  state: AdminRoomState;
  stats: {
    messages: number;
    moderationActions: number;
    participants: number;
    reports: number;
  };
  title: string;
  updatedAt: string;
  visibility: AdminRoomVisibility;
};

export type AdminReport = {
  createdAt: string;
  details: string | null;
  id: string;
  message: {
    body: string;
    createdAt: string;
    id: string;
    state: string;
  } | null;
  messageId: string | null;
  reason: string;
  reporter: AdminUserSummary;
  reviewedAt: string | null;
  room: {
    id: string;
    state: string;
    title: string;
  } | null;
  roomId: string | null;
  status: AdminReportStatus;
  targetId: string;
  targetType: AdminReportTargetType;
  targetUser: AdminUserSummary | null;
  updatedAt: string;
};

export type AdminModerationAction = {
  actionType: AdminModerationActionType;
  actor: AdminUserSummary;
  createdAt: string;
  id: string;
  reason: string | null;
  room: {
    id: string;
    state: string;
    title: string;
  };
  roomId: string;
  target: AdminUserSummary;
  targetUserId: string;
};

export type AdminActionLog = {
  actionType: AdminActionType;
  actor: AdminUserSummary;
  createdAt: string;
  id: string;
  metadata: string | null;
  reason: string | null;
  reportId: string | null;
  targetId: string;
  targetType: AdminActionTargetType;
};

export type AdminCategory = {
  createdAt: string;
  id: string;
  isActive: boolean;
  name: string;
  roomCount: number;
  slug: string;
  sortOrder: number;
  updatedAt: string;
};

export type AdminPlatformContent = {
  createdAt: string;
  draftBody: string;
  draftUpdatedAt: string | null;
  id: string;
  lastEditor: AdminUserSummary | null;
  lastPublisher: AdminUserSummary | null;
  pageKey: AdminPlatformContentPageKey;
  publishedAt: string | null;
  publishedBody: string | null;
  publishedTitle: string | null;
  status: AdminPlatformContentStatus;
  title: string;
  updatedAt: string;
};

export type AdminPlatformContentAudit = {
  actionType: AdminPlatformContentAuditAction;
  actor: AdminUserSummary;
  createdAt: string;
  id: string;
  metadata: string | null;
};

export type AdminPlatformContentDetail = {
  audits: AdminPlatformContentAudit[];
  content: AdminPlatformContent;
};

export type AdminOverview = {
  generatedAt: string;
  overview: {
    categories: {
      active: number;
    };
    moderation: {
      totalActions: number;
    };
    adminActions: {
      total: number;
    };
    reports: {
      open: number;
      total: number;
    };
    rooms: {
      ended: number;
      live: number;
      total: number;
    };
    users: {
      active: number;
      admins: number;
      banned: number;
      restricted: number;
      suspended: number;
      total: number;
    };
  };
  recent: {
    adminActions: AdminActionLog[];
    moderationActions: AdminModerationAction[];
    reports: AdminReport[];
    rooms: AdminRoom[];
  };
};

export type AdminUserDetail = {
  history: {
    hostedRooms: AdminRoom[];
    moderationActionsReceived: AdminModerationAction[];
    reportsMade: AdminReport[];
    reportsReceived: AdminReport[];
  };
  user: AdminUser;
};

export type AdminRoomDetail = {
  history: {
    messages: Array<{
      author: AdminUserSummary;
      body: string;
      createdAt: string;
      id: string;
      state: string;
    }>;
    moderationActions: AdminModerationAction[];
    participants: Array<{
      joinedAt: string;
      leftAt: string | null;
      role: "host" | "participant";
      state: "active" | "banned" | "kicked" | "left";
      user: AdminUserSummary;
    }>;
    reports: AdminReport[];
  };
  room: AdminRoom;
};

export type AdminReportDetail = {
  context: {
    relatedAdminActions: AdminActionLog[];
    relatedModerationActions: AdminModerationAction[];
    relatedReports: AdminReport[];
    relatedRoomReports: AdminReport[];
  };
  report: AdminReport;
};

export type AdminReportActionResult = {
  action: AdminActionLog;
  message?: {
    author: AdminUserSummary;
    body: string;
    createdAt: string;
    id: string;
    state: string;
  };
  report: AdminReport;
  room?: AdminRoom;
  user?: AdminUser;
};

export type AdminListResponse<TItem, TFilters = Record<string, unknown>> = {
  filters: TFilters;
  [key: string]: TFilters | TItem[];
};

function toQueryString(input: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  Object.entries(input).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export function getAdminOverview() {
  return apiRequest<AdminOverview>("/admin/overview");
}

export function listAdminUsers(filters: {
  accountState?: AdminAccountState;
  role?: AdminRole;
  search?: string;
} = {}) {
  return apiRequest<{ filters: Record<string, string | null>; users: AdminUser[] }>(
    `/admin/users${toQueryString(filters)}`
  );
}

export function updateAdminUserRestriction(userId: string, accountState: AdminAccountState) {
  return apiRequest<{ user: AdminUser }>(`/admin/users/${userId}/restriction`, {
    body: { accountState },
    method: "PATCH"
  });
}

export function getAdminUserDetail(userId: string) {
  return apiRequest<AdminUserDetail>(`/admin/users/${userId}`);
}

export function listAdminRooms(filters: {
  search?: string;
  state?: AdminRoomState;
  visibility?: AdminRoomVisibility;
} = {}) {
  return apiRequest<{ filters: Record<string, string | null>; rooms: AdminRoom[] }>(
    `/admin/rooms${toQueryString(filters)}`
  );
}

export function getAdminRoomDetail(roomId: string) {
  return apiRequest<AdminRoomDetail>(`/admin/rooms/${roomId}`);
}

export function listAdminReports(filters: {
  search?: string;
  status?: AdminReportStatus;
  targetType?: AdminReportTargetType;
} = {}) {
  return apiRequest<{ filters: Record<string, string | null>; reports: AdminReport[] }>(
    `/admin/reports${toQueryString(filters)}`
  );
}

export function reviewAdminReport(reportId: string, status: Exclude<AdminReportStatus, "open">) {
  return apiRequest<{ report: AdminReport }>(`/admin/reports/${reportId}/review`, {
    body: { status },
    method: "PATCH"
  });
}

export function applyAdminReportAction(
  reportId: string,
  input: {
    action: AdminReportAction;
    reason?: string;
  }
) {
  return apiRequest<AdminReportActionResult>(`/admin/reports/${reportId}/actions`, {
    body: input,
    method: "POST"
  });
}

export function getAdminReportDetail(reportId: string) {
  return apiRequest<AdminReportDetail>(`/admin/reports/${reportId}`);
}

export function listAdminModerationActions(filters: {
  actionType?: AdminModerationActionType;
  search?: string;
} = {}) {
  return apiRequest<{ actions: AdminModerationAction[]; filters: Record<string, string | null> }>(
    `/admin/moderation-actions${toQueryString(filters)}`
  );
}

export function listAdminActionLogs(filters: {
  actionType?: AdminActionType;
  search?: string;
  targetType?: AdminActionTargetType;
} = {}) {
  return apiRequest<{ actions: AdminActionLog[]; filters: Record<string, string | null> }>(
    `/admin/action-logs${toQueryString(filters)}`
  );
}

export function listAdminCategories() {
  return apiRequest<{ categories: AdminCategory[] }>("/admin/categories");
}

export function listAdminPlatformContent() {
  return apiRequest<{ contents: AdminPlatformContent[] }>("/admin/platform-content");
}

export function getAdminPlatformContentDetail(pageKey: AdminPlatformContentPageKey) {
  return apiRequest<AdminPlatformContentDetail>(`/admin/platform-content/${pageKey}`);
}

export function saveAdminPlatformContentDraft(
  pageKey: AdminPlatformContentPageKey,
  input: {
    draftBody: string;
    title: string;
  }
) {
  return apiRequest<AdminPlatformContentDetail>(`/admin/platform-content/${pageKey}/draft`, {
    body: input,
    method: "PATCH"
  });
}

export function publishAdminPlatformContent(pageKey: AdminPlatformContentPageKey) {
  return apiRequest<AdminPlatformContentDetail>(`/admin/platform-content/${pageKey}/publish`, {
    method: "POST"
  });
}

export function createAdminCategory(input: {
  isActive?: boolean;
  name: string;
  slug?: string;
  sortOrder?: number;
}) {
  return apiRequest<{ category: AdminCategory }>("/admin/categories", {
    body: input,
    method: "POST"
  });
}

export function updateAdminCategory(
  categoryId: string,
  input: {
    isActive?: boolean;
    name?: string;
    slug?: string;
    sortOrder?: number;
  }
) {
  return apiRequest<{ category: AdminCategory }>(`/admin/categories/${categoryId}`, {
    body: input,
    method: "PATCH"
  });
}
