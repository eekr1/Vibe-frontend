import { type FormEvent, useEffect, useState } from "react";
import {
  createAdminCategory,
  getAdminPlatformContentDetail,
  getAdminOverview,
  getAdminReportDetail,
  getAdminRoomDetail,
  getAdminUserDetail,
  listAdminCategories,
  listAdminModerationActions,
  listAdminPlatformContent,
  listAdminReports,
  listAdminRooms,
  listAdminUsers,
  publishAdminPlatformContent,
  reviewAdminReport,
  saveAdminPlatformContentDraft,
  updateAdminCategory,
  updateAdminUserRestriction,
  type AdminAccountState,
  type AdminCategory,
  type AdminPlatformContent,
  type AdminPlatformContentDetail,
  type AdminPlatformContentPageKey,
  type AdminReportDetail,
  type AdminModerationAction,
  type AdminOverview,
  type AdminReport,
  type AdminReportStatus,
  type AdminReportTargetType,
  type AdminRoom,
  type AdminRoomDetail,
  type AdminUser,
  type AdminUserDetail
} from "../admin/adminApi";
import { useAuth } from "../auth/AuthContext";
import { AuthRequiredGate } from "../components/AuthRequiredGate";
import { ApiClientError } from "../lib/api";

type AdminShellPageProps = {
  onNavigate: (path: string) => void;
};

type AdminSection = "categories" | "content" | "moderation" | "overview" | "reports" | "rooms" | "users";

const sections: Array<{ id: AdminSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "rooms", label: "Rooms" },
  { id: "reports", label: "Reports" },
  { id: "moderation", label: "Moderation" },
  { id: "categories", label: "Categories" },
  { id: "content", label: "Platform Content" }
];

const reportReviewStatuses: Array<Exclude<AdminReportStatus, "open">> = [
  "reviewed",
  "action_taken",
  "dismissed",
  "escalated"
];

const reportStatusFilters: Array<AdminReportStatus | "all"> = [
  "all",
  "open",
  "reviewed",
  "action_taken",
  "dismissed",
  "escalated"
];

const reportTargetTypeFilters: Array<AdminReportTargetType | "all"> = ["all", "room", "user", "message"];

const accountStates: AdminAccountState[] = ["active", "restricted", "suspended", "banned"];

function describeAdminError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return fallback;
}

function formatDate(value: string | null) {
  if (!value) {
    return "not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function compactId(value: string) {
  return value.slice(0, 8);
}

function includesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search.toLowerCase());
}

