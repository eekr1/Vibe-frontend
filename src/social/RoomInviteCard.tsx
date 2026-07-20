import { useState } from "react";
import { ApiClientError } from "../lib/api";
import { safeErrorText } from "../lib/errorMapping";
import {
  acceptRoomInvite,
  declineRoomInvite,
  revokeRoomInvite,
  type RoomInvite
} from "./socialApi";

type InviteAction = "accept" | "decline" | "revoke";

type Props = {
  compact?: boolean;
  invite: RoomInvite;
  onChanged: (invite: RoomInvite) => void;
  onNavigate: (path: string) => void;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function safeRoomTitle(invite: RoomInvite) {
  if (invite.kind === "private" && !["pending", "accepted"].includes(invite.state)) {
    return "Private room";
  }

  return invite.room.title;
}

function terminalCopy(invite: RoomInvite) {
  if (invite.state === "declined") return "Declined";
  if (invite.state === "revoked") return "Revoked";
  if (invite.state === "expired") return "Expired";
  if (invite.state === "invalidated") {
    if (invite.terminalReason === "blocked") return "Unavailable after a block";
    if (invite.terminalReason === "room_ended") return "Room ended";
    if (invite.terminalReason === "room_deleted") return "Room removed";
    if (invite.terminalReason === "room_moderation") return "Room access changed";
    return "Unavailable";
  }
  return null;
}

function roomAvailability(invite: RoomInvite) {
  if (invite.room.state !== "live") return "This room is no longer live.";
  if (invite.room.activeParticipantCount >= invite.room.participantLimit) return "This room is full right now.";
  return null;
}

function describeError(error: unknown) {
  if (!(error instanceof ApiClientError)) return "Invite action could not be completed. Please try again.";
  if (error.code === "ROOM_FULL") return "This room is full right now.";
  if (error.code === "ROOM_NOT_LIVE" || error.code === "ROOM_ENDED") return "This room is no longer live.";
  if (error.code === "ROOM_USER_BANNED") return "Room-level moderation blocks this entry.";
  if (error.code === "LIMIT_REACHED") return "Invite limit reached. Please wait before trying again.";
  if (["FORBIDDEN", "NOT_ALLOWED", "NOT_FOUND", "VALIDATION_FAILED"].includes(error.code)) return "This invite is no longer available. Refresh and try again.";
  return safeErrorText(error, "Invite action could not be completed. Please try again.");
}

export function RoomInviteCard({ compact = false, invite, onChanged, onNavigate }: Props) {
  const [busy, setBusy] = useState<InviteAction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const availability = roomAvailability(invite);
  const terminal = terminalCopy(invite);
  const canEnter = invite.state === "accepted" && invite.room.state === "live";
  const acceptDisabled = Boolean(availability) || busy !== null;

  async function run(action: InviteAction) {
    setBusy(action);
    setFeedback(null);
    try {
      const result = action === "accept"
        ? await acceptRoomInvite(invite.id)
        : action === "decline"
          ? await declineRoomInvite(invite.id)
          : await revokeRoomInvite(invite.id);
      onChanged(result.invite);
      if (action === "accept") {
        setFeedback(result.invite.kind === "private" ? "Private grant accepted. Entering without a password..." : "Invite accepted. Opening the room...");
        onNavigate(`/room?roomId=${encodeURIComponent(result.invite.room.id)}`);
      } else {
        setFeedback(action === "decline" ? "Invite declined." : "Invite revoked.");
      }
    } catch (error) {
      setFeedback(describeError(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className={compact ? "room-invite-card is-compact" : "room-invite-card"}>
      <div className="room-invite-copy">
        <p className="eyebrow">{invite.kind === "private" ? "Private invite" : "Public invite"}</p>
        <h3>{safeRoomTitle(invite)}</h3>
        <p>
          {invite.actions.canAccept
            ? `${invite.inviter.displayName} invited you.`
            : `Invite for ${invite.recipient.displayName}.`}
        </p>
        <p className="room-invite-meta">
          {invite.state === "pending" ? `Expires ${formatDateTime(invite.expiresAt)}` : terminal ?? `Accepted ${invite.acceptedAt ? formatDateTime(invite.acceptedAt) : "recently"}`}
          {invite.kind === "private" && invite.state === "accepted" ? " · Passwordless rejoin while live" : ""}
        </p>
        {availability && invite.state !== "declined" && invite.state !== "revoked" ? <p className="room-invite-warning">{availability}</p> : null}
        {feedback ? <p aria-live="polite" className="relationship-feedback" role="status">{feedback}</p> : null}
      </div>
      <div className="room-invite-actions">
        {invite.actions.canAccept ? (
          <button className="primary-action compact" disabled={acceptDisabled} onClick={() => void run("accept")} type="button">
            {busy === "accept" ? "Accepting..." : invite.kind === "private" ? "Accept private grant" : "Accept & enter"}
          </button>
        ) : null}
        {canEnter ? <button className="secondary-action compact" onClick={() => onNavigate(`/room?roomId=${encodeURIComponent(invite.room.id)}`)} type="button">Enter room</button> : null}
        {invite.actions.canDecline ? <button className="secondary-action compact" disabled={busy !== null} onClick={() => void run("decline")} type="button">{busy === "decline" ? "Declining..." : "Decline"}</button> : null}
        {invite.actions.canRevoke ? <button className="danger-action compact" disabled={busy !== null} onClick={() => void run("revoke")} type="button">{busy === "revoke" ? "Revoking..." : "Revoke"}</button> : null}
      </div>
    </article>
  );
}
