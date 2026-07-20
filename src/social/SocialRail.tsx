import { useEffect, useMemo, useRef, useState } from "react";
import { ActionFeedback, ConnectionBanner, EmptyState, InlineError, InlineLoader } from "../components/feedback";
import { ApiClientError } from "../lib/api";
import { safeErrorText } from "../lib/errorMapping";
import { createRoomRealtimeSocket, type RoomRealtimeSocket } from "../rooms/realtimeClient";
import type { MemberProfile, RelationshipState } from "../users/profileApi";
import { RoomInviteCard } from "./RoomInviteCard";
import { SocialIdentity } from "./SocialIdentity";
import {
  getNotificationSummary,
  listFriendPresence,
  listFriendRequests,
  listFriends,
  listRoomInvites,
  listDirectMessageConversations,
  markAllNotificationsRead,
  type FriendPresence,
  type NotificationSummary,
  type RoomInvite,
  type Conversation
} from "./socialApi";

type RequestItem = { createdAt: string; direction: "incoming" | "outgoing"; expiresAt: string; profile: MemberProfile };
type RailStatus = "idle" | "loading" | "ready" | "reconnecting" | "stale" | "error";
type RailTab = "friends" | "messages" | "invites" | "requests";

type Props = {
  mode: "drawer" | "rail";
  onBadgeChange: (summary: NotificationSummary) => void;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onOpenConversation?: (conversationId: string) => void;
  open: boolean;
};

const emptySummary: NotificationSummary = { actionableCount: 0, unreadCount: 0 };

function initialRelationship(state: RelationshipState["state"]): RelationshipState {
  if (state === "incoming_pending") return { actions: ["accept", "decline", "block", "report"], state };
  if (state === "outgoing_pending") return { actions: ["cancel", "block", "report"], state };
  if (state === "friends") return { actions: ["unfriend", "block", "report"], state };
  return { actions: ["send", "block", "report"], state: "none" };
}

function describePresence(presence?: FriendPresence) {
  if (!presence || presence.status === "unavailable") return "Unavailable";
  if (presence.status === "online") return "Online";
  if (!presence.lastSeen) return "Offline";
  if (presence.lastSeen === "recently") return "Last seen recently";
  if (presence.lastSeen === "today") return "Last seen today";
  if (presence.lastSeen === "this_week") return "Last seen this week";
  return "Last seen earlier";
}

function presenceRank(presence?: FriendPresence) {
  if (presence?.status === "online") return 0;
  if (presence?.lastSeen === "recently") return 1;
  if (presence?.lastSeen === "today") return 2;
  if (presence?.lastSeen === "this_week") return 3;
  return 4;
}

function errorMessage(error: unknown) {
  return safeErrorText(error, "Social updates are temporarily unavailable.");
}

function isFeatureDisabled(error: unknown) {
  return error instanceof ApiClientError && error.code === "FEATURE_DISABLED";
}

function activeRoomId() {
  if (window.location.pathname !== "/room") return null;
  return new URLSearchParams(window.location.search).get("roomId");
}

function inviteSortValue(invite: RoomInvite) {
  if (invite.actions.canAccept) return 0;
  if (invite.actions.canRevoke) return 1;
  return 2;
}

