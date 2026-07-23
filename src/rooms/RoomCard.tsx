import { ArrowRightIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useEffect, useState, type ImgHTMLAttributes } from "react";

import { MediaPlaceholder } from "../components/feedback";
import { Avatar, Badge, StatusIndicator } from "../components/ui";
import type { Room } from "./roomApi";

export type RoomCardProps = {
  onNavigate: (path: string) => void;
  room: Room;
  thumbnailLoading?: ImgHTMLAttributes<HTMLImageElement>["loading"];
};

type ThumbnailState = "error" | "loaded" | "loading";

function getThumbnailState(thumbnailUrl: string | null): ThumbnailState {
  return thumbnailUrl ? "loading" : "error";
}

function getRoomEntryLabel(room: Room) {
  return `Enter ${room.title}, hosted by ${room.host.displayName}. Live ${room.category.name} room with ${room.activeParticipantCount} of ${room.participantLimit} people inside.`;
}

export function RoomCard({ onNavigate, room, thumbnailLoading = "lazy" }: RoomCardProps) {
  const thumbnailUrl = room.source.thumbnailUrl;
  const [thumbnailState, setThumbnailState] = useState<ThumbnailState>(() => getThumbnailState(thumbnailUrl));

  useEffect(() => {
    setThumbnailState(getThumbnailState(thumbnailUrl));
  }, [thumbnailUrl]);

  if (room.visibility !== "public" || room.state !== "live") {
    return null;
  }

  const capacityLabel = room.card?.capacityLabel ?? `${room.activeParticipantCount}/${room.participantLimit}`;
  const thumbnailAlt = room.card?.thumbnailAlt?.trim() || `${room.title} YouTube thumbnail`;
  const showThumbnail = Boolean(thumbnailUrl && thumbnailState !== "error");

  return (
    <div className="room-card-frame" data-thumbnail-state={thumbnailState}>
      {thumbnailUrl && thumbnailState === "loaded" ? (
        <img
          alt=""
          aria-hidden="true"
          className="room-card-aura"
          decoding="async"
          loading={thumbnailLoading}
          src={thumbnailUrl}
        />
      ) : null}

      <button
        aria-label={getRoomEntryLabel(room)}
        className="room-card"
        onClick={() => onNavigate(`/room?roomId=${encodeURIComponent(room.id)}`)}
        type="button"
      >
        <span className="room-card-media">
          {thumbnailState !== "loaded" ? (
            <MediaPlaceholder
              className="room-card-media-placeholder"
              label={thumbnailState === "error" ? `Thumbnail unavailable for ${room.title}` : `Loading thumbnail for ${room.title}`}
              state={thumbnailState === "error" ? "error" : "loading"}
            />
          ) : null}
          {showThumbnail ? (
            <img
              alt={thumbnailAlt}
              className="room-card-thumbnail"
              decoding="async"
              height="360"
              loading={thumbnailLoading}
              onError={() => setThumbnailState("error")}
              onLoad={() => setThumbnailState("loaded")}
              src={thumbnailUrl ?? undefined}
              width="640"
            />
          ) : null}
          <StatusIndicator className="room-card-live" label="Live" tone="success" />
        </span>

        <span className="room-card-body">
          <span className="room-card-meta">
            <span className="room-card-category">{room.category.name}</span>
            {room.card?.isNearlyFull ? <Badge kind="room" tone="warning">Nearly full</Badge> : null}
          </span>
          <span className="room-card-title">{room.title}</span>
          <span className="room-card-host">
            <Avatar displayName={room.host.displayName} size="small" src={room.host.avatarUrl} />
            <span className="room-card-host-copy">
              <span>Hosted by</span>
              <strong>{room.host.displayName}</strong>
            </span>
          </span>
          <span className="room-card-footer">
            <span className="room-card-participants">
              <UsersThreeIcon aria-hidden="true" size={17} weight="bold" />
              <span>{capacityLabel} inside</span>
            </span>
            <span aria-hidden="true" className="room-card-entry">
              Enter room
              <ArrowRightIcon size={16} weight="bold" />
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
