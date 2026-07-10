import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DirectMessage, blockMember, listDirectMessages, markDirectMessagesDelivered, markDirectMessagesRead, listRoomInvites, type RoomInvite } from "./socialApi";
import { RoomInviteCard } from "./RoomInviteCard";
import { ReportDialog } from "./ReportDialog";
import { useDirectMessageRealtime } from "./useDirectMessageRealtime";

type Props = {
  conversationId: string;
  partnerId: string;
  readOnly: boolean;
  onNavigate: (path: string) => void;
};

type ChatItem =
  | { type: "message"; data: DirectMessage; date: Date }
  | { type: "invite"; data: RoomInvite; date: Date };

export function DirectMessageList({ conversationId, partnerId, readOnly, onNavigate }: Props) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReportMessage, setActiveReportMessage] = useState<DirectMessage | null>(null);
  const lastReadMessageIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const markVisibleRead = useCallback((items: DirectMessage[]) => {
    const latest = items.at(-1);
    if (!latest) return;
    if (latest.id === lastReadMessageIdRef.current) return;
    lastReadMessageIdRef.current = latest.id;
    void markDirectMessagesRead(conversationId, latest.id).catch(() => {
      if (lastReadMessageIdRef.current === latest.id) lastReadMessageIdRef.current = null;
    });
  }, [conversationId]);
  const loadData = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const [msgPage, invPage] = await Promise.all([
        listDirectMessages(conversationId),
        listRoomInvites()
      ]);
      setMessages(msgPage.items);
      setInvites(invPage.items.filter((invite) => invite.inviter.id === partnerId || invite.recipient.id === partnerId));
      markVisibleRead(msgPage.items);
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [conversationId, markVisibleRead, partnerId]);
  useEffect(() => {
    let active = true;
    lastReadMessageIdRef.current = null;
    setLoading(true);
    Promise.all([
      listDirectMessages(conversationId),
      listRoomInvites()
    ]).then(([msgPage, invPage]) => {
      if (!active) return;
      setMessages(msgPage.items);
      setInvites(invPage.items.filter((invite) => invite.inviter.id === partnerId || invite.recipient.id === partnerId));
      markVisibleRead(msgPage.items);
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [conversationId, markVisibleRead, partnerId]);

  useDirectMessageRealtime({
    onMessageCreated: ({ conversationId: eventConversationId, message }) => {
      if (eventConversationId !== conversationId) return;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      if (message.senderUserId === partnerId) {
        void markDirectMessagesDelivered(conversationId, message.id);
        if (lastReadMessageIdRef.current !== message.id) {
          lastReadMessageIdRef.current = message.id;
          void markDirectMessagesRead(conversationId, message.id).catch(() => {
            if (lastReadMessageIdRef.current === message.id) lastReadMessageIdRef.current = null;
          });
        }
      }
    },
    onRefresh: () => { void loadData({ silent: true }); }
  });

  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [loading, messages.length, invites.length]);

  const items = useMemo(() => {
    const combined: ChatItem[] = [
      ...messages.map((message) => ({ type: "message" as const, data: message, date: new Date(message.createdAt) })),
      ...invites.map((invite) => ({ type: "invite" as const, data: invite, date: new Date(invite.createdAt) }))
    ];
    return combined.sort((left, right) => left.date.getTime() - right.date.getTime());
  }, [messages, invites]);

  function replaceInvite(nextInvite: RoomInvite) {
    setInvites((current) => current.map((invite) => invite.id === nextInvite.id ? nextInvite : invite));
  }

  async function blockReportedMember() {
    await blockMember(partnerId);
  }

  function renderMessageBody(body: string, linkTokens: DirectMessage["linkTokens"]) {
    if (!linkTokens || linkTokens.length === 0) return body;

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    linkTokens.forEach((token, index) => {
      if (token.start > lastIndex) elements.push(<span key={`text-${index}`}>{body.slice(lastIndex, token.start)}</span>);
      elements.push(<a className="message-link" href={token.url} key={`link-${index}`} rel="noopener noreferrer" target="_blank">{token.url}</a>);
      lastIndex = token.end;
    });

    if (lastIndex < body.length) elements.push(<span key="text-end">{body.slice(lastIndex)}</span>);
    return elements;
  }

  return (
    <div className="dm-list-container" ref={scrollRef}>
      {loading ? (
        <div className="dm-loading">Loading messages...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No messages yet. Say hi!</div>
      ) : (
        <div className="dm-items">
          {items.map((item) => {
            if (item.type === "message") {
              const message = item.data;
              const isMine = message.senderUserId !== partnerId;
              return (
                <div className={`dm-message-bubble ${isMine ? "is-mine" : "is-theirs"}`} key={`msg-${message.id}`}>
                  <div className="dm-message-content">{renderMessageBody(message.body, message.linkTokens)}</div>
                  <div className="dm-message-meta">
                    <span>
                      {item.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {isMine && message.state === "visible" ? <span className="dm-status"> Sent</span> : null}
                    </span>
                    {!isMine && message.state === "visible" ? (
                      <button className="text-action compact dm-report-action" onClick={() => setActiveReportMessage(message)} type="button">
                        Report
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            }
            return (
              <div className="dm-invite-wrapper" key={`inv-${item.data.id}`}>
                <RoomInviteCard compact invite={item.data} onChanged={replaceInvite} onNavigate={onNavigate} />
              </div>
            );
          })}
        </div>
      )}
      {readOnly ? <p className="form-feedback">This conversation is read-only.</p> : null}
      {activeReportMessage ? (
        <ReportDialog
          onBlock={blockReportedMember}
          onClose={() => setActiveReportMessage(null)}
          targetId={activeReportMessage.id}
          targetLabel="this message"
          targetType="direct_message"
        />
      ) : null}
    </div>
  );
}
