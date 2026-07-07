import { useEffect, useRef, useState } from "react";
import { ApiClientError } from "../lib/api";
import { submitReport } from "../rooms/roomApi";
import type { RelationshipAction, RelationshipState } from "../users/profileApi";
import {
  blockMember,
  cancelFriendRequest,
  getRelationship,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
  unblockMember
} from "./socialApi";

type Props = {
  compact?: boolean;
  initialRelationship?: RelationshipState;
  onChanged?: (relationship: RelationshipState) => void;
  reportRoomId?: string;
  showReport?: boolean;
  targetLabel: string;
  targetUserId: string;
};

const labels: Record<RelationshipAction, string> = {
  accept: "Accept",
  block: "Block",
  cancel: "Cancel request",
  decline: "Decline",
  report: "Report",
  send: "Add friend",
  unblock: "Unblock",
  unfriend: "Unfriend"
};

function describeError(error: unknown) {
  if (!(error instanceof ApiClientError)) return "That action could not be completed. Please try again.";
  if (error.code.includes("COOLDOWN")) return "Please wait before sending another request.";
  if (error.code.includes("LIMIT")) return "A friendship limit has been reached. Review pending requests and try again later.";
  if (["ACCOUNT_RESTRICTED", "ACCOUNT_SUSPENDED", "ACCOUNT_BANNED"].includes(error.code)) return "This account cannot use that social action right now.";
  if (["NOT_FOUND", "FORBIDDEN"].includes(error.code)) return "This relationship is no longer available. The latest state has been loaded.";
  return error.message;
}

function confirmation(action: RelationshipAction, label: string) {
  if (action === "unfriend") return `Remove ${label} from your friends? They will not be notified.`;
  if (action === "block") return `Block ${label}? Friendship and pending requests will be removed, and you will not see each other's hosted rooms.`;
  if (action === "unblock") return `Unblock ${label}? Your previous friendship will not be restored.`;
  return null;
}

function nextRelationship(state: "blocked" | "friends" | "none" | "outgoing_pending"): RelationshipState {
  const actions: RelationshipAction[] = state === "blocked" ? ["unblock", "report"] : state === "friends" ? ["unfriend", "block", "report"] : state === "outgoing_pending" ? ["cancel", "block", "report"] : ["send", "block", "report"];
  return { actions, state };
}

export function RelationshipActions({ compact = false, initialRelationship, onChanged, reportRoomId, showReport = true, targetLabel, targetUserId }: Props) {
  const [relationship, setRelationship] = useState<RelationshipState | null>(initialRelationship ?? null);
  const [busy, setBusy] = useState<RelationshipAction | "refresh" | null>(initialRelationship ? null : "refresh");
  const [feedback, setFeedback] = useState<string | null>(null);
  const alive = useRef(true);

  async function refresh() {
    setBusy("refresh");
    try {
      const result = await getRelationship(targetUserId);
      if (!alive.current) return;
      setRelationship(result.relationship);
      onChanged?.(result.relationship);
    } catch (error) {
      if (alive.current) setFeedback(describeError(error));
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  useEffect(() => {
    alive.current = true;
    if (initialRelationship) setRelationship(initialRelationship);
    else void refresh();
    return () => { alive.current = false; };
  }, [targetUserId]);

  async function act(action: RelationshipAction) {
    const prompt = confirmation(action, targetLabel);
    if (prompt && !window.confirm(prompt)) return;
    setBusy(action);
    setFeedback(null);
    try {
      if (action === "report") {
        const details = window.prompt(`Briefly describe why you are reporting ${targetLabel}. This is private to the safety team.`)?.trim();
        if (!details) { setFeedback("Report cancelled. No information was sent."); return; }
        await submitReport({ details, reason: "other", roomId: reportRoomId, targetId: targetUserId, targetType: "user" });
        setFeedback("Report submitted privately. Thank you for helping keep Vibehall safe.");
        return;
      }
      const result = action === "send" ? await sendFriendRequest(targetUserId)
        : action === "cancel" ? await cancelFriendRequest(targetUserId)
        : action === "accept" || action === "decline" ? await respondToFriendRequest(targetUserId, action)
        : action === "unfriend" ? await removeFriend(targetUserId)
        : action === "block" ? await blockMember(targetUserId)
        : await unblockMember(targetUserId);
      const optimistic = nextRelationship(result.state);
      setRelationship(optimistic);
      onChanged?.(optimistic);
      setFeedback(action === "block" ? `${targetLabel} is blocked.` : action === "unblock" ? `${targetLabel} is unblocked. Previous friendship was not restored.` : "Relationship updated.");
      await refresh();
    } catch (error) {
      setFeedback(describeError(error));
      await refresh();
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  if (busy === "refresh" && !relationship) return <span aria-live="polite" className="relationship-status">Loading actions…</span>;
  if (!relationship || relationship.state === "unavailable") return <span className="relationship-status">Social actions unavailable</span>;

  return (
    <div className={compact ? "relationship-control is-compact" : "relationship-control"}>
      <div aria-label={`Relationship actions for ${targetLabel}`} className="relationship-actions">
        {relationship.actions.filter((action) => showReport || action !== "report").map((action) => (
          <button
            className={action === "block" ? "danger-action compact" : action === "send" || action === "accept" ? "primary-action compact" : "secondary-action compact"}
            disabled={busy !== null}
            key={action}
            onClick={() => void act(action)}
            type="button"
          >
            {busy === action ? "Working…" : labels[action]}
          </button>
        ))}
      </div>
      {feedback ? <p aria-live="polite" className="relationship-feedback" role="status">{feedback}</p> : null}
    </div>
  );
}
