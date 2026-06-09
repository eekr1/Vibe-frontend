import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AuthRequiredGate } from "../components/AuthRequiredGate";
import { ApiClientError } from "../lib/api";
import {
  applyRoomModerationAction,
  checkRoomAccess,
  closeRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  listRoomMessages,
  sendRoomMessage,
  unlockPrivateRoom,
  submitReport,
  type ModerationActionType,
  type ReportReason,
  type ReportTargetType,
  type Room,
  type RoomMessage,
  type RoomParticipant
} from "../rooms/roomApi";
import {
  createRoomRealtimeSocket,
  type PlaybackState,
  type RoomRealtimeSocket
} from "../rooms/realtimeClient";

type RoomShellPageProps = {
  onNavigate: (path: string) => void;
};

type AccessState =
  | "banned"
  | "blocked"
  | "checking"
  | "ended"
  | "full"
  | "joined"
  | "kicked"
  | "left"
  | "password_required";

type SocketStatus = "connected" | "connecting" | "disconnected" | "error" | "idle";

type ReportTarget = {
  label: string;
  roomId?: string;
  targetId: string;
  targetType: ReportTargetType;
};

const defaultPlayback: PlaybackState = {
  positionSeconds: 0,
  sourceTime: new Date(0).toISOString(),
  status: "paused",
  updatedAt: new Date(0).toISOString()
};

function readRoomId() {
  return new URLSearchParams(window.location.search).get("roomId");
}

function makeRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function describeAccessDenial(denialReason: null | string) {
  if (denialReason === "AUTH_REQUIRED") {
    return "Log in to enter this room.";
  }

  if (denialReason === "ROOM_FULL") {
    return "This room is full right now.";
  }

  if (denialReason === "ROOM_NOT_LIVE") {
    return "This room is no longer live.";
  }

  if (denialReason === "ROOM_USER_BANNED") {
    return "You are banned from rejoining this room.";
  }

  if (denialReason?.startsWith("ACCOUNT_")) {
    return "This account cannot enter rooms right now.";
  }

  return "Room access is currently blocked.";
}

function describeApiError(error: unknown, fallback: string) {
  if (!(error instanceof ApiClientError)) {
    return fallback;
  }

  if (error.code === "ROOM_FULL") {
    return "This room is full right now.";
  }

  if (error.code === "ROOM_ENDED") {
    return "This room has ended.";
  }

  if (error.code === "ROOM_PASSWORD_REQUIRED") {
    return "Enter the room password to join.";
  }

  if (error.code === "ROOM_USER_BANNED") {
    return "You are banned from rejoining this room.";
  }

  return error.message;
}

const reportReasonOptions: Array<{ label: string; value: ReportReason }> = [
  { label: "Harassment", value: "harassment" },
  { label: "Hate speech", value: "hate_speech" },
  { label: "Spam", value: "spam" },
  { label: "Inappropriate room title", value: "inappropriate_room_title" },
  { label: "Abusive behavior", value: "abusive_behavior" },
  { label: "Harmful content", value: "harmful_content" },
  { label: "Impersonation", value: "impersonation" },
  { label: "Other", value: "other" }
];