export function SocialRail({ mode, onBadgeChange, onClose, onNavigate, onOpenConversation, open }: Props) {
  const [tab, setTab] = useState<RailTab>("friends");
  const [friends, setFriends] = useState<MemberProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [presence, setPresence] = useState<Record<string, FriendPresence>>({});
  const [summary, setSummary] = useState<NotificationSummary>(emptySummary);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<RailStatus>("idle");
  const [degraded, setDegraded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directMessagesAvailable, setDirectMessagesAvailable] = useState(false);
  const [directMessagesError, setDirectMessagesError] = useState<string | null>(null);
  const socketRef = useRef<RoomRealtimeSocket | null>(null);

  const roomInviteContext = activeRoomId();
  const incoming = requests.filter((item) => item.direction === "incoming");
  const outgoing = requests.filter((item) => item.direction === "outgoing");
  const actionableInvites = invites.filter((invite) => invite.state === "pending" && invite.actions.canAccept);
  const visibleInvites = useMemo(() => invites.filter((invite) => invite.state === "pending").sort((left, right) => inviteSortValue(left) - inviteSortValue(right) || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()), [invites]);
  const filteredFriends = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    const sorted = [...friends].sort((left, right) => {
      const rank = presenceRank(presence[left.id]) - presenceRank(presence[right.id]);
      return rank || left.displayName.localeCompare(right.displayName);
    });
    return query ? sorted.filter((profile) => `${profile.displayName} ${profile.username}`.toLocaleLowerCase().includes(query)) : sorted;
  }, [filter, friends, presence]);

  async function refresh(options: { quiet?: boolean } = {}) {
    if (!options.quiet) setStatus((current) => current === "ready" ? "reconnecting" : "loading");
    setError(null);
    setDirectMessagesError(null);
    try {
      const [friendData, requestData, inviteData, presenceData, summaryData] = await Promise.all([
        listFriends(),
        listFriendRequests(),
        listRoomInvites(),
        listFriendPresence(),
        getNotificationSummary()
      ]);
      setFriends(friendData.items);
      setRequests(requestData.items);
      setInvites(inviteData.items);
      setPresence(Object.fromEntries(presenceData.items.map((item) => [item.userId, item])));
      setDegraded(presenceData.degraded);
      setSummary(summaryData);
      onBadgeChange(summaryData);

      try {
        const conversationPage = await listDirectMessageConversations();
        setConversations(conversationPage.items);
        setDirectMessagesAvailable(true);
      } catch (dmError) {
        setConversations([]);
        setDirectMessagesAvailable(false);
        if (!isFeatureDisabled(dmError)) setDirectMessagesError(errorMessage(dmError));
        if (tab === "messages") setTab("friends");
      }

      setStatus("ready");
    } catch (caught) {
      setError(errorMessage(caught));
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open]);

  useEffect(() => {
    const socket = createRoomRealtimeSocket();
    socketRef.current = socket;
    socket.on("connect", () => setStatus((current) => current === "idle" ? "ready" : current));
    socket.on("disconnect", () => setStatus("stale"));
    socket.on("connect_error", () => setStatus("stale"));
    socket.on("presence.friends.snapshot", (payload) => {
      setDegraded(payload.degraded);
      setPresence(Object.fromEntries(payload.items.map((item) => [item.userId, item])));
    });
    socket.on("presence.friend.updated", (payload) => {
      setPresence((current) => ({ ...current, [payload.presence.userId]: payload.presence }));
    });
    socket.on("dm.message.created", () => { void refresh({ quiet: true }); });
    socket.on("dm.read.updated", () => { void refresh({ quiet: true }); });
    socket.on("notification.invalidated", (payload) => {
      setSummary(payload.summary);
      onBadgeChange(payload.summary);
      void refresh({ quiet: true });
    });
    socket.on("relationship.invalidated", () => { void refresh({ quiet: true }); });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  async function markAllRead() {
    try {
      const next = await markAllNotificationsRead();
      setSummary(next);
      onBadgeChange(next);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function replaceInvite(nextInvite: RoomInvite) {
    setInvites((current) => nextInvite.state === "pending"
      ? current.map((invite) => invite.id === nextInvite.id ? nextInvite : invite)
      : current.filter((invite) => invite.id !== nextInvite.id));
    void refresh();
  }

  function navigate(path: string) {
    onNavigate(path);
    onClose();
  }

  return (
    <aside aria-hidden={!open} aria-label="Social Rail" className={`social-rail ${open ? "is-open" : ""} is-${mode}`} id="social-rail">
      <div className="social-rail-panel" role="complementary">
        <div className="social-rail-header">
          <div>
            <p className="eyebrow">Social</p>
            <h2>Friends now</h2>
          </div>
          <button aria-label="Close Social Rail" className="text-action compact" onClick={onClose} type="button">Close</button>
        </div>

        <div className="social-rail-summary" aria-live="polite">
          <span><strong>{summary.unreadCount}</strong> unread</span>
          <span><strong>{Math.max(summary.actionableCount, incoming.length + actionableInvites.length)}</strong> actionable</span>
          <span><strong>{actionableInvites.length}</strong> invites</span>
        </div>

        <div className="social-rail-tabs" role="tablist" aria-label="Social sections">
          <button aria-selected={tab === "friends"} className={tab === "friends" ? "is-active" : ""} onClick={() => setTab("friends")} role="tab" type="button">Friends</button>
          {directMessagesAvailable ? <button aria-selected={tab === "messages"} className={tab === "messages" ? "is-active" : ""} onClick={() => setTab("messages")} role="tab" type="button">Messages</button> : null}
          <button aria-selected={tab === "invites"} className={tab === "invites" ? "is-active" : ""} onClick={() => setTab("invites")} role="tab" type="button">Invites {actionableInvites.length ? `(${actionableInvites.length})` : ""}</button>
          <button aria-selected={tab === "requests"} className={tab === "requests" ? "is-active" : ""} onClick={() => setTab("requests")} role="tab" type="button">Requests {incoming.length ? `(${incoming.length})` : ""}</button>
        </div>

        {status === "loading" ? <InlineLoader label="Loading social updates" /> : null}
        {status === "reconnecting" || status === "stale" ? <ConnectionBanner kind="reconnecting" /> : null}
        {degraded ? <ConnectionBanner kind="degraded" /> : null}
        {error ? <InlineError description={error} onRetry={() => refresh()} /> : null}
        {directMessagesError ? <ActionFeedback tone="warning">Messages are temporarily unavailable; friends, requests, and invites still work.</ActionFeedback> : null}

        {tab === "friends" ? (
          <section className="social-rail-section" aria-label="Friends presence">
            {roomInviteContext ? <p className="social-rail-state">Room invite mode is active. Use Invite on a friend to send this room.</p> : null}
            <label className="friend-filter social-rail-filter">Filter friends<input autoComplete="off" onChange={(event) => setFilter(event.target.value)} placeholder="Name or @username" type="search" value={filter} /></label>
            <div className="social-rail-list">
              {filteredFriends.map((profile) => (
                <article className="social-rail-friend" key={profile.id}>
                  <SocialIdentity context={describePresence(presence[profile.id])} initialRelationship={initialRelationship("friends")} inviteRoomId={roomInviteContext} onChanged={() => void refresh()} onInviteSent={() => void refresh()} onNavigate={navigate} profile={profile} />
                  {directMessagesAvailable ? <button className="secondary-action compact start-dm-button" onClick={() => navigate(`/messages?targetUserId=${encodeURIComponent(profile.id)}`)} type="button">Message</button> : null}
                </article>
              ))}
            </div>
            {status !== "loading" && !filteredFriends.length ? <EmptyState title="No friends to show here right now." /> : null}
          </section>
        ) : tab === "messages" ? (
          <section className="social-rail-section" aria-label="Direct messages">
            <div className="social-rail-request-tools">
              <button className="text-action compact" onClick={() => navigate("/messages")} type="button">Open full page</button>
            </div>
            <div className="social-rail-list">
              {conversations.map((conv) => (
                <button className="conversation-list-item" key={conv.conversationId} onClick={() => onOpenConversation?.(conv.conversationId)} type="button">
                  <div className="conversation-list-meta">
                    <strong>{conv.partner.displayName}</strong>
                    {conv.unreadCount > 0 && <span className="social-badge">{conv.unreadCount}</span>}
                  </div>
                  {conv.lastMessage && (
                    <p className="conversation-list-preview">{conv.lastMessage.senderUserId === conv.partner.id ? "" : "You: "}{conv.lastMessage.body}</p>
                  )}
                </button>
              ))}
            </div>
            {status !== "loading" && !conversations.length ? <EmptyState title="No recent conversations." /> : null}
          </section>
        ) : tab === "invites" ? (
          <section className="social-rail-section" aria-label="Room invites">
            <div className="social-rail-request-tools"><button className="secondary-action compact" onClick={() => void markAllRead()} type="button">Mark all read</button><button className="text-action compact" onClick={() => navigate("/friends?view=invites")} type="button">Open full invites</button></div>
            <div className="social-rail-list room-invite-list">
              {visibleInvites.map((invite) => <RoomInviteCard compact invite={invite} key={invite.id} onChanged={replaceInvite} onNavigate={navigate} />)}
            </div>
            {status !== "loading" && !visibleInvites.length ? <EmptyState title="No room invites right now." /> : null}
          </section>
        ) : (
          <section className="social-rail-section" aria-label="Friend requests">
            <div className="social-rail-request-tools"><button className="secondary-action compact" onClick={() => void markAllRead()} type="button">Mark all read</button><button className="text-action compact" onClick={() => navigate("/friends?view=incoming")} type="button">Open full requests</button></div>
            <div className="social-rail-list">
              {incoming.map((item) => <SocialIdentity context={`Incoming - expires ${new Date(item.expiresAt).toLocaleDateString()}`} initialRelationship={initialRelationship("incoming_pending")} key={`in:${item.profile.id}`} onChanged={() => void refresh()} onNavigate={navigate} profile={item.profile} />)}
              {outgoing.map((item) => <SocialIdentity context={`Outgoing - expires ${new Date(item.expiresAt).toLocaleDateString()}`} initialRelationship={initialRelationship("outgoing_pending")} key={`out:${item.profile.id}`} onChanged={() => void refresh()} onNavigate={navigate} profile={item.profile} />)}
            </div>
            {status !== "loading" && !requests.length ? <EmptyState title="No pending requests right now." /> : null}
          </section>
        )}
      </div>
    </aside>
  );
}
