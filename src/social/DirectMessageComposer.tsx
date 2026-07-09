import React, { useState, useEffect, useRef } from "react";
import { sendDirectMessage } from "./socialApi";

type Props = {
  conversationId: string;
  targetUserId: string;
};

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

export function DirectMessageComposer({ conversationId, targetUserId }: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const draftKey = `vibehall:dm-draft:${conversationId}`;

  useEffect(() => {
    const draft = window.localStorage.getItem(draftKey);
    if (draft) {
      setBody(draft);
    }
  }, [draftKey]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setBody(val);
    window.localStorage.setItem(draftKey, val);
  }

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || sending || trimmed.length > 2000) return;
    
    setSending(true);
    setError(null);
    try {
      const clientMessageId = `web-${Date.now()}-${generateId()}`;
      await sendDirectMessage(trimmed, clientMessageId, targetUserId);
      setBody("");
      window.localStorage.removeItem(draftKey);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (err: any) {
      setError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const charsLeft = 2000 - body.length;

  return (
    <div className="dm-composer">
      {error && <p className="form-error compact" role="alert">{error}</p>}
      <div className="dm-composer-input-area">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          disabled={sending}
          maxLength={2000}
          className="dm-textarea"
          aria-label="Message content"
          rows={1}
        />
        <button
          className="primary-action compact"
          onClick={() => void handleSend()}
          disabled={!body.trim() || sending || body.length > 2000}
          type="button"
          aria-label="Send message"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
      {charsLeft < 100 && (
        <div className={`dm-char-count ${charsLeft < 0 ? "is-error" : ""}`}>
          {charsLeft} characters left
        </div>
      )}
    </div>
  );
}
