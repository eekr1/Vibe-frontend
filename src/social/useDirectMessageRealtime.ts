import { useEffect, useRef } from "react";
import { createRoomRealtimeSocket } from "../rooms/realtimeClient";
import type { DirectMessage } from "./socialApi";

type Handlers = {
  onConversationDeleted?: (payload: { cleanupAfter: string | null; conversationId: string; userId: string }) => void;
  onMessageCreated?: (payload: { conversationId: string; message: DirectMessage }) => void;
  onRefresh?: () => void;
};

export function useDirectMessageRealtime(handlers: Handlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const socket = createRoomRealtimeSocket();
    socket.on("dm.message.created", (payload) => {
      handlersRef.current.onMessageCreated?.({ conversationId: payload.conversationId, message: payload.message });
      handlersRef.current.onRefresh?.();
    });
    socket.on("dm.read.updated", () => handlersRef.current.onRefresh?.());
    socket.on("dm.delivery.updated", () => handlersRef.current.onRefresh?.());
    socket.on("dm.conversation.deleted", (payload) => {
      handlersRef.current.onConversationDeleted?.({ cleanupAfter: payload.cleanupAfter, conversationId: payload.conversationId, userId: payload.userId });
      handlersRef.current.onRefresh?.();
    });
    socket.on("relationship.invalidated", () => handlersRef.current.onRefresh?.());
    socket.on("notification.invalidated", () => handlersRef.current.onRefresh?.());
    return () => {
      socket.disconnect();
    };
  }, []);
}