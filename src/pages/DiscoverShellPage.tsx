import { useDeferredValue, useEffect, useState } from "react";
import { ApiClientError } from "../lib/api";
import {
  listCategories,
  listPublicRooms,
  type DiscoverSort,
  type Room,
  type RoomCategory
} from "../rooms/roomApi";

type DiscoverShellPageProps = {
  onNavigate: (path: string) => void;
};

const sortOptions: Array<{ label: string; value: DiscoverSort }> = [
  { label: "Newest", value: "newest" },
  { label: "Most active", value: "active" },
  { label: "Nearly full", value: "nearly-full" }
];

export function DiscoverShellPage({ onNavigate }: DiscoverShellPageProps) {
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [categorySlug, setCategorySlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DiscoverSort>("newest");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const nextCategories = await listCategories();

        if (isMounted) {
          setCategories(nextCategories);
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof ApiClientError
              ? caughtError.message
              : "Categories could not be loaded."
          );
        }
      }
    }

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadRooms() {
      setError(null);
      setIsLoading(true);

      try {
        const result = await listPublicRooms({
          categorySlug: categorySlug || undefined,
          limit: 12,
          search: deferredSearch,
          sort
        });

        if (isMounted) {
          setRooms(result.rooms);
          setNextCursor(result.nextCursor);
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof ApiClientError
              ? caughtError.message
              : "Public rooms could not be loaded."
          );
          setRooms([]);
          setNextCursor(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRooms();

    return () => {
      isMounted = false;
    };
  }, [categorySlug, deferredSearch, sort]);

  async function handleLoadMore() {
    if (!nextCursor) {
      return;
    }

    setError(null);
    setIsLoadingMore(true);

    try {
      const result = await listPublicRooms({
        categorySlug: categorySlug || undefined,
        cursor: nextCursor,
        limit: 12,
        search: deferredSearch,
        sort
      });

      setRooms((currentRooms) => [...currentRooms, ...result.rooms]);
      setNextCursor(result.nextCursor);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "More public rooms could not be loaded."
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <section className="discover-layout">
      <div className="surface-panel wide-panel">
        <p className="eyebrow">Discover</p>
        <h2>Browse live public rooms.</h2>
        <p>
          Browse freely before logging in. When you choose a room, Vibehall keeps your intent
          and asks for login only when entry is needed.
        </p>

        <div className="discover-controls">
          <label>
            Search
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, host, or category"
              type="search"
              value={search}
            />
          </label>

          <label>
            Category
            <select onChange={(event) => setCategorySlug(event.target.value)} value={categorySlug}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sort
            <select onChange={(event) => setSort(event.target.value as DiscoverSort)} value={sort}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="discover-debug">
          <span>Live + public only</span>
          <span>{rooms.length} visible</span>
          <span>{sortOptions.find((option) => option.value === sort)?.label}</span>
        </div>

        {isLoading ? (
          <div className="inline-loading">
            <span className="loader" />
            Finding live public rooms
          </div>
        ) : error ? (
          <div className="empty-state danger">
            <h3>Public rooms could not be loaded.</h3>
            <p className="form-error">{error}</p>
            <button className="secondary-action" onClick={() => window.location.reload()} type="button">
              Reload Discover
            </button>
          </div>
        ) : rooms.length > 0 ? (
          <>
            <div className="room-card-grid">
              {rooms.map((room) => (
                <article className="room-card" key={room.id}>
                  {room.source.thumbnailUrl ? (
                    <img alt={room.card?.thumbnailAlt ?? ""} src={room.source.thumbnailUrl} />
                  ) : (
                    <div className="room-card-placeholder">YouTube</div>
                  )}
                  <div>
                    <div className="room-card-meta">
                      <p className="eyebrow">{room.category.name}</p>
                      {room.card?.isNearlyFull ? <span>Nearly full</span> : null}
                    </div>
                    <h3>{room.title}</h3>
                    <p>
                      Hosted by {room.host.displayName} | {room.card?.capacityLabel ??
                        `${room.activeParticipantCount}/${room.participantLimit}`}
                    </p>
                    <button
                      className="secondary-action compact"
                      onClick={() => onNavigate(`/room?roomId=${room.id}`)}
                      type="button"
                    >
                      Enter room
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {nextCursor ? (
              <button
                className="secondary-action discover-load-more"
                disabled={isLoadingMore}
                onClick={() => void handleLoadMore()}
                type="button"
              >
                {isLoadingMore ? "Loading more..." : "Load more rooms"}
              </button>
            ) : null}
          </>
        ) : (
          <div className="empty-state">
            <h3>No matching public rooms are live yet.</h3>
            <p>Try a wider search, clear the category filter, or create the room people will discover first.</p>
            <button className="primary-action" onClick={() => onNavigate("/create-room")} type="button">
              Create room
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
