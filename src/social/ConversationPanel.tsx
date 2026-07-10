import { useCallback, useEffect, useState } from "react";
import type { Conversation } from "./socialApi";
import { deleteDirectMessageConversationForUser, listDirectMessageConversations } from "./socialApi";
import { DirectMessageList } from "./DirectMessageList";
import { DirectMessageComposer } from "./DirectMessageComposer";
import { useDirectMessageRealtime } from "./useDirectMessageRealtime";

type Props = {
  conversationId: string;
  minimized: boolean;
  onClose: () => void;
  onMinimizeToggle: () => void;
  onNavigate: (path: string) => void;
};

export function ConversationPanel({ conversationId, minimized, onClose, onMinimizeToggle, onNavigate }: Props) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConversation = useCallback(async () => {
    try {
      const page = await listDirectMessageConversations();
      const match = page.items.find((item) => item.conversationId === conversationId) ?? null;
      setConversation(match);
      if (!match) onClose();
    } catch {
      // Keep the last visible conversation; transient refresh failures should not close the panel.
    }
  }, [conversationId, onClose]);

  useEffect(() => {
    void refreshConversation();
  }, [refreshConversation]);

  useDirectMessageRealtime({
    onConversationDeleted: (payload) => {
      if (payload.conversationId === conversationId) onClose();
    },
    onMessageCreated: (payload) => {
      if (payload.conversationId === conversationId) void refreshConversation();
    },
    onRefresh: () => { void refreshConversation(); }
  });

  async function deleteConversation() {
    if (!conversation || isDeleting) return;
    const confirmed = window.confirm("Delete this conversation from your view? The other person keeps their copy.");
    if (!confirmed) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteDirectMessageConversationForUser(conversation.conversationId);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Conversation could not be deleted.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (minimized) {
    return (
      <button aria-label={`Open conversation with ${conversation?.partner.displayName || "friend"}`} className="conversation-chip" onClick={onMinimizeToggle} type="button">
        {conversation ? conversation.partner.displayName : "Loading..."}
        {conversation?.unreadCount ? <span className="social-badge">{conversation.unreadCount}</span> : null}
      </button>
    );
  }

  return (
    <aside aria-label={`Conversation with ${conversation?.partner.displayName || "friend"}`} className="conversation-panel">
      <div className="conversation-panel-header">
        <div className="conversation-panel-title">
          <h3>{conversation ? conversation.partner.displayName : "Loading..."}</h3>
          {conversation?.readOnly ? <p className="form-feedback">Read-only</p> : null}
        </div>
        <div className="conversation-panel-actions">
          {conversation ? <button className="text-action compact" disabled={isDeleting} onClick={() => void deleteConversation()} type="button">Delete</button> : null}
          <button aria-label="Minimize conversation" className="text-action compact" onClick={onMinimizeToggle} type="button">Min</button>
          <button aria-label="Close conversation" className="text-action compact" onClick={onClose} type="button">Close</button>
        </div>
      </div>
      {error ? <p className="form-error compact" role="alert">{error}</p> : null}
      <div className="conversation-panel-body">
        {conversation ? (
          <>
            <DirectMessageList conversationId={conversationId} partnerId={conversation.partner.id} readOnly={conversation.readOnly} onNavigate={onNavigate} />
            {!conversation.readOnly ? <DirectMessageComposer conversationId={conversationId} onSent={() => void refreshConversation()} targetUserId={conversation.partner.id} /> : null}
          </>
        ) : (
          <div className="empty-state">Loading conversation...</div>
        )}
      </div>
    </aside>
  );
}