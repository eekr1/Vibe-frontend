import { type FormEvent, useEffect, useState } from "react";
import {
  createAdminCategory,
  getAdminOverview,
  listAdminCategories,
  listAdminModerationActions,
  listAdminReports,
  listAdminRooms,
  listAdminUsers,
  reviewAdminReport,
  updateAdminCategory,
  updateAdminUserRestriction,
  type AdminAccountState,
  type AdminCategory,
  type AdminModerationAction,
  type AdminOverview,
  type AdminReport,
  type AdminReportStatus,
  type AdminRoom,
  type AdminUser
} from "../admin/adminApi";
import { useAuth } from "../auth/AuthContext";
import { AuthRequiredGate } from "../components/AuthRequiredGate";
import { ApiClientError } from "../lib/api";

type AdminShellPageProps = {
  onNavigate: (path: string) => void;
};

type AdminSection = "categories" | "moderation" | "overview" | "reports" | "rooms" | "users";

const sections: Array<{ id: AdminSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "rooms", label: "Rooms" },
  { id: "reports", label: "Reports" },
  { id: "moderation", label: "Moderation" },
  { id: "categories", label: "Categories" }
];

const reportReviewStatuses: Array<Exclude<AdminReportStatus, "open">> = [
  "reviewed",
  "action_taken",
  "dismissed",
  "escalated"
];

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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [moderationActions, setModerationActions] = useState<AdminModerationAction[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const search = searchTerm.trim();

  async function loadAdminData() {
    setError(null);
    setIsLoading(true);

    try {
      const [nextOverview, nextUsers, nextRooms, nextReports, nextModerationActions, nextCategories] =
        await Promise.all([
          getAdminOverview(),
          listAdminUsers(),
          listAdminRooms(),
          listAdminReports(),
          listAdminModerationActions(),
          listAdminCategories()
        ]);

      setOverview(nextOverview);
      setUsers(nextUsers.users);
      setRooms(nextRooms.rooms);
      setReports(nextReports.reports);
      setModerationActions(nextModerationActions.actions);
      setCategories(nextCategories.categories);
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

  async function handleReportReview(reportId: string, status: Exclude<AdminReportStatus, "open">) {
    setError(null);
    setSuccess(null);
    setIsMutating(`report:${reportId}:${status}`);

    try {
      const result = await reviewAdminReport(reportId, status);
      setReports((currentReports) =>
        currentReports.map((report) => (report.id === result.report.id ? result.report : report))
      );
      setSuccess(`Report ${compactId(reportId)} marked as ${status}.`);
    } catch (caughtError) {
      setError(describeAdminError(caughtError, "Report review update failed."));
    } finally {
      setIsMutating(null);
    }
  }

  async function handleUserRestriction(userId: string, accountState: AdminAccountState) {
    setError(null);
    setSuccess(null);
    setIsMutating(`user:${userId}`);

    try {
      const result = await updateAdminUserRestriction(userId, accountState);
      setUsers((currentUsers) => currentUsers.map((user) => (user.id === result.user.id ? result.user : user)));
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

  const visibleUsers = users.filter((user) => {
    if (!search) {
      return true;
    }

    return (
      includesSearch(user.displayName, search) ||
      includesSearch(user.email, search) ||
      includesSearch(user.username, search)
    );
  });
  const visibleRooms = rooms.filter((room) => {
    if (!search) {
      return true;
    }

    return includesSearch(room.title, search) || includesSearch(room.host.displayName, search);
  });
  const visibleReports = reports.filter((report) => {
    if (!search) {
      return true;
    }

    return (
      includesSearch(report.reason, search) ||
      includesSearch(report.reporter.displayName, search) ||
      includesSearch(report.targetId, search) ||
      Boolean(report.room?.title && includesSearch(report.room.title, search)) ||
      Boolean(report.targetUser?.displayName && includesSearch(report.targetUser.displayName, search))
    );
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
            <button className="secondary-action compact" disabled={isLoading} onClick={() => void loadAdminData()} type="button">
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="state-banner success">{success}</p> : null}

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
              {overview.recent.reports.map((report) => (
                <div className="admin-row" key={report.id}>
                  <div>
                    <strong>{report.reason}</strong>
                    <span>{report.targetType} | {report.status}</span>
                  </div>
                  <small>{formatDate(report.createdAt)}</small>
                </div>
              ))}
            </article>
            <article className="admin-card">
              <h3>Recent rooms</h3>
              {overview.recent.rooms.map((room) => (
                <div className="admin-row" key={room.id}>
                  <div>
                    <strong>{room.title}</strong>
                    <span>{room.state} | {room.host.displayName}</span>
                  </div>
                  <small>{room.stats.reports} reports</small>
                </div>
              ))}
            </article>
          </div>
        ) : null}

        {activeSection === "users" ? (
          <div className="admin-card">
            <h3>Users management</h3>
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
            ))}
          </div>
        ) : null}

        {activeSection === "rooms" ? (
          <div className="admin-card">
            <h3>Rooms management</h3>
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
                <small>{room.endedAt ? `ended ${formatDate(room.endedAt)}` : `created ${formatDate(room.createdAt)}`}</small>
              </div>
            ))}
          </div>
        ) : null}

        {activeSection === "reports" ? (
          <div className="admin-card">
            <h3>Reports review</h3>
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
          </div>
        ) : null}

        {activeSection === "moderation" ? (
          <div className="admin-card">
            <h3>Moderation history</h3>
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
              {visibleCategories.map((category) => (
                <div className="admin-row" key={category.id}>
                  <div>
                    <strong>{category.name}</strong>
                    <span>{category.slug} | sort {category.sortOrder} | rooms {category.roomCount}</span>
                  </div>
                  <button
                    className={category.isActive ? "secondary-action compact" : "primary-action compact"}
                    disabled={isMutating === `category:${category.id}`}
                    onClick={() => void handleToggleCategory(category)}
                    type="button"
                  >
                    {category.isActive ? "Deactivate" : "Activate"}
                  </button>
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
