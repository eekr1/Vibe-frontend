import { useEffect, useState } from "react";
import type { Conversation } from "./socialApi";
import { DirectMessageList } from "./DirectMessageList";
import { DirectMessageComposer } from "./DirectMessageComposer";
import { listDirectMessageConversations } from "./socialApi";

type Props = {
  conversationId: string;
  minimized: boolean;
  onClose: () => void;
  onMinimizeToggle: () => void;
  onNavigate: (path: string) => void;
};

export function ConversationPanel({ conversationId, minimized, onClose, onMinimizeToggle, onNavigate }: Props) {
  const [conversation, setConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    let active = true;
    listDirectMessageConversations().then((conversations) => {
      const match = conversations.find(c => c.conversationId === conversationId);
      if (match && active) {
        setConversation(match);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [conversationId]);

  if (minimized) {
    return (
      <button className="conversation-chip" onClick={onMinimizeToggle} type="button" aria-label={`Open conversation with ${conversation?.partner.displayName || 'friend'}`}>
        {conversation ? conversation.partner.displayName : "Loading..."}
        {conversation?.unreadCount ? <span className="social-badge">{conversation.unreadCount}</span> : null}
      </button>
    );
  }

  return (
    <aside className="conversation-panel" aria-label={`Conversation with ${conversation?.partner.displayName || 'friend'}`}>
      <div className="conversation-panel-header">
        <div className="conversation-panel-title">
          <h3>{conversation ? conversation.partner.displayName : "Loading..."}</h3>
        </div>
        <div className="conversation-panel-actions">
          <button className="text-action compact" onClick={onMinimizeToggle} type="button" aria-label="Minimize conversation">Min</button>
          <button className="text-action compact" onClick={onClose} type="button" aria-label="Close conversation">Close</button>
        </div>
      </div>
      <div className="conversation-panel-body">
        {conversation ? (
          <>
            <DirectMessageList conversationId={conversationId} partnerId={conversation.partner.id} readOnly={conversation.readOnly} onNavigate={onNavigate} />
            {!conversation.readOnly && <DirectMessageComposer conversationId={conversationId} targetUserId={conversation.partner.id} />}
          </>
        ) : (
          <div className="empty-state">Loading conversation...</div>
        )}
      </div>
    </aside>
  );
}
