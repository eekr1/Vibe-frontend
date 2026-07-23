import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { EmptyState, InlineLoader, RoomCardSkeleton, SectionError } from "../components/feedback";
import { Button } from "../components/ui";
import { safeErrorText } from "../lib/errorMapping";
import { RoomCard } from "../rooms/RoomCard";
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

function getEmptyStateCopy(search: string, selectedCategory: RoomCategory | undefined) {
  if (search.trim()) {
    return {
      body: "Try a shorter search, clear the filters, or open the room others will notice first.",
      title: "No rooms match that search."
    };
  }

  if (selectedCategory) {
    return {
      body: `No public rooms are live in ${selectedCategory.name} right now. Browse all rooms or start one in this category.`,
      title: `No live ${selectedCategory.name} rooms yet.`
    };
  }

  return {
    body: "Public rooms appear here while they are live. Create one when you want to host the next shared moment.",
    title: "No public rooms are live right now."
  };
}

export function DiscoverShellPage({ onNavigate }: DiscoverShellPageProps) {
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [categorySlug, setCategorySlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DiscoverSort>("newest");
  const deferredSearch = useDeferredValue(search);
  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === categorySlug),
    [categories, categorySlug]
  );
  const activeFilterCount = Number(Boolean(search.trim())) + Number(Boolean(categorySlug));
  const emptyStateCopy = getEmptyStateCopy(search, selectedCategory);

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
          setError(safeErrorText(caughtError, "Categories could not be loaded."));
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
          setError(safeErrorText(caughtError, "Public rooms could not be loaded."));
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
  }, [categorySlug, deferredSearch, refreshKey, sort]);

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
      setError(safeErrorText(caughtError, "More public rooms could not be loaded."));
    } finally {
      setIsLoadingMore(false);
    }
  }

  function clearFilters() {
    setCategorySlug("");
    setSearch("");
  }

  const isInitialLoading = isLoading && rooms.length === 0 && !error;

  return (
    <section className="discover-page">
      <div className="discover-hero surface-panel">
        <div>
          <p className="eyebrow">Live public rooms</p>
          <h2>Find the room that feels alive right now.</h2>
          <p>
            Browse public sessions by title, host, or category. Guests can scan the room surface freely;
            entering a room keeps identity and safety clear.
          </p>
        </div>
        <div className="discover-hero-actions">
          <button className="primary-action compact" onClick={() => onNavigate("/create-room")} type="button">
            Create room
          </button>
          <button className="secondary-action compact" disabled={activeFilterCount === 0} onClick={clearFilters} type="button">
            Clear filters
          </button>
        </div>
      </div>

      <div className="discover-control-panel surface-panel">
        <label className="discover-search-field">
          <span>Search rooms</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a room, host, or category"
            type="search"
            value={search}
          />
        </label>

        <label>
          <span>Category</span>
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
          <span>Sort</span>
          <select onChange={(event) => setSort(event.target.value as DiscoverSort)} value={sort}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="discover-result-bar" aria-live="polite">
        <span>{isLoading ? "Looking for rooms" : `${rooms.length} ${rooms.length === 1 ? "room" : "rooms"} shown`}</span>
        <span>{selectedCategory?.name ?? "All categories"}</span>
        <span>{sortOptions.find((option) => option.value === sort)?.label}</span>
        {activeFilterCount > 0 ? <span>{activeFilterCount} active filter{activeFilterCount > 1 ? "s" : ""}</span> : null}
      </div>

      {isInitialLoading ? (
        <div className="room-card-grid" aria-label="Loading public rooms">
          {Array.from({ length: 6 }).map((_, index) => (
            <RoomCardSkeleton key={index} />
          ))}
        </div>
      ) : error && rooms.length === 0 ? (
        <SectionError
          className="discover-state-panel"
          description={error}
          onRetry={() => setRefreshKey((current) => current + 1)}
          title="Discover could not refresh."
        />
      ) : rooms.length > 0 ? (
        <>
          {isLoading ? <InlineLoader label="Refreshing rooms" /> : null}
          {error ? (
            <SectionError
              className="discover-state-panel"
              description={`${error} Showing the latest available rooms.`}
              onRetry={() => setRefreshKey((current) => current + 1)}
              title="Discover could not refresh."
            />
          ) : null}
          <div className="room-card-grid">
            {rooms.map((room) => (
              <RoomCard key={room.id} onNavigate={onNavigate} room={room} />
            ))}
          </div>

          {nextCursor ? (
            <Button
              className="discover-load-more"
              loading={isLoadingMore}
              loadingLabel="Loading more rooms"
              onClick={() => void handleLoadMore()}
            >
              Load more rooms
            </Button>
          ) : null}
        </>
      ) : (
        <EmptyState
          action={<div className="action-row">
            {activeFilterCount > 0 ? (
              <Button onClick={clearFilters} size="small">
                Clear filters
              </Button>
            ) : null}
            <Button onClick={() => onNavigate("/create-room")} size="small" variant="primary">
              Create room
            </Button>
          </div>}
          className="discover-state-panel"
          description={emptyStateCopy.body}
          title={emptyStateCopy.title}
          variant={activeFilterCount > 0 ? "no-results" : "no-data"}
        />
      )}
    </section>
  );
}
