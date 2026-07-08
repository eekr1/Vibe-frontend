import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AuthRequiredGate } from "../components/AuthRequiredGate";
import { ApiClientError } from "../lib/api";
import { RoomInviteCard } from "../social/RoomInviteCard";
import {
  dismissPeopleWatched,
  listBlockedMembers,
  listFriendRequests,
  listFriends,
  listPeopleWatched,
  listRoomInvites,
  type RoomInvite
} from "../social/socialApi";
import { SocialIdentity } from "../social/SocialIdentity";
import type { MemberProfile, RelationshipState } from "../users/profileApi";

type View = "blocked" | "friends" | "incoming" | "invites" | "outgoing" | "watched";
type RequestItem = { createdAt: string; direction: "incoming" | "outgoing"; expiresAt: string; profile: MemberProfile };
type BlockedItem = { blockedAt: string; profile: MemberProfile };
type WatchedItem = { encounteredAt: string; label: "Watched together recently"; profile: MemberProfile };

const views: { id: View; label: string }[] = [
  { id: "friends", label: "Friends" },
  { id: "invites", label: "Room invites" },
  { id: "incoming", label: "Incoming requests" },
  { id: "outgoing", label: "Outgoing requests" },
  { id: "watched", label: "People you watched with" },
  { id: "blocked", label: "Blocked accounts" }
];

function errorMessage(error: unknown) { return error instanceof ApiClientError ? error.message : "Your social lists could not be loaded."; }
function initialRelationship(state: RelationshipState["state"]): RelationshipState {
  if (state === "incoming_pending") return { actions: ["accept", "decline", "block", "report"], state };
  if (state === "outgoing_pending") return { actions: ["cancel", "block", "report"], state };
  if (state === "friends") return { actions: ["unfriend", "block", "report"], state };
  if (state === "blocked") return { actions: ["unblock", "report"], state };
  return { actions: ["send", "block", "report"], state: "none" };
}

function inviteRank(invite: RoomInvite) {
  if (invite.state === "pending" && invite.actions.canAccept) return 0;
  if (invite.state === "pending") return 1;
  if (invite.state === "accepted") return 2;
  return 3;
}

