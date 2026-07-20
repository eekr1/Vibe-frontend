import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AuthRequiredGate } from "../components/AuthRequiredGate";
import { InlineLoader } from "../components/feedback";
import { Avatar } from "../components/ui";
import { ApiClientError } from "../lib/api";
import { safeErrorText } from "../lib/errorMapping";
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
  type PlaybackActionType,
  type PlaybackState,
  type RoomRealtimeSocket
} from "../rooms/realtimeClient";
import { YouTubeRoomPlayer } from "../rooms/YouTubeRoomPlayer";
import { RelationshipActions } from "../social/RelationshipActions";

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
    return "The host has blocked you from rejoining this room.";
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
    return "The host has blocked you from rejoining this room.";
  }

  return safeErrorText(error, fallback);
}

function describeRealtimeError(code: string, message: string, fallback: string) {
  return safeErrorText(new ApiClientError(message, code), fallback);
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
  return actionType === "ban" ? "blocked from rejoining" : "removed from the room";
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatPlaybackTime(value: number) {
  const safeValue = Math.max(0, Math.floor(value));
  const hours = Math.floor(safeValue / 3600);
  const minutes = Math.floor((safeValue % 3600) / 60);
  const seconds = safeValue % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function describeSocketStatus(status: SocketStatus) {
  if (status === "connected") {
    return "Live sync connected";
  }

  if (status === "connecting") {
    return "Connecting live sync";
  }

  if (status === "disconnected") {
    return "Live sync reconnecting";
  }

  if (status === "error") {
    return "Live sync needs attention";
  }

  return "Live sync idle";
}

function describeRoomState(state: Room["state"]) {
  return state === "live" ? "Live session" : "Session ended";
}

function describeAccessState(state: AccessState) {
  const labels: Record<AccessState, string> = {
    banned: "Banned from this room",
    blocked: "Access blocked",
    checking: "Checking access",
    ended: "Session ended",
    full: "Room full",
    joined: "Inside the room",
    kicked: "Removed by host",
    left: "You left",
    password_required: "Password required"
  };

  return labels[state];
}

function clampPlaybackPosition(value: number, durationSeconds: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  if (durationSeconds > 0) {
    return Math.min(Math.max(0, safeValue), durationSeconds);
  }

  return Math.max(0, safeValue);
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
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [moderationFeedback, setModerationFeedback] = useState<string | null>(null);
  const [participant, setParticipant] = useState<RoomParticipant | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>(defaultPlayback);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [presenceParticipants, setPresenceParticipants] = useState<RoomParticipant[]>([]);
  const [privatePassword, setPrivatePassword] = useState("");
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("harassment");
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [roomLinkFeedback, setRoomLinkFeedback] = useState<string | null>(null);
  const [seekTargetSeconds, setSeekTargetSeconds] = useState(0);
  const [isAdjustingSeek, setIsAdjustingSeek] = useState(false);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("idle");
  const socketRef = useRef<RoomRealtimeSocket | null>(null);
  const roomId = readRoomId();
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const isHost = currentUser?.id === room?.host.id;
  const isEnded = accessState === "ended" || room?.state === "ended";
  const canUseRoom = accessState === "joined" && participant?.state === "active" && !isEnded;
  const roomSharePath = room ? `/room?roomId=${room.id}` : "";
  const roomShareUrl = room ? `${window.location.origin}${roomSharePath}` : "";

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
      setPlaybackDuration(0);
      setPlaybackPosition(0);
      setSeekTargetSeconds(0);
      setIsAdjustingSeek(false);
      setPlayerError(null);
      setPresenceParticipants([]);
      setRealtimeError(null);
      setReportDetails("");
      setReportFeedback(null);
      setReportTarget(null);
      setRoom(null);
      setRoomLinkFeedback(null);

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
          setRealtimeError(describeRealtimeError(ack.error.code, ack.error.message, "Live room updates could not start."));
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
      setRealtimeError(safeErrorText(socketError, "Live room updates could not connect."));
    });

    socket.on("disconnect", () => {
      setSocketStatus("disconnected");
    });

    socket.on("connection.ready", () => {
      setSocketStatus("connected");
    });

    socket.on("connection.error", (payload) => {
      setSocketStatus("error");
      setRealtimeError(describeRealtimeError(payload.code, payload.message, "Live room updates were interrupted."));
    });

    socket.on("access.feedback", (payload) => {
      const safeMessage = describeRealtimeError(payload.code, payload.message, "Room access is currently unavailable.");
      setRealtimeError(safeMessage);

      if (payload.code === "ROOM_USER_BANNED") {
        setAccessState("banned");
        setError(safeMessage);
      }
    });

    socket.on("room.state.snapshot", (payload) => {
      setRoom(payload.room);
      setPresenceParticipants(payload.participants);
      setPlayback(payload.playback);
      setPlaybackPosition(payload.playback.positionSeconds);
      setSeekTargetSeconds(payload.playback.positionSeconds);
      setIsAdjustingSeek(false);

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
      setSeekTargetSeconds(payload.playback.positionSeconds);
      setIsAdjustingSeek(false);
    });

    socket.on("room.access.revoked", (payload) => {
      if (payload.roomId !== activeRoomId) {
        return;
      }

      const nextMessage =
        payload.actionType === "ban"
          ? "The host blocked you from rejoining this room."
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
      setRealtimeError("This room has ended.");
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
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : describeApiError(caughtError, "Message could not be sent. Try again in a moment.")
      );
    } finally {
      setIsSendingMessage(false);
    }
  }

  function handlePlaybackTimeUpdate(positionSeconds: number) {
    setPlaybackPosition(positionSeconds);

    if (!isAdjustingSeek) {
      setSeekTargetSeconds(positionSeconds);
    }
  }

  function handlePlaybackDurationUpdate(durationSeconds: number) {
    setPlaybackDuration(Math.max(0, durationSeconds));
  }

  async function handlePlaybackSet(
    status: PlaybackState["status"],
    positionSeconds = playbackPosition,
    actionType: PlaybackActionType = status === "playing" ? "play" : "pause"
  ) {
    if (!room) {
      return;
    }

    const socket = socketRef.current;
    const nextPosition = clampPlaybackPosition(positionSeconds, playbackDuration);

    if (!socket?.connected) {
      setRealtimeError("Live sync is still connecting. Try again in a moment.");
      return;
    }

    socket.emit(
      "playback.state.set",
      {
        actionType,
        positionSeconds: nextPosition,
        requestId: makeRequestId(),
        roomId: room.id,
        sourceTime: new Date().toISOString(),
        status
      },
      (ack) => {
        if (!ack.ok) {
          setRealtimeError(describeRealtimeError(ack.error.code, ack.error.message, "Playback sync could not update."));
          return;
        }

        if (ack.data?.playback) {
          setPlayback(ack.data.playback);
          setPlaybackPosition(ack.data.playback.positionSeconds);
          setSeekTargetSeconds(ack.data.playback.positionSeconds);
          setIsAdjustingSeek(false);
        }
      }
    );
  }

  function handleSeekPlayback() {
    void handlePlaybackSet(playback.status, seekTargetSeconds, "seek");
  }

  function handleSeekTargetChange(value: number) {
    setIsAdjustingSeek(true);
    setSeekTargetSeconds(clampPlaybackPosition(value, playbackDuration));
  }

  function handleJumpSeek(offsetSeconds: number) {
    const nextTarget = clampPlaybackPosition(playbackPosition + offsetSeconds, playbackDuration);
    setSeekTargetSeconds(nextTarget);
    setIsAdjustingSeek(false);
    void handlePlaybackSet(playback.status, nextTarget, offsetSeconds < 0 ? "jump_backward" : "jump_forward");
  }

  async function handleModerationAction(targetUserId: string, actionType: ModerationActionType) {
    if (!room) {
      return;
    }

    if (actionType === "ban" && !window.confirm("Block this participant from rejoining this room?")) {
      return;
    }

    setError(null);
    setModerationFeedback(null);
    setIsApplyingModeration(`${actionType}:${targetUserId}`);

    try {
      const action = await applyRoomModerationAction(room.id, {
        actionType,
        reason: actionType === "ban" ? "Host blocked this participant from the room." : "Host removed this participant from the room.",
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

  async function handleCopyRoomLink() {
    if (!roomShareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(roomShareUrl);
      setRoomLinkFeedback(
        room?.visibility === "private"
          ? "Private invite link copied. The room stays hidden, and invited members still need the password."
          : "Room link copied. Anyone with access can open the live room from this link."
      );
    } catch {
      setRoomLinkFeedback("Copy failed. Select the room URL from your browser address bar.");
    }
  }

  function handleReEnterRoom() {
    if (!room) {
      return;
    }

    setError(null);

    if (room.visibility === "private" && !isHost) {
      setAccessState("password_required");
      return;
    }

    void joinAndLoadRoom(room.id);
  }

  async function handleCloseRoom() {
    if (!room) {
      return;
    }

    if (!window.confirm("End this room for everyone? The live session, chat, and entry will close immediately.")) {
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

    if (isHost && !window.confirm("Leaving as host ends this room for everyone immediately. Continue?")) {
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
        <InlineLoader label="Entering room session and checking access" />
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
        <p className="form-error" role="alert">{error}</p>
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
        <div className="room-hero-copy">
          <p className="eyebrow">
            {room.visibility === "private" ? "Private live room" : "Public live room"}
          </p>
          <h2>{room.title}</h2>
          <div className="room-host-line">
            <Avatar displayName={room.host.displayName} src={room.host.avatarUrl} />
            <p>
              <strong>{room.host.displayName}</strong> is hosting this shared YouTube session.
              {isHost
                ? " You control playback, moderation, and when the room ends."
                : " You are joining the host's current live moment."}
            </p>
          </div>
          <div className="room-meta-strip">
            <span>{room.category.name}</span>
            <span>{room.activeParticipantCount}/{room.participantLimit} active</span>
            <span>{room.visibility === "private" ? "Invite link + password" : "Discoverable public room"}</span>
            <span title={room.source.title ?? undefined}>{room.source.title ?? `${room.source.provider} video`}</span>
          </div>
        </div>
        <div className="room-hero-actions">
          <div className="room-status-stack">
            <span className={`socket-pill ${socketStatus}`}>{describeSocketStatus(socketStatus)}</span>
            <span className={`state-pill ${room.state}`}>{describeRoomState(room.state)}</span>
          </div>
          <button className="secondary-action compact" onClick={() => void handleCopyRoomLink()} type="button">
            Copy room link
          </button>
          {isHost && !isEnded ? (
            <div className="host-control-strip" aria-label="Host room controls">
              <span>Host-only room control</span>
              <button className="danger-action compact" disabled={isClosing} onClick={() => void handleCloseRoom()} type="button">
                {isClosing ? "Ending room..." : "End room for everyone"}
              </button>
            </div>
          ) : null}
          {canUseRoom ? (
            <button className="secondary-action compact" disabled={isLeaving} onClick={() => void handleLeaveRoom()} type="button">
              {isLeaving ? "Leaving..." : isHost ? "Leave and end session" : "Leave room"}
            </button>
          ) : null}
        </div>
      </header>

      {roomLinkFeedback ? <p aria-live="polite" className="state-banner success room-feedback-banner" role="status">{roomLinkFeedback}</p> : null}

      <div className="room-session-grid">
        <main className="watch-panel room-stage">
          {canUseRoom ? (
            <YouTubeRoomPlayer
              canUseRoom={canUseRoom}
              isEnded={isEnded}
              isHost={Boolean(isHost)}
              onDurationUpdate={handlePlaybackDurationUpdate}
              onPlayerError={setPlayerError}
              onPlayerReady={setIsPlayerReady}
              onTimeUpdate={handlePlaybackTimeUpdate}
              playback={playback}
              videoId={room.source.videoId}
            />
          ) : (
            <div className="video-plane">
              {room.source.thumbnailUrl ? <img alt="" height="720" src={room.source.thumbnailUrl} width="1280" /> : null}
              <div className="video-plane-overlay">
                <span>{isEnded ? "Room ended" : "Entry required"}</span>
              </div>
            </div>
          )}

          {isEnded ? (
            <div className="state-banner">
              <p>
                This live session has ended. The shared player and chat are now closed, and the
                room is no longer joinable.
              </p>
              <div className="action-row">
                <button className="secondary-action compact" onClick={() => onNavigate("/discover")} type="button">
                  Back to Discover
                </button>
                <button className="primary-action compact" onClick={() => onNavigate("/create-room")} type="button">
                  Create a new room
                </button>
              </div>
            </div>
          ) : accessState === "full" ? (
            <div className="state-banner danger">
              <p>
                This room is at capacity right now. You can try again later if a spot opens,
                or find another live room in Discover.
              </p>
              <button className="secondary-action compact" onClick={() => onNavigate("/discover")} type="button">
                Find another room
              </button>
            </div>
          ) : accessState === "banned" ? (
            <div className="state-banner danger">
              <p>
                The host has blocked this account from rejoining this room. A direct link or
                private password cannot bypass that room-level restriction.
              </p>
              <button className="secondary-action compact" onClick={() => onNavigate("/discover")} type="button">
                Back to Discover
              </button>
            </div>
          ) : accessState === "kicked" ? (
            <div className="state-banner">
              <p>
                You were removed by the host. If this was only a kick, you may try to re-enter;
                if the host blocked you, entry will stay closed.
              </p>
              <div className="action-row">
                <button className="secondary-action compact" onClick={handleReEnterRoom} type="button">
                  Try re-entering
                </button>
                <button className="text-action compact" onClick={() => onNavigate("/discover")} type="button">
                  Back to Discover
                </button>
              </div>
            </div>
          ) : accessState === "left" ? (
            <div className="state-banner">
              <p>
                You left the live room. The session can keep going without you, and re-entry
                will sync you back to the host's current moment.
              </p>
              <div className="action-row">
                <button className="secondary-action compact" onClick={handleReEnterRoom} type="button">
                  Re-enter room
                </button>
                <button className="text-action compact" onClick={() => onNavigate("/discover")} type="button">
                  Back to Discover
                </button>
              </div>
            </div>
          ) : accessState === "password_required" ? (
            <form className="private-entry state-card" onSubmit={handlePrivatePassword}>
              <div>
                <p className="eyebrow">Private room entry</p>
                <h3>Enter the room password.</h3>
                <p>
                  This room is hidden from Discover. The invite link brings you to the door;
                  the host's password lets you enter the live session.
                </p>
              </div>
              <label>
                Private room password
                <input
                  onChange={(event) => setPrivatePassword(event.target.value)}
                  placeholder="Password from the host"
                  required
                  type="password"
                  value={privatePassword}
                />
              </label>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              <div className="action-row">
                <button className="primary-action compact" disabled={isUnlocking} type="submit">
                  {isUnlocking ? "Checking..." : "Enter private room"}
                </button>
                <button className="secondary-action compact" onClick={() => onNavigate("/discover")} type="button">
                  Back to Discover
                </button>
              </div>
            </form>
          ) : canUseRoom ? (
            <div className={isHost ? "playback-panel host-playback-panel" : "playback-panel participant-playback-panel"}>
              <div>
                <p className="eyebrow">Shared YouTube playback</p>
                <h3>{isHost ? "Host timeline control" : "Following the host timeline"}</h3>
                <p>
                  {playback.status === "playing" ? "Playing" : "Paused"} at {formatPlaybackTime(playbackPosition)} / {playbackDuration > 0 ? formatPlaybackTime(playbackDuration) : "--:--"}.
                  {" "}Last host sync {formatMessageTime(playback.updatedAt)}.
                </p>
                {playerError ? <p className="form-error" role="alert">{playerError}</p> : null}
              </div>
              {isHost ? (
                <div className="playback-controls">
                  <div className="playback-timeline">
                    <div className="timeline-label-row">
                      <span>Timeline</span>
                      <strong>{formatPlaybackTime(seekTargetSeconds)}</strong>
                    </div>
                    <input
                      aria-label="Playback timeline"
                      disabled={!isPlayerReady || playbackDuration <= 0}
                      max={Math.max(1, Math.floor(playbackDuration || seekTargetSeconds || playbackPosition || 1))}
                      min={0}
                      onChange={(event) => handleSeekTargetChange(Number(event.target.value))}
                      step={1}
                      type="range"
                      value={clampPlaybackPosition(seekTargetSeconds, playbackDuration)}
                    />
                    <p>
                      Drag the timeline, then sync every participant to that shared moment.
                    </p>
                  </div>
                  <div className="playback-jump-row">
                    <button
                      className="secondary-action compact"
                      disabled={!isPlayerReady}
                      onClick={() => handleJumpSeek(-10)}
                      type="button"
                    >
                      -10s
                    </button>
                    <button
                      className="secondary-action compact"
                      disabled={!isPlayerReady}
                      onClick={() => handleJumpSeek(10)}
                      type="button"
                    >
                      +10s
                    </button>
                  </div>
                  <button
                    className="secondary-action compact"
                    disabled={!isPlayerReady}
                    onClick={handleSeekPlayback}
                    type="button"
                  >
                    Sync to timeline
                  </button>
                  <button
                    className="secondary-action compact"
                    disabled={!isPlayerReady}
                    onClick={() => void handlePlaybackSet("paused")}
                    type="button"
                  >
                    Pause
                  </button>
                  <button
                    className="primary-action compact"
                    disabled={!isPlayerReady}
                    onClick={() => void handlePlaybackSet("playing")}
                    type="button"
                  >
                    Play
                  </button>
                </div>
              ) : (
                <p className="state-banner success">
                  Realtime playback follows the host. You can watch and chat, while the shared
                  timeline stays host-led.
                </p>
              )}
            </div>
          ) : (
            <p className="state-banner">{error ?? "Room access is being checked."}</p>
          )}
        </main>

        <aside className="room-side participant-panel">
          <p className="eyebrow">Room presence</p>
          <h3>
            {room.activeParticipantCount}/{room.participantLimit} active
          </h3>
          <p className="panel-intro">
            The host leads the session. Participants bring the room to life through presence,
            chat, and reports when something needs attention.
          </p>
          <dl className="room-facts">
            <div>
              <dt>Host</dt>
              <dd>{room.host.displayName}</dd>
            </div>
            <div>
              <dt>Your state</dt>
              <dd>{participant?.state === "active" ? describeAccessState(accessState) : participant?.state ?? describeAccessState(accessState)}</dd>
            </div>
            <div>
              <dt>Your role</dt>
              <dd>{participant?.role ?? "not joined"}</dd>
            </div>
            <div>
              <dt>Live presence</dt>
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
                  <div className="presence-identity">
                    <Avatar displayName={nextParticipant.user.displayName} src={nextParticipant.user.avatarUrl} />
                    <span>
                      <strong>{nextParticipant.user.displayName}</strong>
                      <small>{nextParticipant.role === "host" ? "Host" : "Participant"}</small>
                    </span>
                  </div>
                  <div className="participant-actions">
                    {nextParticipant.user.id !== currentUser?.id ? (
                      <>
                        <button className="text-action compact" onClick={() => onNavigate(`/users/${encodeURIComponent(nextParticipant.user.username)}`)} type="button">Profile</button>
                        <RelationshipActions compact reportRoomId={room.id} showReport={false} targetLabel={nextParticipant.user.displayName} targetUserId={nextParticipant.user.id} />
                      </>
                    ) : null}
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
                          Remove
                        </button>
                        <button
                          className="danger-action compact"
                          disabled={isApplyingModeration === `ban:${nextParticipant.user.id}`}
                          onClick={() => void handleModerationAction(nextParticipant.user.id, "ban")}
                          type="button"
                        >
                          Block
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">
              {canUseRoom
                ? "You are in the room. Other connected participants will appear here as they join the live moment."
                : "Participant presence becomes visible after you enter the live room."}
            </p>
          )}
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
              <p>
                Reports keep room, user, and message context attached so the platform can
                review the situation later.
              </p>
            )}
          </div>
          {moderationFeedback ? <p aria-live="polite" className="state-banner success" role="status">{moderationFeedback}</p> : null}
          {reportFeedback ? <p aria-live="polite" className="state-banner success" role="status">{reportFeedback}</p> : null}
          {error && accessState !== "password_required" ? <p className="form-error" role="alert">{error}</p> : null}
          {realtimeError ? <p className="form-error" role="alert">{realtimeError}</p> : null}
        </aside>

        <section className={canUseRoom ? "chat-panel" : "chat-panel is-disabled"}>
          <div className="chat-header">
            <div>
              <p className="eyebrow">Room chat</p>
              <h3>Live reactions around this moment</h3>
            </div>
            <span>{messages.length} messages | {describeSocketStatus(socketStatus)}</span>
          </div>

          <div className="message-list">
            {canUseRoom && messages.length > 0 ? (
              messages.map((message) => (
                <article className="message-item" key={message.id}>
                  <div className="message-item-header">
                    <span className="message-author-line">
                      <Avatar displayName={message.author.displayName} size="small" src={message.author.avatarUrl} />
                      <span>
                        <strong>{message.author.displayName}</strong>
                        <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                      </span>
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
              <p className="empty-chat">
                No messages yet. Drop the first reaction when the moment hits.
              </p>
            ) : (
              <p className="empty-chat">
                Enter the live room to read and send chat for this session.
              </p>
            )}
          </div>

          <form className="message-form" onSubmit={handleSendMessage}>
            <textarea
              disabled={!canUseRoom || isSendingMessage}
              maxLength={500}
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder={canUseRoom ? "React to the room..." : "Chat opens after you enter"}
              rows={2}
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