function describeModerationAction(actionType: ModerationActionType) {
  return actionType === "ban" ? "banned from rejoining" : "removed from the room";
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function RoomShellPage({ onNavigate }: RoomShellPageProps) {
  const { currentUser, isCheckingSession } = useAuth();
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isApplyingModeration, setIsApplyingModeration] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [moderationFeedback, setModerationFeedback] = useState<string | null>(null);
  const [participant, setParticipant] = useState<RoomParticipant | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>(defaultPlayback);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [presenceParticipants, setPresenceParticipants] = useState<RoomParticipant[]>([]);
  const [privatePassword, setPrivatePassword] = useState("");
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("harassment");
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("idle");
  const socketRef = useRef<RoomRealtimeSocket | null>(null);
  const roomId = readRoomId();
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const isHost = currentUser?.id === room?.host.id;
  const isEnded = accessState === "ended" || room?.state === "ended";
  const canUseRoom = accessState === "joined" && participant?.state === "active" && !isEnded;

  function appendMessage(message: RoomMessage) {
    setMessages((currentMessages) => {
      if (currentMessages.some((currentMessage) => currentMessage.id === message.id)) {
        return currentMessages;
      }

      return [...currentMessages, message];
    });
  }

  async function loadMessages(activeRoomId: string) {
    const history = await listRoomMessages(activeRoomId);
    setMessages(history.messages);
    setParticipant(history.participant);
  }

  async function joinAndLoadRoom(activeRoomId: string) {
    setError(null);
    setIsJoining(true);

    try {
      const joined = await joinRoom(activeRoomId);
      setRoom(joined.room);
      setParticipant(joined.participant);
      setAccessState("joined");
      await loadMessages(activeRoomId);
    } catch (caughtError) {
      const nextError = describeApiError(caughtError, "Room join failed.");
      setError(nextError);

      if (caughtError instanceof ApiClientError && caughtError.code === "ROOM_FULL") {
        setAccessState("full");
      } else if (caughtError instanceof ApiClientError && caughtError.code === "ROOM_ENDED") {
        setAccessState("ended");
      } else if (caughtError instanceof ApiClientError && caughtError.code === "ROOM_PASSWORD_REQUIRED") {
        setAccessState("password_required");
      } else if (caughtError instanceof ApiClientError && caughtError.code === "ROOM_USER_BANNED") {
        setAccessState("banned");
      } else {
        setAccessState("blocked");
      }
    } finally {
      setIsJoining(false);
    }
  }

  useEffect(() => {
    if (!roomId || !currentUser) {
      return;
    }

    let isMounted = true;
    const activeRoomId = roomId;

    async function loadRoom() {
      setAccessState("checking");
      setError(null);
      setIsLoadingRoom(true);
      setMessages([]);
      setModerationFeedback(null);
      setParticipant(null);
      setPlayback(defaultPlayback);
      setPlaybackPosition(0);
      setPresenceParticipants([]);
      setRealtimeError(null);
      setReportDetails("");
      setReportFeedback(null);
      setReportTarget(null);
      setRoom(null);

      try {
        const loadedRoom = await getRoom(activeRoomId);

        if (!isMounted) {
          return;
        }

        setRoom(loadedRoom);

        if (loadedRoom.state === "ended") {
          setAccessState("ended");
          return;
        }

        const access = await checkRoomAccess(activeRoomId);

        if (!isMounted) {
          return;
        }

        setRoom(access.room);

        if (access.status === "allowed") {
          await joinAndLoadRoom(activeRoomId);
        } else if (access.status === "password_required") {
          setAccessState("password_required");
        } else if (access.denialReason === "ROOM_FULL") {
          setAccessState("full");
          setError(describeAccessDenial(access.denialReason));
        } else if (access.denialReason === "ROOM_USER_BANNED") {
          setAccessState("banned");
          setError(describeAccessDenial(access.denialReason));
        } else if (access.denialReason === "ROOM_NOT_LIVE") {
          setAccessState("ended");
        } else {
          setAccessState("blocked");
          setError(describeAccessDenial(access.denialReason));
        }
      } catch (caughtError) {
        if (isMounted) {
          setAccessState("blocked");
          setError(describeApiError(caughtError, "Room could not be loaded."));
        }
      } finally {
        if (isMounted) {
          setIsLoadingRoom(false);
        }
      }
    }

    void loadRoom();

    return () => {
      isMounted = false;
    };
  }, [currentUser, roomId]);

  useEffect(() => {
    if (!roomId || !canUseRoom || !currentUser) {
      setSocketStatus("idle");
      return;
    }

    const activeRoomId = roomId;
    const socket = createRoomRealtimeSocket();
    socketRef.current = socket;
    setSocketStatus("connecting");
    setRealtimeError(null);

    function subscribeToRoom() {
      socket.emit("room.subscribe", { requestId: makeRequestId(), roomId: activeRoomId }, (ack) => {
        if (!ack.ok) {
          setRealtimeError(ack.error.message);
          setSocketStatus("error");
        }
      });
    }

    socket.on("connect", () => {
      setSocketStatus("connected");
      subscribeToRoom();
    });

    socket.on("connect_error", (socketError) => {
      setSocketStatus("error");
      setRealtimeError(socketError.message);
    });

    socket.on("disconnect", () => {
      setSocketStatus("disconnected");
    });

    socket.on("connection.ready", () => {
      setSocketStatus("connected");
    });

    socket.on("connection.error", (payload) => {
      setSocketStatus("error");
      setRealtimeError(payload.message);
    });

    socket.on("access.feedback", (payload) => {
      setRealtimeError(payload.message);

      if (payload.code === "ROOM_USER_BANNED") {
        setAccessState("banned");
        setError(payload.message);
      }
    });

    socket.on("room.state.snapshot", (payload) => {
      setRoom(payload.room);
      setPresenceParticipants(payload.participants);
      setPlayback(payload.playback);
      setPlaybackPosition(payload.playback.positionSeconds);

      const currentParticipant = payload.participants.find(
        (nextParticipant) => nextParticipant.user.id === currentUser.id
      );

      if (currentParticipant) {
        setParticipant(currentParticipant);
        setAccessState("joined");
      }
    });

    socket.on("room.presence.updated", (payload) => {
      setPresenceParticipants(payload.participants);
      setRoom((currentRoom) =>
        currentRoom && currentRoom.id === payload.roomId
          ? {
              ...currentRoom,
              activeParticipantCount: payload.activeParticipantCount
            }
          : currentRoom
      );
    });

    socket.on("chat.message.created", (payload) => {
      appendMessage(payload.message);
    });

    socket.on("moderation.action.applied", (payload) => {
      if (payload.roomId !== activeRoomId) {
        return;
      }

      setModerationFeedback(
        `${payload.action.target.displayName} was ${describeModerationAction(payload.action.actionType)} by ${payload.action.actor.displayName}.`
      );
      setPresenceParticipants((currentParticipants) =>
        currentParticipants.filter((nextParticipant) => nextParticipant.user.id !== payload.targetUserId)
      );
    });

    socket.on("playback.state.updated", (payload) => {
      setPlayback(payload.playback);
      setPlaybackPosition(payload.playback.positionSeconds);
    });

    socket.on("room.access.revoked", (payload) => {
      if (payload.roomId !== activeRoomId) {
        return;
      }

      const nextMessage =
        payload.actionType === "ban"
          ? "You were banned from rejoining this room by the host."
          : "You were removed from this room by the host.";

      setAccessState(payload.actionType === "ban" ? "banned" : "kicked");
      setError(nextMessage);
      setMessages([]);
      setParticipant(null);
      setPresenceParticipants([]);
      setRealtimeError(nextMessage);
      socket.emit("room.unsubscribe", { requestId: makeRequestId(), roomId: activeRoomId }, () => undefined);
      socket.disconnect();
      socketRef.current = null;
      setSocketStatus("disconnected");
    });

    socket.on("room.ended", (payload) => {
      setRoom((currentRoom) =>
        currentRoom && currentRoom.id === payload.roomId
          ? {
              ...currentRoom,
              endedAt: payload.endedAt,
              state: "ended"
            }
          : currentRoom
      );
      setParticipant(null);
      setPresenceParticipants([]);
      setAccessState("ended");
      setRealtimeError(`Room ended: ${payload.reason}`);
    });

    return () => {
      socket.emit("room.unsubscribe", { requestId: makeRequestId(), roomId: activeRoomId }, () => undefined);
      socket.disconnect();
      socketRef.current = null;
      setSocketStatus("idle");
    };
  }, [canUseRoom, currentUser, roomId]);

  async function handlePrivatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!roomId) {
      return;
    }

    setError(null);
    setIsUnlocking(true);

    try {
      const access = await unlockPrivateRoom(roomId, privatePassword);
      setRoom(access.room);
      setParticipant(access.participant);
      setAccessState("joined");
      setPrivatePassword("");
      await loadMessages(roomId);
    } catch (caughtError) {
      setError(describeApiError(caughtError, "Private room could not be unlocked."));

      if (caughtError instanceof ApiClientError && caughtError.code === "ROOM_FULL") {
        setAccessState("full");
      } else if (caughtError instanceof ApiClientError && caughtError.code === "ROOM_ENDED") {
        setAccessState("ended");
      } else if (caughtError instanceof ApiClientError && caughtError.code === "ROOM_USER_BANNED") {
        setAccessState("banned");
      }
    } finally {
      setIsUnlocking(false);
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!room || !messageBody.trim()) {
      return;
    }

    setError(null);
    setIsSendingMessage(true);

    try {
      const socket = socketRef.current;

      if (socket?.connected) {
        await new Promise<void>((resolve, reject) => {
          socket.emit(
            "chat.message.send",
            {
              body: messageBody,
              requestId: makeRequestId(),
              roomId: room.id
            },
            (ack) => {
              if (ack.ok) {
                resolve();
              } else {
                reject(new Error(ack.error.message));
              }
            }
          );
        });
      } else {
        const message = await sendRoomMessage(room.id, messageBody);
        appendMessage(message);
      }

      setMessageBody("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : describeApiError(caughtError, "Message could not be sent."));
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handlePlaybackSet(status: PlaybackState["status"]) {
    if (!room) {
      return;
    }

    const socket = socketRef.current;

    if (!socket?.connected) {
      setRealtimeError("Socket is not connected yet.");
      return;
    }

    socket.emit(
      "playback.state.set",
      {
        positionSeconds: playbackPosition,
        requestId: makeRequestId(),
        roomId: room.id,
        sourceTime: new Date().toISOString(),
        status
      },
      (ack) => {
        if (!ack.ok) {
          setRealtimeError(ack.error.message);
        }
      }
    );
  }

  async function handleModerationAction(targetUserId: string, actionType: ModerationActionType) {
    if (!room) {
      return;
    }

    if (actionType === "ban" && !window.confirm("Ban this participant from rejoining this room?")) {
      return;
    }

    setError(null);
    setModerationFeedback(null);
    setIsApplyingModeration(`${actionType}:${targetUserId}`);

    try {
      const action = await applyRoomModerationAction(room.id, {
        actionType,
        reason: actionType === "ban" ? "Host banned this participant from the room." : "Host removed this participant from the room.",
        targetUserId
      });

      setModerationFeedback(`${action.target.displayName} was ${describeModerationAction(action.actionType)}.`);
      setPresenceParticipants((currentParticipants) =>
        currentParticipants.filter((nextParticipant) => nextParticipant.user.id !== targetUserId)
      );
    } catch (caughtError) {
      setError(describeApiError(caughtError, "Moderation action failed."));
    } finally {
      setIsApplyingModeration(null);
    }
  }

  async function handleSubmitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!reportTarget) {
      return;
    }

    setError(null);
    setReportFeedback(null);
    setIsSubmittingReport(true);

    try {
      const report = await submitReport({
        details: reportDetails.trim() || undefined,
        reason: reportReason,
        roomId: reportTarget.roomId,
        targetId: reportTarget.targetId,
        targetType: reportTarget.targetType
      });

      setReportFeedback(`Report ${report.id.slice(0, 8)} received for ${reportTarget.label}.`);
      setReportDetails("");
      setReportTarget(null);
    } catch (caughtError) {
      setReportFeedback(describeApiError(caughtError, "Report could not be submitted."));
    } finally {
      setIsSubmittingReport(false);
    }
  }

  async function handleCloseRoom() {
    if (!room) {
      return;
    }

    setError(null);
    setIsClosing(true);

    try {
      const endedRoom = await closeRoom(room.id);
      setRoom(endedRoom);
      setParticipant(null);
      setMessages([]);
      setAccessState("ended");
    } catch (caughtError) {
      setError(describeApiError(caughtError, "Room could not be closed."));
    } finally {
      setIsClosing(false);
    }
  }

  async function handleLeaveRoom() {
    if (!room) {
      return;
    }

    setError(null);
    setIsLeaving(true);

    try {
      const left = await leaveRoom(room.id);
      setRoom(left.room);
      setParticipant(left.participant);
      setMessages([]);
      setAccessState(left.endedByHost ? "ended" : "left");
    } catch (caughtError) {
      setError(describeApiError(caughtError, "Room could not be left."));
    } finally {
      setIsLeaving(false);
    }
  }

  if (!isCheckingSession && !currentUser) {
    return (
      <AuthRequiredGate
        onLogin={() => onNavigate(`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`)}
        onSignup={() => onNavigate(`/auth?mode=signup&returnTo=${encodeURIComponent(returnTo)}`)}
      />
    );
  }

  if (isCheckingSession || isLoadingRoom || isJoining) {
    return (
      <section className="surface-panel wide-panel">
        <div className="inline-loading">
          <span className="loader" />
          Loading room session
        </div>
      </section>
    );
  }

  if (!roomId) {
    return (
      <section className="surface-panel wide-panel">
        <p className="eyebrow">Room</p>
        <h2>No room selected yet.</h2>
        <p>Create a live room or pick one from Discover to load a room here.</p>
        <div className="action-row">
          <button className="primary-action" onClick={() => onNavigate("/create-room")} type="button">
            Create room
          </button>
          <button className="secondary-action" onClick={() => onNavigate("/discover")} type="button">
            Discover rooms
          </button>
        </div>
      </section>
    );
  }

  if (error && !room) {
    return (
      <section className="surface-panel wide-panel">
        <p className="eyebrow">Room unavailable</p>
        <h2>This room cannot be opened.</h2>
        <p className="form-error">{error}</p>
        <button className="secondary-action" onClick={() => onNavigate("/discover")} type="button">
          Back to Discover
        </button>
      </section>
    );
  }

  if (!room) {
    return null;
  }

  return (
    <section className="room-experience">
      <header className="room-hero">
        <div>
          <p className="eyebrow">
            {room.visibility} room | {room.category.name}
          </p>
          <h2>{room.title}</h2>
          <p>
            Hosted by {room.host.displayName}
            {isHost ? " | you are the host" : ""}.
          </p>
        </div>
        <div className="room-hero-actions">
          <span className={`socket-pill ${socketStatus}`}>Socket: {socketStatus}</span>
          <span className={`state-pill ${room.state}`}>{room.state}</span>
          {isHost && !isEnded ? (
            <button className="primary-action compact" disabled={isClosing} onClick={() => void handleCloseRoom()} type="button">
              {isClosing ? "Closing..." : "Close room"}
            </button>
          ) : null}
          {canUseRoom ? (
            <button className="secondary-action compact" disabled={isLeaving} onClick={() => void handleLeaveRoom()} type="button">
              {isLeaving ? "Leaving..." : isHost ? "Leave and end" : "Leave room"}
            </button>
          ) : null}
        </div>
      </header>

      <div className="room-session-grid">
        <main className="watch-panel">
          <div className="video-plane">
            {room.source.thumbnailUrl ? <img alt="" src={room.source.thumbnailUrl} /> : null}
            <div className="video-plane-overlay">
              <span>{canUseRoom ? "Watch surface ready" : isEnded ? "Room ended" : "Entry required"}</span>
            </div>
          </div>

          {isEnded ? (
            <p className="state-banner">This room has ended. Chat and watch surfaces are closed.</p>
          ) : accessState === "full" ? (
            <p className="state-banner danger">This room is full. Chat and watch surfaces are locked.</p>
          ) : accessState === "banned" ? (
            <p className="state-banner danger">You are banned from rejoining this room.</p>
          ) : accessState === "kicked" ? (
            <div className="state-banner">
              <p>You were removed from this room by the host. You may try to re-enter if the host has not banned you.</p>
              <button
                className="secondary-action compact"
                onClick={() => {
                  if (room.visibility === "private" && !isHost) {
                    setAccessState("password_required");
                  } else {
                    void joinAndLoadRoom(room.id);
                  }
                }}
                type="button"
              >
                Try re-entering
              </button>
            </div>
          ) : accessState === "left" ? (
            <div className="state-banner">
              <p>You left this room. Chat and watch surfaces are paused for you.</p>
              <button
                className="secondary-action compact"
                onClick={() => {
                  if (room.visibility === "private" && !isHost) {
                    setAccessState("password_required");
                  } else {
                    void joinAndLoadRoom(room.id);
                  }
                }}
                type="button"
              >
                Re-enter room
              </button>
            </div>
          ) : accessState === "password_required" ? (
            <form className="private-entry state-card" onSubmit={handlePrivatePassword}>
              <label>
                Private room password
                <input
                  onChange={(event) => setPrivatePassword(event.target.value)}
                  required
                  type="password"
                  value={privatePassword}
                />
              </label>
              <button className="primary-action full-width" disabled={isUnlocking} type="submit">
                {isUnlocking ? "Checking..." : "Enter private room"}
              </button>
            </form>
          ) : canUseRoom ? (
            <div className="playback-panel">
              <div>
                <p className="eyebrow">Shared playback</p>
                <h3>{playback.status}</h3>
                <p>
                  Position {Math.round(playback.positionSeconds)}s | Updated {formatMessageTime(playback.updatedAt)}
                </p>
              </div>
              {isHost ? (
                <div className="playback-controls">
                  <label>
                    Position seconds
                    <input
                      min={0}
                      onChange={(event) => setPlaybackPosition(Number(event.target.value))}
                      type="number"
                      value={playbackPosition}
                    />
                  </label>
                  <button className="secondary-action compact" onClick={() => void handlePlaybackSet("paused")} type="button">
                    Pause
                  </button>
                  <button className="primary-action compact" onClick={() => void handlePlaybackSet("playing")} type="button">
                    Play
                  </button>
                </div>
              ) : (
                <p className="state-banner success">Realtime playback state is synced from the host.</p>
              )}
            </div>
          ) : (
            <p className="state-banner">{error ?? "Room access is being checked."}</p>
          )}
        </main>

        <aside className="room-side participant-panel">
          <p className="eyebrow">Participants</p>
          <h3>
            {room.activeParticipantCount}/{room.participantLimit} active
          </h3>
          <dl className="room-facts">
            <div>
              <dt>Your state</dt>
              <dd>{participant?.state ?? accessState}</dd>
            </div>
            <div>
              <dt>Your role</dt>
              <dd>{participant?.role ?? "not joined"}</dd>
            </div>
            <div>
              <dt>Socket presence</dt>
              <dd>{presenceParticipants.length}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{room.source.provider}</dd>
            </div>
          </dl>
          {presenceParticipants.length > 0 ? (
            <ul className="presence-list">
              {presenceParticipants.map((nextParticipant) => (
                <li key={nextParticipant.id}>
                  <div>
                    <span>{nextParticipant.user.displayName}</span>
                    <small>{nextParticipant.role}</small>
                  </div>
                  <div className="participant-actions">
                    <button
                      className="text-action compact"
                      disabled={!canUseRoom}
                      onClick={() => {
                        setReportTarget({
                          label: nextParticipant.user.displayName,
                          roomId: room.id,
                          targetId: nextParticipant.user.id,
                          targetType: "user"
                        });
                        setReportFeedback(null);
                      }}
                      type="button"
                    >
                      Report
                    </button>
                    {isHost && nextParticipant.user.id !== currentUser?.id ? (
                      <>
                        <button
                          className="secondary-action compact"
                          disabled={isApplyingModeration === `kick:${nextParticipant.user.id}`}
                          onClick={() => void handleModerationAction(nextParticipant.user.id, "kick")}
                          type="button"
                        >
                          Kick
                        </button>
                        <button
                          className="danger-action compact"
                          disabled={isApplyingModeration === `ban:${nextParticipant.user.id}`}
                          onClick={() => void handleModerationAction(nextParticipant.user.id, "ban")}
                          type="button"
                        >
                          Ban
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="report-panel">
            <div className="report-panel-header">
              <div>
                <p className="eyebrow">Safety report</p>
                <h4>{reportTarget ? `Report ${reportTarget.label}` : "Report room, users, or messages"}</h4>
              </div>
              <button
                className="text-action compact"
                disabled={!canUseRoom}
                onClick={() => {
                  setReportTarget({
                    label: room.title,
                    roomId: room.id,
                    targetId: room.id,
                    targetType: "room"
                  });
                  setReportFeedback(null);
                }}
                type="button"
              >
                Report room
              </button>
            </div>
            {reportTarget ? (
              <form className="report-form" onSubmit={handleSubmitReport}>
                <label>
                  Reason
                  <select
                    onChange={(event) => setReportReason(event.target.value as ReportReason)}
                    value={reportReason}
                  >
                    {reportReasonOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Details
                  <textarea
                    maxLength={1000}
                    onChange={(event) => setReportDetails(event.target.value)}
                    placeholder="Add short context for later admin review..."
                    rows={3}
                    value={reportDetails}
                  />
                </label>
                <div className="action-row">
                  <button className="primary-action compact" disabled={isSubmittingReport} type="submit">
                    {isSubmittingReport ? "Submitting..." : "Submit report"}
                  </button>
                  <button
                    className="secondary-action compact"
                    onClick={() => setReportTarget(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p>Reports are stored for later admin review with room context.</p>
            )}
          </div>
          {moderationFeedback ? <p className="state-banner success">{moderationFeedback}</p> : null}
          {reportFeedback ? <p className="state-banner success">{reportFeedback}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          {realtimeError ? <p className="form-error">{realtimeError}</p> : null}
        </aside>

        <section className={canUseRoom ? "chat-panel" : "chat-panel is-disabled"}>
          <div className="chat-header">
            <div>
              <p className="eyebrow">Room chat</p>
              <h3>Live persisted messages</h3>
            </div>
            <span>{messages.length} loaded | {socketStatus}</span>
          </div>

          <div className="message-list">
            {canUseRoom && messages.length > 0 ? (
              messages.map((message) => (
                <article className="message-item" key={message.id}>
                  <div>
                    <span>
                      <strong>{message.author.displayName}</strong>
                      <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                    </span>
                    <button
                      className="text-action compact"
                      onClick={() => {
                        setReportTarget({
                          label: `message by ${message.author.displayName}`,
                          roomId: room.id,
                          targetId: message.id,
                          targetType: "message"
                        });
                        setReportFeedback(null);
                      }}
                      type="button"
                    >
                      Report
                    </button>
                  </div>
                  <p>{message.body}</p>
                </article>
              ))
            ) : canUseRoom ? (
              <p className="empty-chat">No messages yet. Be the first spark.</p>
            ) : (
              <p className="empty-chat">Join the live room before reading or sending chat.</p>
            )}
          </div>

          <form className="message-form" onSubmit={handleSendMessage}>
            <input
              disabled={!canUseRoom || isSendingMessage}
              maxLength={500}
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder={canUseRoom ? "Send a message..." : "Chat locked until you join"}
              value={messageBody}
            />
            <button className="primary-action compact" disabled={!canUseRoom || isSendingMessage || !messageBody.trim()} type="submit">
              {isSendingMessage ? "Sending..." : "Send"}
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}