export function FriendsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { currentUser, isCheckingSession } = useAuth();
  const requestedView = new URLSearchParams(window.location.search).get("view") as View | null;
  const [view, setView] = useState<View>(views.some((item) => item.id === requestedView) ? requestedView! : "friends");
  const [friends, setFriends] = useState<MemberProfile[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [blocked, setBlocked] = useState<BlockedItem[]>([]);
  const [watched, setWatched] = useState<WatchedItem[]>([]);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cursors, setCursors] = useState<Record<"blocked" | "friends" | "invites" | "requests" | "watched", string | null>>({ blocked: null, friends: null, invites: null, requests: null, watched: null });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([listFriends(), listFriendRequests(), listBlockedMembers(), listPeopleWatched(), listRoomInvites()])
      .then(([friendData, requestData, blockedData, watchedData, inviteData]) => {
        if (!active) return;
        setFriends(friendData.items); setRequests(requestData.items); setBlocked(blockedData.items); setWatched(watchedData.items); setInvites(inviteData.items);
        setCursors({ blocked: blockedData.nextCursor, friends: friendData.nextCursor, invites: inviteData.nextCursor, requests: requestData.nextCursor, watched: watchedData.nextCursor });
      })
      .catch((caught) => { if (active) setError(errorMessage(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser?.id, refreshKey]);

  const visibleFriends = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    return query ? friends.filter((profile) => `${profile.displayName} ${profile.username}`.toLocaleLowerCase().includes(query)) : friends;
  }, [filter, friends]);
  const visibleRequests = requests.filter((item) => item.direction === view);
  const orderedInvites = useMemo(() => [...invites].sort((left, right) => inviteRank(left) - inviteRank(right) || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()), [invites]);
  const activeInvites = orderedInvites.filter((invite) => ["accepted", "pending"].includes(invite.state));
  const recentInviteHistory = orderedInvites.filter((invite) => !["accepted", "pending"].includes(invite.state));

  function changeView(next: View) {
    setView(next); setFilter("");
    const url = next === "friends" ? "/friends" : `/friends?view=${next}`;
    window.history.replaceState({}, "", url);
  }
  function reconcile() { setRefreshKey((current) => current + 1); }
  function replaceInvite(nextInvite: RoomInvite) { setInvites((items) => items.map((item) => item.id === nextInvite.id ? nextInvite : item)); reconcile(); }
  async function loadMore() {
    const key = view === "incoming" || view === "outgoing" ? "requests" : view;
    const cursor = cursors[key];
    if (!cursor) return;
    setLoadingMore(true); setError(null);
    try {
      if (key === "friends") { const result = await listFriends(cursor); setFriends((items) => [...items, ...result.items]); setCursors((value) => ({ ...value, friends: result.nextCursor })); }
      else if (key === "requests") { const result = await listFriendRequests(cursor); setRequests((items) => [...items, ...result.items]); setCursors((value) => ({ ...value, requests: result.nextCursor })); }
      else if (key === "blocked") { const result = await listBlockedMembers(cursor); setBlocked((items) => [...items, ...result.items]); setCursors((value) => ({ ...value, blocked: result.nextCursor })); }
      else if (key === "invites") { const result = await listRoomInvites(cursor); setInvites((items) => [...items, ...result.items]); setCursors((value) => ({ ...value, invites: result.nextCursor })); }
      else { const result = await listPeopleWatched(cursor); setWatched((items) => [...items, ...result.items]); setCursors((value) => ({ ...value, watched: result.nextCursor })); }
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoadingMore(false); }
  }
  async function dismiss(profile: MemberProfile) {
    const previous = watched;
    setWatched((items) => items.filter((item) => item.profile.id !== profile.id));
    try { await dismissPeopleWatched(profile.id); }
    catch (caught) { setWatched(previous); setError(errorMessage(caught)); }
  }

  if (!isCheckingSession && !currentUser) return <AuthRequiredGate body="Friends, requests, reconnections, invites, and blocked accounts are private member tools." onLogin={() => onNavigate("/auth?mode=login&returnTo=%2Ffriends")} onSignup={() => onNavigate("/auth?mode=signup&returnTo=%2Ffriends")} title="Log in to manage your connections." />;
  if (isCheckingSession) return <section className="surface-panel"><div aria-live="polite" className="inline-loading" role="status"><span aria-hidden="true" className="loader" />Checking your account</div></section>;

  const isEmpty = (view === "friends" && visibleFriends.length === 0) || ((view === "incoming" || view === "outgoing") && visibleRequests.length === 0) || (view === "invites" && invites.length === 0) || (view === "watched" && watched.length === 0) || (view === "blocked" && blocked.length === 0);

  return (
    <section className="friends-page">
      <div className="friends-summary surface-panel"><div><p className="eyebrow">Your connections</p><h2>Keep the good rooms going.</h2><p>Manage people you already know, room invites, and recent shared viewing. Vibehall does not provide global member search.</p></div><div className="friends-counts" aria-label="Connection counts"><span><strong>{friends.length}</strong> friends</span><span><strong>{requests.filter((item) => item.direction === "incoming").length}</strong> incoming</span><span><strong>{invites.filter((invite) => invite.state === "pending" && invite.actions.canAccept).length}</strong> invites</span></div></div>
      <nav aria-label="Friends sections" className="friends-tabs">
        {views.map((item) => <button aria-current={view === item.id ? "page" : undefined} className={view === item.id ? "is-active" : ""} key={item.id} onClick={() => changeView(item.id)} type="button">{item.label}</button>)}
      </nav>
      {error ? <div className="form-error" role="alert">{error} <button className="text-action compact" onClick={reconcile} type="button">Try again</button></div> : null}
      {loading ? <div aria-live="polite" className="inline-loading" role="status"><span aria-hidden="true" className="loader" />Refreshing connections</div> : null}

      <section aria-labelledby={`${view}-title`} className="surface-panel friends-list-panel">
        <div className="friends-list-heading"><div><p className="eyebrow">{views.find((item) => item.id === view)?.label}</p><h2 id={`${view}-title`}>{view === "watched" ? "Recent shared viewing" : view === "blocked" ? "People you have blocked" : views.find((item) => item.id === view)?.label}</h2></div><button className="secondary-action compact" disabled={loading} onClick={reconcile} type="button">Refresh</button></div>
        {view === "friends" ? <label className="friend-filter">Filter your friends<span className="field-hint">This only filters people already in your friends list.</span><input autoComplete="off" onChange={(event) => setFilter(event.target.value)} placeholder="Name or @username" type="search" value={filter} /></label> : null}
        <div className={view === "invites" ? "room-invite-list" : "social-identity-list"}>
          {view === "friends" ? visibleFriends.map((profile) => <SocialIdentity initialRelationship={initialRelationship("friends")} key={profile.id} onChanged={reconcile} onNavigate={onNavigate} profile={profile} />) : null}
          {view === "incoming" || view === "outgoing" ? visibleRequests.map((item) => <SocialIdentity context={`Expires ${new Date(item.expiresAt).toLocaleDateString()}`} initialRelationship={initialRelationship(item.direction === "incoming" ? "incoming_pending" : "outgoing_pending")} key={`${item.direction}:${item.profile.id}`} onChanged={reconcile} onNavigate={onNavigate} profile={item.profile} />) : null}
          {view === "invites" ? activeInvites.map((invite) => <RoomInviteCard invite={invite} key={invite.id} onChanged={replaceInvite} onNavigate={onNavigate} />) : null}
          {view === "invites" && recentInviteHistory.length ? <p className="eyebrow">Recent invite history</p> : null}
          {view === "invites" ? recentInviteHistory.map((invite) => <RoomInviteCard invite={invite} key={invite.id} onChanged={replaceInvite} onNavigate={onNavigate} />) : null}
          {view === "watched" ? watched.map((item) => <SocialIdentity context={item.label} initialRelationship={initialRelationship("none")} key={item.profile.id} onChanged={reconcile} onDismiss={() => void dismiss(item.profile)} onNavigate={onNavigate} profile={item.profile} />) : null}
          {view === "blocked" ? blocked.map((item) => <SocialIdentity context={`Blocked ${new Date(item.blockedAt).toLocaleDateString()}`} initialRelationship={initialRelationship("blocked")} key={item.profile.id} onChanged={reconcile} onNavigate={onNavigate} profile={item.profile} />) : null}
        </div>
        {!loading && isEmpty ? <p className="empty-state">{view === "friends" && filter ? "No existing friends match this filter." : "Nothing to show here right now."}</p> : null}
        {cursors[view === "incoming" || view === "outgoing" ? "requests" : view] ? <button className="secondary-action load-more-action" disabled={loadingMore} onClick={() => void loadMore()} type="button">{loadingMore ? "Loading..." : "Load more"}</button> : null}
      </section>
    </section>
  );
}