export function AdminShellPage({ onNavigate }: AdminShellPageProps) {
  const { currentUser, isCheckingSession } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [categoryIsActive, setCategoryIsActive] = useState(true);
  const [categoryName, setCategoryName] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [categorySortOrder, setCategorySortOrder] = useState(0);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryIsActive, setEditCategoryIsActive] = useState(true);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategorySlug, setEditCategorySlug] = useState("");
  const [editCategorySortOrder, setEditCategorySortOrder] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [moderationActions, setModerationActions] = useState<AdminModerationAction[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [platformContents, setPlatformContents] = useState<AdminPlatformContent[]>([]);
  const [contentDraftBody, setContentDraftBody] = useState("");
  const [contentDraftTitle, setContentDraftTitle] = useState("");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportStatusFilter, setReportStatusFilter] = useState<AdminReportStatus | "all">("all");
  const [reportTargetTypeFilter, setReportTargetTypeFilter] = useState<AdminReportTargetType | "all">("all");
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReportDetail, setSelectedReportDetail] = useState<AdminReportDetail | null>(null);
  const [selectedRoomDetail, setSelectedRoomDetail] = useState<AdminRoomDetail | null>(null);
  const [selectedContentDetail, setSelectedContentDetail] = useState<AdminPlatformContentDetail | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const search = searchTerm.trim();

  async function loadAdminData() {
    setError(null);
    setIsLoading(true);

    try {
      const [nextOverview, nextUsers, nextRooms, nextReports, nextModerationActions, nextCategories, nextContents] =
        await Promise.all([
          getAdminOverview(),
          listAdminUsers(),
          listAdminRooms(),
          listAdminReports(),
          listAdminModerationActions(),
          listAdminCategories(),
          listAdminPlatformContent()
        ]);

      setOverview(nextOverview);
      setUsers(nextUsers.users);
      setRooms(nextRooms.rooms);
      setReports(nextReports.reports);
      setModerationActions(nextModerationActions.actions);
      setCategories(nextCategories.categories);
      setPlatformContents(nextContents.contents);
      setLastLoadedAt(new Date().toISOString());
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Admin data could not be loaded."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser?.role === "admin") {
      void loadAdminData();
    }
  }, [currentUser?.role]);

  async function handleInspectUser(userId: string) {
    setError(null);
    setIsLoadingDetail(`user:${userId}`);

    try {
      const detail = await getAdminUserDetail(userId);
      setSelectedUserDetail(detail);
      setActiveSection("users");
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "User detail could not be loaded."));
    } finally {
      setIsLoadingDetail(null);
    }
  }

  async function handleInspectRoom(roomId: string) {
    setError(null);
    setIsLoadingDetail(`room:${roomId}`);

    try {
      const detail = await getAdminRoomDetail(roomId);
      setSelectedRoomDetail(detail);
      setActiveSection("rooms");
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Room detail could not be loaded."));
    } finally {
      setIsLoadingDetail(null);
    }
  }

  async function handleInspectReport(reportId: string) {
    setError(null);
    setIsLoadingDetail(`report:${reportId}`);

    try {
      const detail = await getAdminReportDetail(reportId);
      setSelectedReportDetail(detail);
      setActiveSection("reports");
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Report detail could not be loaded."));
    } finally {
      setIsLoadingDetail(null);
    }
  }

  async function handleInspectContent(pageKey: AdminPlatformContentPageKey) {
    setError(null);
    setIsLoadingDetail(`content:${pageKey}`);

    try {
      const detail = await getAdminPlatformContentDetail(pageKey);
      setSelectedContentDetail(detail);
      setContentDraftTitle(detail.content.title);
      setContentDraftBody(detail.content.draftBody);
      setActiveSection("content");
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Platform content detail could not be loaded."));
    } finally {
      setIsLoadingDetail(null);
    }
  }

  async function handleReportReview(reportId: string, status: Exclude<AdminReportStatus, "open">) {
    if (!window.confirm(`Mark this report as ${status}? This updates the durable review status.`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsMutating(`report:${reportId}:${status}`);

    try {
      const result = await reviewAdminReport(reportId, status);
      setReports((currentReports) =>
        currentReports.map((report) => (report.id === result.report.id ? result.report : report))
      );
      setSelectedReportDetail((currentDetail) =>
        currentDetail?.report.id === result.report.id ? { ...currentDetail, report: result.report } : currentDetail
      );
      setSuccess(`Report ${compactId(reportId)} marked as ${status}.`);
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Report review update failed."));
    } finally {
      setIsMutating(null);
    }
  }

  async function handleUserRestriction(userId: string, accountState: AdminAccountState) {
    const targetUser =
      users.find((user) => user.id === userId) ??
      (selectedUserDetail?.user.id === userId ? selectedUserDetail.user : undefined);

    if (userId === currentUser?.id && accountState !== "active") {
      setError("You cannot restrict, suspend, or ban your own active admin session.");
      return;
    }

    if (
      targetUser?.role === "admin" &&
      targetUser.accountState === "active" &&
      accountState !== "active" &&
      !window.confirm(`Change admin ${targetUser.displayName} to ${accountState}? Make sure another active admin exists.`)
    ) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsMutating(`user:${userId}`);

    try {
      const result = await updateAdminUserRestriction(userId, accountState);
      setUsers((currentUsers) => currentUsers.map((user) => (user.id === result.user.id ? result.user : user)));
      setSelectedUserDetail((currentDetail) =>
        currentDetail?.user.id === result.user.id ? { ...currentDetail, user: result.user } : currentDetail
      );
      setSuccess(`${result.user.displayName} is now ${result.user.accountState}.`);
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Account state update failed."));
    } finally {
      setIsMutating(null);
    }
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!categoryName.trim()) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsMutating("category:create");

    try {
      const result = await createAdminCategory({
        isActive: categoryIsActive,
        name: categoryName.trim(),
        slug: categorySlug.trim() || undefined,
        sortOrder: categorySortOrder
      });
      setCategories((currentCategories) => [...currentCategories, result.category].sort((left, right) => left.sortOrder - right.sortOrder));
      setCategoryIsActive(true);
      setCategoryName("");
      setCategorySlug("");
      setCategorySortOrder(0);
      setSuccess(`Category ${result.category.name} created.`);
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Category could not be created."));
    } finally {
      setIsMutating(null);
    }
  }

  async function handleToggleCategory(category: AdminCategory) {
    setError(null);
    setSuccess(null);
    setIsMutating(`category:${category.id}`);

    try {
      const result = await updateAdminCategory(category.id, {
        isActive: !category.isActive
      });
      setCategories((currentCategories) =>
        currentCategories.map((nextCategory) => (nextCategory.id === result.category.id ? result.category : nextCategory))
      );
      setSuccess(`${result.category.name} is now ${result.category.isActive ? "active" : "inactive"}.`);
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Category could not be updated."));
    } finally {
      setIsMutating(null);
    }
  }

  function handleStartCategoryEdit(category: AdminCategory) {
    setEditingCategoryId(category.id);
    setEditCategoryIsActive(category.isActive);
    setEditCategoryName(category.name);
    setEditCategorySlug(category.slug);
    setEditCategorySortOrder(category.sortOrder);
    setError(null);
    setSuccess(null);
  }

  function handleCancelCategoryEdit() {
    setEditingCategoryId(null);
    setEditCategoryIsActive(true);
    setEditCategoryName("");
    setEditCategorySlug("");
    setEditCategorySortOrder(0);
  }

  async function handleSaveCategoryEdit(categoryId: string) {
    if (!editCategoryName.trim()) {
      setError("Category name is required.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsMutating(`category:${categoryId}:edit`);

    try {
      const result = await updateAdminCategory(categoryId, {
        isActive: editCategoryIsActive,
        name: editCategoryName.trim(),
        slug: editCategorySlug.trim() || undefined,
        sortOrder: editCategorySortOrder
      });
      setCategories((currentCategories) =>
        currentCategories
          .map((nextCategory) => (nextCategory.id === result.category.id ? result.category : nextCategory))
          .sort((left, right) => left.sortOrder - right.sortOrder)
      );
      handleCancelCategoryEdit();
      setSuccess(`Category ${result.category.name} updated.`);
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Category could not be updated."));
    } finally {
      setIsMutating(null);
    }
  }

  async function handleSaveContentDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedContentDetail) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsMutating(`content:${selectedContentDetail.content.pageKey}:draft`);

    try {
      const detail = await saveAdminPlatformContentDraft(selectedContentDetail.content.pageKey, {
        draftBody: contentDraftBody,
        title: contentDraftTitle
      });
      setSelectedContentDetail(detail);
      setPlatformContents((currentContents) =>
        currentContents.map((content) =>
          content.pageKey === detail.content.pageKey ? detail.content : content
        )
      );
      setSuccess(`${detail.content.title} draft saved. Public page is unchanged until you publish.`);
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Platform content draft could not be saved."));
    } finally {
      setIsMutating(null);
    }
  }

  async function handlePublishContent(pageKey: AdminPlatformContentPageKey) {
    if (!window.confirm("Publish this draft to the public page? Visitors will see the published version immediately.")) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsMutating(`content:${pageKey}:publish`);

    try {
      const detail = await publishAdminPlatformContent(pageKey);
      setSelectedContentDetail(detail);
      setPlatformContents((currentContents) =>
        currentContents.map((content) =>
          content.pageKey === detail.content.pageKey ? detail.content : content
        )
      );
      setSuccess(`${detail.content.title} published.`);
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Platform content could not be published."));
    } finally {
      setIsMutating(null);
    }
  }

  const visibleUsers = users.filter((user) => {
    if (!search) {
      return true;
    }

    return (
      includesSearch(user.displayName, search) ||
      includesSearch(user.email, search) ||
      includesSearch(user.username, search) ||
      includesSearch(user.role, search) ||
      includesSearch(user.accountState, search)
    );
  });
  const visibleRooms = rooms.filter((room) => {
    if (!search) {
      return true;
    }

    return (
      includesSearch(room.title, search) ||
      includesSearch(room.host.displayName, search) ||
      includesSearch(room.category.name, search) ||
      includesSearch(room.state, search) ||
      includesSearch(room.visibility, search)
    );
  });
  const visibleReports = reports
    .filter((report) => {
      if (reportStatusFilter !== "all" && report.status !== reportStatusFilter) {
        return false;
      }

      if (reportTargetTypeFilter !== "all" && report.targetType !== reportTargetTypeFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        includesSearch(report.reason, search) ||
        includesSearch(report.reporter.displayName, search) ||
        includesSearch(report.status, search) ||
        includesSearch(report.targetType, search) ||
        includesSearch(report.targetId, search) ||
        Boolean(report.message?.body && includesSearch(report.message.body, search)) ||
        Boolean(report.room?.title && includesSearch(report.room.title, search)) ||
        Boolean(report.targetUser?.displayName && includesSearch(report.targetUser.displayName, search))
      );
    })
    .sort((left, right) => {
      if (left.status === "open" && right.status !== "open") {
        return -1;
      }

      if (right.status === "open" && left.status !== "open") {
        return 1;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  const visibleModerationActions = moderationActions.filter((action) => {
    if (!search) {
      return true;
    }

    return (
      includesSearch(action.actionType, search) ||
      includesSearch(action.actor.displayName, search) ||
      includesSearch(action.target.displayName, search) ||
      includesSearch(action.room.title, search)
    );
  });
  const visibleCategories = categories.filter((category) => {
    if (!search) {
      return true;
    }

    return includesSearch(category.name, search) || includesSearch(category.slug, search);
  });
  const visiblePlatformContents = platformContents.filter((content) => {
    if (!search) {
      return true;
    }

    return (
      includesSearch(content.title, search) ||
      includesSearch(content.pageKey, search) ||
      includesSearch(content.status, search)
    );
  });
  const visibleOverviewReports = overview?.recent.reports.filter((report) => {
    if (!search) {
      return true;
    }

    return (
      includesSearch(report.reason, search) ||
      includesSearch(report.status, search) ||
      includesSearch(report.targetType, search) ||
      includesSearch(report.reporter.displayName, search)
    );
  }) ?? [];
  const visibleOverviewRooms = overview?.recent.rooms.filter((room) => {
    if (!search) {
      return true;
    }

    return (
      includesSearch(room.title, search) ||
      includesSearch(room.state, search) ||
      includesSearch(room.host.displayName, search) ||
      includesSearch(room.category.name, search)
    );
  }) ?? [];

  if (!isCheckingSession && !currentUser) {
    return (
      <AuthRequiredGate
        onLogin={() => onNavigate(`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`)}
        onSignup={() => onNavigate(`/auth?mode=signup&returnTo=${encodeURIComponent(returnTo)}`)}
      />
    );
  }

  if (isCheckingSession) {
    return (
      <section className="surface-panel wide-panel">
        <div className="inline-loading">
          <span className="loader" />
          Checking admin session
        </div>
      </section>
    );
  }

  if (currentUser?.role !== "admin") {
    return (
      <section className="surface-panel wide-panel">
        <p className="eyebrow">Admin access</p>
        <h2>Admin role required.</h2>
        <p>This panel is reserved for platform operators. Your current role is {currentUser?.role ?? "unknown"}.</p>
      </section>
    );
  }

  return (
    <section className="admin-console">
      <aside className="admin-sidebar">
        <p className="eyebrow">Control center</p>
        <h2>Vibehall Admin</h2>
        <nav aria-label="Admin sections">
          {sections.map((section) => (
            <button
              className={activeSection === section.id ? "admin-nav-item is-active" : "admin-nav-item"}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </nav>
        <div className="admin-debug-card">
          <strong>Debug visibility</strong>
          <span>Loaded: {lastLoadedAt ? formatDate(lastLoadedAt) : "not loaded yet"}</span>
          <span>Users: {users.length}</span>
          <span>Rooms: {rooms.length}</span>
          <span>Reports: {reports.length}</span>
          <span>Actions: {moderationActions.length}</span>
          <span>Content: {platformContents.length}</span>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-toolbar">
          <div>
            <p className="eyebrow">Admin surface</p>
            <h2>{sections.find((section) => section.id === activeSection)?.label}</h2>
          </div>
          <div className="admin-toolbar-actions">
            <input
              aria-label="Search admin data"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search current admin data..."
              value={searchTerm}
            />
            <small>Filters loaded rows as you type. Pressing Enter is not required.</small>
            <button className="secondary-action compact" disabled={isLoading} onClick={() => void loadAdminData()} type="button">
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="state-banner success">{success}</p> : null}
            {search ? (
          <p className="state-banner">
            Filtering loaded admin data for "{search}". Overview results: {visibleOverviewReports.length} reports,{" "}
            {visibleOverviewRooms.length} rooms. Section results: {visibleUsers.length} users, {visibleRooms.length} rooms,{" "}
            {visibleReports.length} reports, {visibleModerationActions.length} actions, {visibleCategories.length} categories,{" "}
            {visiblePlatformContents.length} content pages.
          </p>
        ) : null}

        {activeSection === "overview" && overview ? (
          <div className="admin-section-grid">
            <article className="admin-stat-card">
              <span>Users</span>
              <strong>{overview.overview.users.total}</strong>
              <small>{overview.overview.users.admins} admins | {overview.overview.users.banned} banned</small>
            </article>
            <article className="admin-stat-card">
              <span>Rooms</span>
              <strong>{overview.overview.rooms.total}</strong>
              <small>{overview.overview.rooms.live} live | {overview.overview.rooms.ended} ended</small>
            </article>
            <article className="admin-stat-card">
              <span>Reports</span>
              <strong>{overview.overview.reports.total}</strong>
              <small>{overview.overview.reports.open} open</small>
            </article>
            <article className="admin-stat-card">
              <span>Moderation</span>
              <strong>{overview.overview.moderation.totalActions}</strong>
              <small>{overview.overview.categories.active} active categories</small>
            </article>
          </div>
        ) : null}

        {activeSection === "overview" && overview ? (
          <div className="admin-list-grid">
            <article className="admin-card">
              <h3>Recent reports</h3>
              {visibleOverviewReports.length === 0 ? <p>No recent reports match the current search.</p> : null}
              {visibleOverviewReports.map((report) => (
                <div className="admin-row" key={report.id}>
                  <div>
                    <strong>{report.reason}</strong>
                    <span>{report.targetType} | {report.status}</span>
                  </div>
                  <div className="admin-action-stack">
                    <small>{formatDate(report.createdAt)}</small>
                    <button
                      className="secondary-action compact"
                      disabled={isLoadingDetail === `report:${report.id}`}
                      onClick={() => void handleInspectReport(report.id)}
                      type="button"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              ))}
            </article>
            <article className="admin-card">
              <h3>Recent rooms</h3>
              {visibleOverviewRooms.length === 0 ? <p>No recent rooms match the current search.</p> : null}
              {visibleOverviewRooms.map((room) => (
                <div className="admin-row" key={room.id}>
                  <div>
                    <strong>{room.title}</strong>
                    <span>{room.state} | {room.host.displayName}</span>
                  </div>
                  <div className="admin-action-stack">
                    <small>{room.stats.reports} reports</small>
                    <button
                      className="secondary-action compact"
                      disabled={isLoadingDetail === `room:${room.id}`}
                      onClick={() => void handleInspectRoom(room.id)}
                      type="button"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              ))}
            </article>
          </div>
        ) : null}

        {activeSection === "users" ? (
          <div className="admin-card">
            <h3>Users management</h3>
            {visibleUsers.length === 0 ? <p>No users match the current search.</p> : null}
            {visibleUsers.map((user) => (
              <div className="admin-row" key={user.id}>
                <div>
                  <strong>{user.displayName}</strong>
                  <span>{user.email} | @{user.username} | {user.role}</span>
                  <small>
                    rooms {user.stats.hostedRooms} | reports made {user.stats.reportsMade} | reports received{" "}
                    {user.stats.reportsReceived}
                  </small>
                </div>
                <div className="admin-action-stack">
                  <button
                    className="secondary-action compact"
                    disabled={isLoadingDetail === `user:${user.id}`}
                    onClick={() => void handleInspectUser(user.id)}
                    type="button"
                  >
                    Inspect
                  </button>
                  <select
                    disabled={isMutating === `user:${user.id}`}
                    onChange={(event) => void handleUserRestriction(user.id, event.target.value as AdminAccountState)}
                    value={user.accountState}
                  >
                    {accountStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {selectedUserDetail ? (
              <div className="admin-detail-panel">
                <div className="admin-detail-header">
                  <div>
                    <p className="eyebrow">User detail</p>
                    <h3>{selectedUserDetail.user.displayName}</h3>
                    <p>
                      @{selectedUserDetail.user.username} | {selectedUserDetail.user.email} | {selectedUserDetail.user.role} |{" "}
                      {selectedUserDetail.user.accountState}
                    </p>
                  </div>
                  <button className="secondary-action compact" onClick={() => setSelectedUserDetail(null)} type="button">
                    Close detail
                  </button>
                </div>
                <div className="admin-section-grid">
                  <article className="admin-stat-card">
                    <span>Hosted rooms</span>
                    <strong>{selectedUserDetail.user.stats.hostedRooms}</strong>
                    <small>{selectedUserDetail.history.hostedRooms.length} recent loaded</small>
                  </article>
                  <article className="admin-stat-card">
                    <span>Reports made</span>
                    <strong>{selectedUserDetail.user.stats.reportsMade}</strong>
                    <small>{selectedUserDetail.history.reportsMade.length} recent loaded</small>
                  </article>
                  <article className="admin-stat-card">
                    <span>Reports received</span>
                    <strong>{selectedUserDetail.user.stats.reportsReceived}</strong>
                    <small>{selectedUserDetail.history.reportsReceived.length} recent loaded</small>
                  </article>
                </div>
                <div className="admin-detail-grid">
                  <div>
                    <h4>Recent reports targeting user</h4>
                    {selectedUserDetail.history.reportsReceived.length > 0 ? (
                      selectedUserDetail.history.reportsReceived.map((report) => (
                        <p key={report.id}>{report.reason} | {report.status} | {formatDate(report.createdAt)}</p>
                      ))
                    ) : (
                      <p>No recent targeting reports.</p>
                    )}
                  </div>
                  <div>
                    <h4>Recent moderation received</h4>
                    {selectedUserDetail.history.moderationActionsReceived.length > 0 ? (
                      selectedUserDetail.history.moderationActionsReceived.map((action) => (
                        <p key={action.id}>{action.actionType} in {action.room.title} | {formatDate(action.createdAt)}</p>
                      ))
                    ) : (
                      <p>No recent moderation actions.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeSection === "rooms" ? (
          <div className="admin-card">
            <h3>Rooms management</h3>
            {visibleRooms.length === 0 ? <p>No rooms match the current search.</p> : null}
            {visibleRooms.map((room) => (
              <div className="admin-row" key={room.id}>
                <div>
                  <strong>{room.title}</strong>
                  <span>
                    {room.state} | {room.visibility} | {room.category.name} | host {room.host.displayName}
                  </span>
                  <small>
                    participants {room.stats.participants} | messages {room.stats.messages} | reports {room.stats.reports} |
                    moderation {room.stats.moderationActions}
                  </small>
                </div>
                <div className="admin-action-stack">
                  <small>{room.endedAt ? `ended ${formatDate(room.endedAt)}` : `created ${formatDate(room.createdAt)}`}</small>
                  <button
                    className="secondary-action compact"
                    disabled={isLoadingDetail === `room:${room.id}`}
                    onClick={() => void handleInspectRoom(room.id)}
                    type="button"
                  >
                    Inspect
                  </button>
                </div>
              </div>
            ))}
            {selectedRoomDetail ? (
              <div className="admin-detail-panel">
                <div className="admin-detail-header">
                  <div>
                    <p className="eyebrow">Room detail</p>
                    <h3>{selectedRoomDetail.room.title}</h3>
                    <p>
                      {selectedRoomDetail.room.state} | {selectedRoomDetail.room.visibility} | host{" "}
                      {selectedRoomDetail.room.host.displayName} | {selectedRoomDetail.room.category.name}
                    </p>
                  </div>
                  <button className="secondary-action compact" onClick={() => setSelectedRoomDetail(null)} type="button">
                    Close detail
                  </button>
                </div>
                <div className="admin-section-grid">
                  <article className="admin-stat-card">
                    <span>Participants</span>
                    <strong>{selectedRoomDetail.room.stats.participants}</strong>
                    <small>{selectedRoomDetail.history.participants.length} recent loaded</small>
                  </article>
                  <article className="admin-stat-card">
                    <span>Messages</span>
                    <strong>{selectedRoomDetail.room.stats.messages}</strong>
                    <small>{selectedRoomDetail.history.messages.length} recent loaded</small>
                  </article>
                  <article className="admin-stat-card">
                    <span>Reports</span>
                    <strong>{selectedRoomDetail.room.stats.reports}</strong>
                    <small>{selectedRoomDetail.history.reports.length} recent loaded</small>
                  </article>
                </div>
                <div className="admin-detail-grid">
                  <div>
                    <h4>Recent participants</h4>
                    {selectedRoomDetail.history.participants.slice(0, 6).map((participant) => (
                      <p key={`${participant.user.id}:${participant.joinedAt}`}>
                        {participant.user.displayName} | {participant.role} | {participant.state}
                      </p>
                    ))}
                  </div>
                  <div>
                    <h4>Recent reports</h4>
                    {selectedRoomDetail.history.reports.length > 0 ? (
                      selectedRoomDetail.history.reports.map((report) => (
                        <p key={report.id}>{report.reason} | {report.status} | {formatDate(report.createdAt)}</p>
                      ))
                    ) : (
                      <p>No recent room reports.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeSection === "reports" ? (
          <div className="admin-card">
            <h3>Reports review</h3>
            <div className="admin-filter-row">
              <label>
                Status
                <select
                  onChange={(event) => setReportStatusFilter(event.target.value as AdminReportStatus | "all")}
                  value={reportStatusFilter}
                >
                  {reportStatusFilters.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Target
                <select
                  onChange={(event) => setReportTargetTypeFilter(event.target.value as AdminReportTargetType | "all")}
                  value={reportTargetTypeFilter}
                >
                  {reportTargetTypeFilters.map((targetType) => (
                    <option key={targetType} value={targetType}>
                      {targetType}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {visibleReports.length === 0 ? <p>No reports match the current filters.</p> : null}
            {visibleReports.map((report) => (
              <div className="admin-row admin-row-tall" key={report.id}>
                <div>
                  <strong>{report.reason}</strong>
                  <span>
                    {report.targetType} | {report.status} | reporter {report.reporter.displayName}
                  </span>
                  <small>
                    target {compactId(report.targetId)}
                    {report.room ? ` | room ${report.room.title} (${report.room.state})` : ""}
                  </small>
                  {report.details ? <p>{report.details}</p> : null}
                  {report.message ? <p className="admin-quote">"{report.message.body}"</p> : null}
                </div>
                <div className="admin-action-stack">
                  <button
                    className="secondary-action compact"
                    disabled={isLoadingDetail === `report:${report.id}`}
                    onClick={() => void handleInspectReport(report.id)}
                    type="button"
                  >
                    Inspect
                  </button>
                  {reportReviewStatuses.map((status) => (
                    <button
                      className="secondary-action compact"
                      disabled={report.status === status || isMutating === `report:${report.id}:${status}`}
                      key={status}
                      onClick={() => void handleReportReview(report.id, status)}
                      type="button"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {selectedReportDetail ? (
              <div className="admin-detail-panel">
                <div className="admin-detail-header">
                  <div>
                    <p className="eyebrow">Report detail</p>
                    <h3>{selectedReportDetail.report.reason}</h3>
                    <p>
                      {selectedReportDetail.report.targetType} | {selectedReportDetail.report.status} | reporter{" "}
                      {selectedReportDetail.report.reporter.displayName}
                    </p>
                  </div>
                  <button className="secondary-action compact" onClick={() => setSelectedReportDetail(null)} type="button">
                    Close detail
                  </button>
                </div>
                <div className="admin-detail-grid">
                  <div>
                    <h4>Target context</h4>
                    <p>Target id: {selectedReportDetail.report.targetId}</p>
                    {selectedReportDetail.report.targetUser ? (
                      <p>Target user: {selectedReportDetail.report.targetUser.displayName}</p>
                    ) : null}
                    {selectedReportDetail.report.room ? (
                      <p>Room: {selectedReportDetail.report.room.title} ({selectedReportDetail.report.room.state})</p>
                    ) : null}
                    {selectedReportDetail.report.message ? (
                      <p className="admin-quote">"{selectedReportDetail.report.message.body}"</p>
                    ) : null}
                    {selectedReportDetail.report.details ? <p>{selectedReportDetail.report.details}</p> : null}
                  </div>
                  <div>
                    <h4>Related context</h4>
                    <p>Same target reports: {selectedReportDetail.context.relatedReports.length}</p>
                    <p>Same room reports: {selectedReportDetail.context.relatedRoomReports.length}</p>
                    <p>Related moderation actions: {selectedReportDetail.context.relatedModerationActions.length}</p>
                    {selectedReportDetail.context.relatedModerationActions.slice(0, 4).map((action) => (
                      <p key={action.id}>{action.actionType} | {action.target.displayName} | {formatDate(action.createdAt)}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeSection === "moderation" ? (
          <div className="admin-card">
            <h3>Moderation history</h3>
            {visibleModerationActions.length === 0 ? <p>No moderation actions match the current search.</p> : null}
            {visibleModerationActions.map((action) => (
              <div className="admin-row" key={action.id}>
                <div>
                  <strong>{action.actionType}</strong>
                  <span>
                    {action.actor.displayName}
                    {" -> "}
                    {action.target.displayName} | {action.room.title} ({action.room.state})
                  </span>
                  <small>{action.reason ?? "No reason stored"}</small>
                </div>
                <small>{formatDate(action.createdAt)}</small>
              </div>
            ))}
          </div>
        ) : null}

        {activeSection === "content" ? (
          <div className="admin-list-grid">
            <article className="admin-card">
              <h3>Platform Content</h3>
              <p>
                Manage the public trust pages from here. Saving a draft does not change the public page; publishing does.
              </p>
              {visiblePlatformContents.length === 0 ? <p>No content pages match the current search.</p> : null}
              {visiblePlatformContents.map((content) => (
                <div className="admin-row" key={content.pageKey}>
                  <div>
                    <strong>{content.title}</strong>
                    <span>
                      {content.pageKey} | {content.status} | published {formatDate(content.publishedAt)}
                    </span>
                    <small>
                      Last editor {content.lastEditor?.displayName ?? "not set"} | last publisher{" "}
                      {content.lastPublisher?.displayName ?? "not set"}
                    </small>
                  </div>
                  <div className="admin-action-stack">
                    <button
                      className="secondary-action compact"
                      disabled={isLoadingDetail === `content:${content.pageKey}`}
                      onClick={() => void handleInspectContent(content.pageKey)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="primary-action compact"
                      disabled={isMutating === `content:${content.pageKey}:publish`}
                      onClick={() => void handlePublishContent(content.pageKey)}
                      type="button"
                    >
                      Publish draft
                    </button>
                  </div>
                </div>
              ))}
            </article>

            {selectedContentDetail ? (
              <article className="admin-card">
                <div className="admin-detail-header">
                  <div>
                    <p className="eyebrow">Content editor</p>
                    <h3>{selectedContentDetail.content.title}</h3>
                    <p>
                      Draft updated {formatDate(selectedContentDetail.content.draftUpdatedAt)} | Published{" "}
                      {formatDate(selectedContentDetail.content.publishedAt)}
                    </p>
                  </div>
                  <button className="secondary-action compact" onClick={() => setSelectedContentDetail(null)} type="button">
                    Close editor
                  </button>
                </div>

                <form className="admin-edit-panel" onSubmit={handleSaveContentDraft}>
                  <label>
                    Title
                    <input
                      onChange={(event) => setContentDraftTitle(event.target.value)}
                      required
                      value={contentDraftTitle}
                    />
                  </label>
                  <label>
                    Draft body
                    <textarea
                      onChange={(event) => setContentDraftBody(event.target.value)}
                      required
                      rows={10}
                      value={contentDraftBody}
                    />
                  </label>
                  <div className="admin-action-stack horizontal-actions">
                    <button
                      className="secondary-action compact"
                      disabled={isMutating === `content:${selectedContentDetail.content.pageKey}:draft`}
                      type="submit"
                    >
                      Save draft
                    </button>
                    <button
                      className="primary-action compact"
                      disabled={isMutating === `content:${selectedContentDetail.content.pageKey}:publish`}
                      onClick={() => void handlePublishContent(selectedContentDetail.content.pageKey)}
                      type="button"
                    >
                      Publish draft
                    </button>
                  </div>
                </form>

                <div className="admin-detail-grid">
                  <div>
                    <h4>Published version</h4>
                    <p>{selectedContentDetail.content.publishedTitle ?? "Not published yet"}</p>
                    <p className="admin-quote">
                      {selectedContentDetail.content.publishedBody ?? "The public page will use fallback copy until this content is published."}
                    </p>
                  </div>
                  <div>
                    <h4>Audit history</h4>
                    {selectedContentDetail.audits.length > 0 ? (
                      selectedContentDetail.audits.map((audit) => (
                        <p key={audit.id}>
                          {audit.actionType} by {audit.actor.displayName} | {formatDate(audit.createdAt)}
                        </p>
                      ))
                    ) : (
                      <p>No audit events yet.</p>
                    )}
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        ) : null}

        {activeSection === "categories" ? (
          <div className="admin-list-grid">
            <form className="admin-card admin-category-form" onSubmit={handleCreateCategory}>
              <h3>Create category</h3>
              <label>
                Name
                <input onChange={(event) => setCategoryName(event.target.value)} required value={categoryName} />
              </label>
              <label>
                Slug
                <input onChange={(event) => setCategorySlug(event.target.value)} placeholder="optional-slug" value={categorySlug} />
              </label>
              <label>
                Sort order
                <input
                  min={0}
                  onChange={(event) => setCategorySortOrder(Number(event.target.value))}
                  type="number"
                  value={categorySortOrder}
                />
              </label>
              <label className="checkbox-line">
                <input
                  checked={categoryIsActive}
                  onChange={(event) => setCategoryIsActive(event.target.checked)}
                  type="checkbox"
                />
                Active in public category lists
              </label>
              <button className="primary-action" disabled={isMutating === "category:create"} type="submit">
                {isMutating === "category:create" ? "Creating..." : "Create category"}
              </button>
            </form>

            <article className="admin-card">
              <h3>Categories management</h3>
              {visibleCategories.length === 0 ? <p>No categories match the current search.</p> : null}
              {visibleCategories.map((category) => (
                <div className="admin-row" key={category.id}>
                  {editingCategoryId === category.id ? (
                    <div className="admin-edit-panel">
                      <label>
                        Name
                        <input onChange={(event) => setEditCategoryName(event.target.value)} value={editCategoryName} />
                      </label>
                      <label>
                        Slug
                        <input onChange={(event) => setEditCategorySlug(event.target.value)} value={editCategorySlug} />
                      </label>
                      <label>
                        Sort
                        <input
                          min={0}
                          onChange={(event) => setEditCategorySortOrder(Number(event.target.value))}
                          type="number"
                          value={editCategorySortOrder}
                        />
                      </label>
                      <label className="checkbox-line">
                        <input
                          checked={editCategoryIsActive}
                          onChange={(event) => setEditCategoryIsActive(event.target.checked)}
                          type="checkbox"
                        />
                        Active
                      </label>
                      <div className="admin-action-stack">
                        <button
                          className="primary-action compact"
                          disabled={isMutating === `category:${category.id}:edit`}
                          onClick={() => void handleSaveCategoryEdit(category.id)}
                          type="button"
                        >
                          Save
                        </button>
                        <button className="secondary-action compact" onClick={handleCancelCategoryEdit} type="button">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <strong>{category.name}</strong>
                        <span>{category.slug} | sort {category.sortOrder} | rooms {category.roomCount}</span>
                        <small>{category.isActive ? "Active in room creation" : "Hidden from room creation"}</small>
                      </div>
                      <div className="admin-action-stack">
                        <button
                          className="secondary-action compact"
                          onClick={() => handleStartCategoryEdit(category)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className={category.isActive ? "secondary-action compact" : "primary-action compact"}
                          disabled={isMutating === `category:${category.id}`}
                          onClick={() => void handleToggleCategory(category)}
                          type="button"
                        >
                          {category.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </article>
          </div>
        ) : null}

        {isLoading ? (
          <div className="inline-loading">
            <span className="loader" />
            Loading admin data
          </div>
        ) : null}
      </main>
    </section>
  );
}
