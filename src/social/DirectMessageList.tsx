import React, { useEffect, useMemo, useRef, useState } from "react";
import { type DirectMessage, listDirectMessages, markDirectMessagesRead, listRoomInvites, type RoomInvite } from "./socialApi";
import { RoomInviteCard } from "./RoomInviteCard";

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      listDirectMessages(conversationId),
      listRoomInvites() // In a real app we might filter this by partnerId on the server
    ]).then(([msgPage, invPage]) => {
      if (!active) return;
      setMessages(msgPage.items);
      const relevantInvites = invPage.items.filter(
        i => i.inviter.id === partnerId || i.recipient.id === partnerId
      );
      setInvites(relevantInvites);
      setLoading(false);
      
      // Mark read
      if (msgPage.items.length > 0) {
        markDirectMessagesRead(conversationId, msgPage.items[0].id).catch(() => undefined);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [conversationId, partnerId]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [loading]);

  const items = useMemo(() => {
    const combined: ChatItem[] = [
      ...messages.map(m => ({ type: "message" as const, data: m, date: new Date(m.createdAt) })),
      ...invites.map(i => ({ type: "invite" as const, data: i, date: new Date(i.createdAt) }))
    ];
    return combined.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [messages, invites]);

  function replaceInvite(nextInvite: RoomInvite) {
    setInvites((current) => current.map((invite) => invite.id === nextInvite.id ? nextInvite : invite));
  }

  function renderMessageBody(body: string, linkTokens: DirectMessage["linkTokens"]) {
    if (!linkTokens || linkTokens.length === 0) return body;
    
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    
    linkTokens.forEach((token, i) => {
      if (token.start > lastIndex) {
        elements.push(<span key={`text-${i}`}>{body.slice(lastIndex, token.start)}</span>);
      }
      elements.push(
        <a key={`link-${i}`} href={token.url} target="_blank" rel="noopener noreferrer" className="message-link">
          {token.url}
        </a>
      );
      lastIndex = token.end;
    });
    
    if (lastIndex < body.length) {
      elements.push(<span key="text-end">{body.slice(lastIndex)}</span>);
    }
    
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
          {items.map(item => {
            if (item.type === "message") {
              const msg = item.data;
              const isMine = msg.senderUserId !== partnerId;
              return (
                <div key={`msg-${msg.id}`} className={`dm-message-bubble ${isMine ? "is-mine" : "is-theirs"}`}>
                  <div className="dm-message-content">
                    {renderMessageBody(msg.body, msg.linkTokens)}
                  </div>
                  <div className="dm-message-meta">
                    {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMine && msg.state === "visible" ? <span className="dm-status"> Sent</span> : null}
                  </div>
                </div>
              );
            } else {
              return (
                <div key={`inv-${item.data.id}`} className="dm-invite-wrapper">
                  <RoomInviteCard compact invite={item.data} onChanged={replaceInvite} onNavigate={onNavigate} />
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
