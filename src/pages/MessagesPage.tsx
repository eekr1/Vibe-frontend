import { useEffect, useMemo, useState } from "react";
import { ApiClientError } from "../lib/api";
import { type Conversation, listDirectMessageConversations } from "../social/socialApi";
import { DirectMessageList } from "../social/DirectMessageList";
import { DirectMessageComposer } from "../social/DirectMessageComposer";

function isFeatureDisabled(error: unknown) {
  return error instanceof ApiClientError && error.code === "FEATURE_DISABLED";
}

function messageError(error: unknown) {
  if (isFeatureDisabled(error)) return "Direct messages are not enabled on this environment yet.";
  if (error instanceof ApiClientError) return error.message;
  return "Messages are temporarily unavailable.";
}

export function MessagesPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const targetUserId = useMemo(() => new URLSearchParams(window.location.search).get("targetUserId"), []);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draftTargetUserId, setDraftTargetUserId] = useState<string | null>(targetUserId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);

  async function refresh(preferredConversationId?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const page = await listDirectMessageConversations();
      const items = page.items;
      setConversations(items);
      setFeatureDisabled(false);
      const preferred = preferredConversationId ? items.find((conversation) => conversation.conversationId === preferredConversationId) : null;
      const targetConversation = targetUserId ? items.find((conversation) => conversation.partner.id === targetUserId) : null;
      const nextActive = preferred?.conversationId ?? targetConversation?.conversationId ?? items[0]?.conversationId ?? null;
      setActiveConversationId(nextActive);
      setDraftTargetUserId(nextActive ? null : targetUserId);
    } catch (caught) {
      setConversations([]);
      setActiveConversationId(null);
      setDraftTargetUserId(null);
      setFeatureDisabled(isFeatureDisabled(caught));
      setError(messageError(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const activeConversation = conversations.find((conversation) => conversation.conversationId === activeConversationId) ?? null;

  return (
    <div className="messages-page">
      <div className="messages-sidebar">
        <h2>Recent Conversations</h2>
        {loading ? (
          <p className="social-rail-state">Loading messages...</p>
        ) : featureDisabled ? (
          <p className="empty-state">Messages are not enabled here yet.</p>
        ) : conversations.length === 0 ? (
          <p className="empty-state">No recent conversations.</p>
        ) : (
          <ul className="messages-conversation-list">
            {conversations.map((conversation) => (
              <li key={conversation.conversationId}>
                <button
                  className={`messages-conversation-item ${conversation.conversationId === activeConversationId ? "is-active" : ""}`}
                  onClick={() => { setActiveConversationId(conversation.conversationId); setDraftTargetUserId(null); }}
                  type="button"
                >
                  <div className="conversation-list-meta">
                    <strong>{conversation.partner.displayName}</strong>
                    {conversation.unreadCount > 0 ? <span className="social-badge">{conversation.unreadCount}</span> : null}
                  </div>
                  {conversation.lastMessage ? (
                    <p className="conversation-list-preview">
                      {conversation.lastMessage.senderUserId === conversation.partner.id ? "" : "You: "}
                      {conversation.lastMessage.body}
                    </p>
                  ) : <p className="conversation-list-preview">No messages yet.</p>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="messages-main">
        {error ? <p className="form-error" role="alert">{error} {!featureDisabled ? <button className="text-action compact" onClick={() => void refresh(activeConversationId)} type="button">Retry</button> : null}</p> : null}
        {activeConversation ? (
          <>
            <div className="messages-main-header">
              <h3>{activeConversation.partner.displayName}</h3>
              {activeConversation.readOnly ? <p className="form-feedback">Read-only conversation</p> : null}
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
                  onSent={(conversationId) => void refresh(conversationId)}
                  targetUserId={activeConversation.partner.id}
                />
              ) : (
                <p className="form-feedback">You can no longer message this person.</p>
              )}
            </div>
          </>
        ) : draftTargetUserId ? (
          <>
            <div className="messages-main-header">
              <h3>New message</h3>
              <p className="form-feedback">Send the first message to open this conversation.</p>
            </div>
            <div className="messages-main-body">
              <div className="messages-main-empty"><p>No messages yet. Say hi.</p></div>
            </div>
            <div className="messages-main-footer">
              <DirectMessageComposer onSent={(conversationId) => void refresh(conversationId)} targetUserId={draftTargetUserId} />
            </div>
          </>
        ) : (
          <div className="messages-main-empty">
            <p>{featureDisabled ? "Messages will appear here after the backend flag is enabled." : "Select a conversation to start messaging."}</p>
          </div>
        )}
      </div>
    </div>
  );
}