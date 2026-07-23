import { ArrowRightIcon, PlusIcon, SparkleIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth, type CurrentUser } from "../auth/AuthContext";
import { EmptyState, RoomCardSkeleton, SectionError } from "../components/feedback";
import { Button } from "../components/ui";
import { RoomCard } from "../rooms/RoomCard";
import { listPublicRooms, type Room } from "../rooms/roomApi";

type HomeShellPageProps = {
  onNavigate: (path: string) => void;
};

type HomeRoomsState =
  | { rooms: Room[]; status: "error" }
  | { rooms: Room[]; status: "loading" }
  | { rooms: Room[]; status: "ready" };

export const HOME_ROOM_LIMIT = 6;

export function getHomeOpenRoomPath(currentUser: CurrentUser | null, isCheckingSession: boolean) {
  if (currentUser || isCheckingSession) return "/create-room";
  return "/auth?mode=login&returnTo=%2Fcreate-room";
}

export function selectHomeRooms(rooms: Room[]) {
  return rooms
    .filter((room) => room.visibility === "public" && room.state === "live")
    .slice(0, HOME_ROOM_LIMIT);
}

export function HomeShellPage({ onNavigate }: HomeShellPageProps) {
  const { currentUser, isCheckingSession } = useAuth();
  const [heroImageAvailable, setHeroImageAvailable] = useState(true);
  const [roomState, setRoomState] = useState<HomeRoomsState>({ rooms: [], status: "loading" });
  const requestSequence = useRef(0);

  const loadRooms = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setRoomState((current) => ({ rooms: current.rooms, status: "loading" }));

    try {
      const result = await listPublicRooms({ limit: HOME_ROOM_LIMIT });
      if (requestSequence.current !== requestId) return;
      setRoomState({ rooms: selectHomeRooms(result.rooms), status: "ready" });
    } catch {
      if (requestSequence.current !== requestId) return;
      setRoomState((current) => ({ rooms: current.rooms, status: "error" }));
    }
  }, []);

  useEffect(() => {
    void loadRooms();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadRooms]);

  const openRoomPath = getHomeOpenRoomPath(currentUser, isCheckingSession);
  const showInitialLoading = roomState.status === "loading" && roomState.rooms.length === 0;

  return (
    <div className="home-page">
      <section aria-labelledby="home-title" className="home-hero">
        <div className="home-hero-copy">
          <p className="home-kicker">
            <SparkleIcon aria-hidden="true" size={20} weight="fill" />
            <span>Enter the hall</span>
          </p>
          <h1 id="home-title">
            Turn a YouTube link into a <span>shared room.</span>
          </h1>
          <p className="home-hero-support">
            Watch together. Chat in the moment.<br />
            Meet people through shared rooms.
          </p>
          <div className="home-hero-actions">
            <Button className="home-cta home-cta--primary" onClick={() => onNavigate("/discover")} size="large" variant="primary">
              <span>Enter the hall</span>
              <ArrowRightIcon aria-hidden="true" size={20} weight="bold" />
            </Button>
            <Button className="home-cta" onClick={() => onNavigate(openRoomPath)} size="large" variant="secondary">
              <span>Open a room</span>
              <PlusIcon aria-hidden="true" size={20} weight="bold" />
            </Button>
          </div>
        </div>

        <figure aria-hidden="true" className={heroImageAvailable ? "home-hero-visual" : "home-hero-visual is-fallback"}>
          {heroImageAvailable ? (
            <img
              alt=""
              decoding="async"
              fetchPriority="high"
              height="896"
              loading="eager"
              onError={() => setHeroImageAvailable(false)}
              src="/images/vibehall-home-hall.webp"
              width="1792"
            />
          ) : null}
        </figure>
      </section>

      <section aria-labelledby="home-live-title" className="home-live-section">
        <header className="home-live-header">
          <div>
            <p className="home-live-eyebrow"><span aria-hidden="true" /> Live rooms right now</p>
            <h2 id="home-live-title">Step into a room that is already alive.</h2>
            <p>Join a room and start watching together.</p>
          </div>
          <Button className="home-view-all" onClick={() => onNavigate("/discover")} size="small" variant="text">
            <span>View all rooms</span>
            <ArrowRightIcon aria-hidden="true" size={17} weight="bold" />
          </Button>
        </header>

        {showInitialLoading ? (
          <div aria-busy="true" aria-label="Loading live rooms" className="home-room-track home-room-track--loading" role="status">
            <span className="visually-hidden">Loading live rooms</span>
            {Array.from({ length: 4 }, (_, index) => <RoomCardSkeleton key={index} />)}
          </div>
        ) : null}

        {roomState.status === "error" && roomState.rooms.length === 0 ? (
          <SectionError
            className="home-live-state"
            description="The rest of the hall is still available while we try that again."
            onRetry={loadRooms}
            title="We couldn’t load live rooms."
          />
        ) : null}

        {roomState.status === "ready" && roomState.rooms.length === 0 ? (
          <EmptyState
            action={<Button onClick={() => onNavigate(openRoomPath)} variant="primary">Open a room</Button>}
            className="home-live-state"
            description="Open the first room and give the hall somewhere to gather."
            title="The hall is quiet right now."
          />
        ) : null}

        {roomState.rooms.length > 0 ? (
          <div aria-label="Live rooms" className="home-room-track">
            {roomState.rooms.map((room) => <RoomCard key={room.id} onNavigate={onNavigate} room={room} />)}
          </div>
        ) : null}
      </section>
    </div>
  );
}