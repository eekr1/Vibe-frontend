import { useEffect, useRef, useState } from "react";
import type { PlaybackState } from "./realtimeClient";

type YouTubeRoomPlayerProps = {
  canUseRoom: boolean;
  isEnded: boolean;
  isHost: boolean;
  onPlayerError: (message: string | null) => void;
  onPlayerReady: (isReady: boolean) => void;
  onTimeUpdate: (positionSeconds: number) => void;
  playback: PlaybackState;
  videoId: string;
};

type YouTubePlayerEvent = {
  data: number;
  target: YouTubePlayer;
};

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubePlayerConstructor = new (
  element: HTMLElement,
  options: {
    events: {
      onError: (event: YouTubePlayerEvent) => void;
      onReady: () => void;
      onStateChange: (event: YouTubePlayerEvent) => void;
    };
    playerVars: Record<string, number | string>;
    videoId: string;
  }
) => YouTubePlayer;

declare global {
  interface Window {
    YT?: {
      Player: YouTubePlayerConstructor;
      PlayerState: {
        BUFFERING: number;
        CUED: number;
        ENDED: number;
        PAUSED: number;
        PLAYING: number;
        UNSTARTED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    const previousReadyHandler = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      resolve();
    };

    if (existingScript) {
      existingScript.addEventListener("error", () => reject(new Error("YouTube player API could not load.")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube player API could not load."));
    document.body.appendChild(script);
  });

  return youtubeApiPromise;
}

function getEffectivePlaybackPosition(playback: PlaybackState) {
  if (playback.status !== "playing") {
    return playback.positionSeconds;
  }

  const sourceTimestamp = new Date(playback.sourceTime).getTime();

  if (Number.isNaN(sourceTimestamp)) {
    return playback.positionSeconds;
  }

  const elapsedSeconds = Math.max(0, (Date.now() - sourceTimestamp) / 1000);
  return playback.positionSeconds + elapsedSeconds;
}

function getPlayerErrorMessage(code: number) {
  if (code === 2) {
    return "The YouTube video id is invalid.";
  }

  if (code === 5) {
    return "This video cannot be played in the embedded player.";
  }

  if (code === 100) {
    return "This video is unavailable or has been removed.";
  }

  if (code === 101 || code === 150) {
    return "The video owner does not allow embedded playback.";
  }

  return "The YouTube player hit an unknown playback error.";
}

export function YouTubeRoomPlayer({
  canUseRoom,
  isEnded,
  isHost,
  onPlayerError,
  onPlayerReady,
  onTimeUpdate,
  playback,
  videoId
}: YouTubeRoomPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const isApplyingRemoteStateRef = useRef(false);
  const [participantPlaybackEnabled, setParticipantPlaybackEnabled] = useState(isHost);
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready">("loading");

  useEffect(() => {
    let isMounted = true;
    let player: YouTubePlayer | null = null;

    setLoadState("loading");
    setParticipantPlaybackEnabled(isHost);
    onPlayerReady(false);
    onPlayerError(null);

    void loadYouTubeApi()
      .then(() => {
        if (!isMounted || !containerRef.current || !window.YT?.Player) {
          return;
        }

        player = new window.YT.Player(containerRef.current, {
          events: {
            onError: (event) => {
              const message = getPlayerErrorMessage(event.data);
              setLoadState("error");
              onPlayerError(message);
              onPlayerReady(false);
            },
            onReady: () => {
              playerRef.current = player;
              setLoadState("ready");
              onPlayerReady(true);
              onPlayerError(null);
            },
            onStateChange: (event) => {
              if (!isHost || isApplyingRemoteStateRef.current) {
                return;
              }

              if (
                event.data === window.YT?.PlayerState.PAUSED ||
                event.data === window.YT?.PlayerState.PLAYING
              ) {
                onTimeUpdate(event.target.getCurrentTime());
              }
            }
          },
          playerVars: {
            controls: isHost ? 1 : 0,
            disablekb: isHost ? 0 : 1,
            enablejsapi: 1,
            modestbranding: 1,
            playsinline: 1,
            rel: 0
          },
          videoId
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setLoadState("error");
        onPlayerReady(false);
        onPlayerError(error instanceof Error ? error.message : "YouTube player API could not load.");
      });

    return () => {
      isMounted = false;
      onPlayerReady(false);
      playerRef.current = null;
      player?.destroy();
    };
  }, [isHost, onPlayerError, onPlayerReady, onTimeUpdate, videoId]);

  useEffect(() => {
    if (!canUseRoom || isEnded || !playerRef.current || loadState !== "ready") {
      return;
    }

    const player = playerRef.current;
    const nextPosition = getEffectivePlaybackPosition(playback);
    const currentPosition = player.getCurrentTime();
    const driftSeconds = Math.abs(currentPosition - nextPosition);

    isApplyingRemoteStateRef.current = true;

    if (driftSeconds > 1.5) {
      player.seekTo(nextPosition, true);
    }

    if (playback.status === "playing" && (isHost || participantPlaybackEnabled)) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }

    window.setTimeout(() => {
      isApplyingRemoteStateRef.current = false;
    }, 250);
  }, [canUseRoom, isEnded, isHost, loadState, participantPlaybackEnabled, playback]);

  useEffect(() => {
    if (!canUseRoom || !playerRef.current || loadState !== "ready") {
      return;
    }

    const timer = window.setInterval(() => {
      const player = playerRef.current;

      if (!player) {
        return;
      }

      onTimeUpdate(player.getCurrentTime());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [canUseRoom, loadState, onTimeUpdate]);

  return (
    <div className={isHost ? "youtube-room-player" : "youtube-room-player participant-locked"}>
      <div ref={containerRef} className="youtube-iframe-target" />
      {loadState === "loading" ? (
        <div className="youtube-player-state">
          <span className="loader" />
          Loading YouTube player
        </div>
      ) : null}
      {loadState === "error" ? (
        <div className="youtube-player-state danger">
          YouTube player could not be started for this room.
        </div>
      ) : null}
      {!isHost && canUseRoom && !isEnded ? (
        <div className="participant-playback-lock">
          <span>Playback follows the host.</span>
          {!participantPlaybackEnabled && playback.status === "playing" ? (
            <button
              className="secondary-action compact"
              onClick={() => {
                setParticipantPlaybackEnabled(true);
                playerRef.current?.playVideo();
              }}
              type="button"
            >
              Enable synced playback
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
