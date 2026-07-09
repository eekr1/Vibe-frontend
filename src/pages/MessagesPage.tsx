import { useEffect, useState } from "react";
import { type Conversation, listDirectMessageConversations } from "../social/socialApi";
import { DirectMessageList } from "../social/DirectMessageList";
import { DirectMessageComposer } from "../social/DirectMessageComposer";

export function MessagesPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listDirectMessageConversations().then((data) => {
      if (!active) return;
      setConversations(data);
      if (data.length > 0 && !activeConversationId) {
        setActiveConversationId(data[0].conversationId);
      }
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [activeConversationId]);

  const activeConversation = conversations.find(c => c.conversationId === activeConversationId);

  return (
    <div className="messages-page">
      <div className="messages-sidebar">
        <h2>Recent Conversations</h2>
        {loading ? (
          <p>Loading...</p>
        ) : conversations.length === 0 ? (
          <p className="empty-state">No recent conversations.</p>
        ) : (
          <ul className="messages-conversation-list">
            {conversations.map(conv => (
              <li key={conv.conversationId}>
                <button
                  className={`messages-conversation-item ${conv.conversationId === activeConversationId ? "is-active" : ""}`}
                  onClick={() => setActiveConversationId(conv.conversationId)}
                  type="button"
                >
                  <div className="conversation-list-meta">
                    <strong>{conv.partner.displayName}</strong>
                    {conv.unreadCount > 0 && <span className="social-badge">{conv.unreadCount}</span>}
                  </div>
                  {conv.lastMessage && (
                    <p className="conversation-list-preview">
                      {conv.lastMessage.senderUserId === conv.partner.id ? "" : "You: "}
                      {conv.lastMessage.body}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="messages-main">
        {activeConversation ? (
          <>
            <div className="messages-main-header">
              <h3>{activeConversation.partner.displayName}</h3>
            </div>
            <div className="messages-main-body">
              <DirectMessageList
                conversationId={activeConversation.conversationId}
                partnerId={activeConversation.partner.id}
                readOnly={activeConversation.readOnly}
                onNavigate={onNavigate}
              />
            </div>
            <div className="messages-main-footer">
              {!activeConversation.readOnly ? (
                <DirectMessageComposer
                  conversationId={activeConversation.conversationId}
                  targetUserId={activeConversation.partner.id}
                />
              ) : (
                <p className="form-feedback">You can no longer message this person.</p>
              )}
            </div>
          </>
        ) : (
          <div className="messages-main-empty">
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
