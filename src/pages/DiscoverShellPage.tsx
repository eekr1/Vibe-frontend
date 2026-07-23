import { useEffect, useMemo, useRef, useState } from "react";

import {
  EmptyState,
  InlineError,
  InlineLoader,
  RoomCardSkeleton,
  SectionError
} from "../components/feedback";
import { Button, FormField, Input, Select } from "../components/ui";
import { safeErrorText } from "../lib/errorMapping";
import { RoomCard } from "../rooms/RoomCard";
import {
  listCategories,
  listPublicRooms,
  type DiscoverRoomsInput,
  type DiscoverSort,
  type Room,
  type RoomCategory
} from "../rooms/roomApi";

type DiscoverShellPageProps = {
  onNavigate: (path: string) => void;
};

export type DiscoverQueryState = {
  categorySlug: string;
  search: string;
  sort: DiscoverSort;
};

export const DISCOVER_ROOM_LIMIT = 12;
export const DISCOVER_SEARCH_MAX_LENGTH = 80;
export const DISCOVER_SEARCH_DELAY_MS = 320;

const defaultSort: DiscoverSort = "newest";
const supportedSorts = new Set<DiscoverSort>(["active", "nearly-full", "newest"]);
const sortOptions: Array<{ label: string; value: DiscoverSort }> = [
  { label: "Newest", value: "newest" },
  { label: "Most active", value: "active" },
  { label: "Nearly full", value: "nearly-full" }
];

function normalizeSearch(value: string) {
  return value.trim().slice(0, DISCOVER_SEARCH_MAX_LENGTH);
}

export function readDiscoverQuery(
  locationSearch: string,
  categories?: RoomCategory[]
): DiscoverQueryState {
  const params = new URLSearchParams(locationSearch);
  const requestedCategory = params.get("categorySlug")?.trim() ?? "";
  const requestedSort = params.get("sort") as DiscoverSort | null;
  const categorySlug = categories
    ? categories.some((category) => category.slug === requestedCategory)
      ? requestedCategory
      : ""
    : requestedCategory;

  return {
    categorySlug,
    search: normalizeSearch(params.get("search") ?? ""),
    sort: requestedSort && supportedSorts.has(requestedSort) ? requestedSort : defaultSort
  };
}

export function createDiscoverPath(query: DiscoverQueryState) {
  const params = new URLSearchParams();
  const search = normalizeSearch(query.search);

  if (search) params.set("search", search);
  if (query.categorySlug) params.set("categorySlug", query.categorySlug);
  if (query.sort !== defaultSort && supportedSorts.has(query.sort)) params.set("sort", query.sort);

  const queryString = params.toString();
  return queryString ? `/discover?${queryString}` : "/discover";
}

export function createDiscoverRequest(
  query: DiscoverQueryState,
  cursor?: string | null
): DiscoverRoomsInput {
  return {
    categorySlug: query.categorySlug || undefined,
    cursor: cursor || undefined,
    limit: DISCOVER_ROOM_LIMIT,
    search: normalizeSearch(query.search) || undefined,
    sort: supportedSorts.has(query.sort) ? query.sort : defaultSort
  };
}

export function selectDiscoverRooms(rooms: Room[]) {
  return rooms.filter((room) => room.visibility === "public" && room.state === "live");
}

export function getDiscoverEmptyStateCopy(
  search: string,
  selectedCategory: RoomCategory | undefined
) {
  if (normalizeSearch(search)) {
    return {
      body: "Try a shorter search, clear the search, or open the room others will notice first.",
      title: "No rooms match your search."
    };
  }

  if (selectedCategory) {
    return {
      body: `No public rooms are live in ${selectedCategory.name} right now. Browse all rooms or start one in this category.`,
      title: `No live ${selectedCategory.name} rooms yet.`
    };
  }

  return {
    body: "The hall is ready when someone opens a room. You can be the first host here.",
    title: "The hall is quiet right now."
  };
}

export function DiscoverShellPage({ onNavigate }: DiscoverShellPageProps) {
  const initialQuery = useMemo(() => readDiscoverQuery(window.location.search), []);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryRefreshKey, setCategoryRefreshKey] = useState(0);
  const [categoryStatus, setCategoryStatus] = useState<"error" | "loading" | "ready">("loading");
  const [categorySlug, setCategorySlug] = useState(initialQuery.categorySlug);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.search);
  const [hasResolvedRooms, setHasResolvedRooms] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [resultAnnouncement, setResultAnnouncement] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [search, setSearch] = useState(initialQuery.search);
  const [sort, setSort] = useState<DiscoverSort>(initialQuery.sort);
  const categoryRequestSequence = useRef(0);
  const loadMoreSequence = useRef(0);
  const queryRequestSequence = useRef(0);
  const activeQueryKey = useRef("");
  const skipSearchHistoryWrite = useRef(false);
  const queryStateRef = useRef<DiscoverQueryState>(initialQuery);

  const appliedCategorySlug = useMemo(
    () => categories.some((category) => category.slug === categorySlug) ? categorySlug : "",
    [categories, categorySlug]
  );
  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === appliedCategorySlug),
    [appliedCategorySlug, categories]
  );
  const appliedQuery = useMemo<DiscoverQueryState>(
    () => ({ categorySlug: appliedCategorySlug, search: debouncedSearch, sort }),
    [appliedCategorySlug, debouncedSearch, sort]
  );
  const activeFilterCount =
    Number(Boolean(normalizeSearch(debouncedSearch))) + Number(Boolean(appliedCategorySlug));
  const emptyStateCopy = getDiscoverEmptyStateCopy(debouncedSearch, selectedCategory);
  const isInitialLoading = !hasResolvedRooms && !pageError;
  const isCategoryQueryPending = Boolean(categorySlug && categoryStatus === "loading");

  queryStateRef.current = { categorySlug: appliedCategorySlug, search, sort };

  function navigateWithQuery(nextQuery: DiscoverQueryState) {
    const nextPath = createDiscoverPath(nextQuery);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    queryStateRef.current = nextQuery;
    if (nextPath !== currentPath) onNavigate(nextPath);
  }

  function updateCategory(nextCategorySlug: string) {
    setCategorySlug(nextCategorySlug);
    navigateWithQuery({ ...queryStateRef.current, categorySlug: nextCategorySlug });
  }

  function updateSort(nextSort: DiscoverSort) {
    setSort(nextSort);
    navigateWithQuery({ ...queryStateRef.current, sort: nextSort });
  }

  function clearSearch() {
    setSearch("");
    setDebouncedSearch("");
    navigateWithQuery({ ...queryStateRef.current, search: "" });
  }

  function clearFilters() {
    setCategorySlug("");
    setSearch("");
    setDebouncedSearch("");
    navigateWithQuery({ ...queryStateRef.current, categorySlug: "", search: "" });
  }

  useEffect(() => {
    const requestId = ++categoryRequestSequence.current;
    setCategoryError(null);
    setCategoryStatus("loading");

    async function loadCategoryOptions() {
      try {
        const nextCategories = await listCategories();
        if (categoryRequestSequence.current !== requestId) return;

        const locationQuery = readDiscoverQuery(window.location.search, nextCategories);
        setCategories(nextCategories);
        setCategorySlug(locationQuery.categorySlug);
        setCategoryStatus("ready");
      } catch (caughtError) {
        if (categoryRequestSequence.current !== requestId) return;
        setCategories([]);
        setCategoryError(safeErrorText(caughtError, "Categories could not be loaded."));
        setCategoryStatus("error");
      }
    }

    void loadCategoryOptions();
    return () => {
      categoryRequestSequence.current += 1;
    };
  }, [categoryRefreshKey]);

  useEffect(() => {
    function syncQueryFromLocation() {
      const nextQuery = readDiscoverQuery(
        window.location.search,
        categoryStatus === "ready" ? categories : undefined
      );
      skipSearchHistoryWrite.current = nextQuery.search !== queryStateRef.current.search;
      queryStateRef.current = nextQuery;
      setCategorySlug(nextQuery.categorySlug);
      setDebouncedSearch(nextQuery.search);
      setSearch(nextQuery.search);
      setSort(nextQuery.sort);
    }

    window.addEventListener("popstate", syncQueryFromLocation);
    return () => window.removeEventListener("popstate", syncQueryFromLocation);
  }, [categories, categoryStatus]);

  useEffect(() => {
    if (skipSearchHistoryWrite.current) {
      skipSearchHistoryWrite.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextSearch = normalizeSearch(queryStateRef.current.search);
      setDebouncedSearch(nextSearch);
      navigateWithQuery({ ...queryStateRef.current, search: nextSearch });
    }, DISCOVER_SEARCH_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (isCategoryQueryPending) return;

    const requestId = ++queryRequestSequence.current;
    loadMoreSequence.current += 1;
    const queryKey = JSON.stringify(appliedQuery);
    activeQueryKey.current = queryKey;
    setIsLoadingMore(false);
    setIsRefreshing(hasResolvedRooms);
    setLoadMoreError(null);
    setNextCursor(null);
    setPageError(null);

    async function loadRooms() {
      try {
        const result = await listPublicRooms(createDiscoverRequest(appliedQuery));
        if (queryRequestSequence.current !== requestId) return;

        const visibleRooms = selectDiscoverRooms(result.rooms);
        setRooms(visibleRooms);
        setNextCursor(result.nextCursor);
        setResultAnnouncement(
          `${visibleRooms.length} ${visibleRooms.length === 1 ? "room" : "rooms"} shown.`
        );
        setHasResolvedRooms(true);
      } catch (caughtError) {
        if (queryRequestSequence.current !== requestId) return;
        setPageError(safeErrorText(caughtError, "Public rooms could not be loaded."));
        setHasResolvedRooms(true);
      } finally {
        if (queryRequestSequence.current === requestId) setIsRefreshing(false);
      }
    }

    void loadRooms();
    return () => {
      queryRequestSequence.current += 1;
    };
  }, [appliedQuery, isCategoryQueryPending, refreshKey]);

  async function handleLoadMore() {
    const cursor = nextCursor;
    if (!cursor || isLoadingMore) return;

    const requestId = ++loadMoreSequence.current;
    const queryKey = activeQueryKey.current;
    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const result = await listPublicRooms(createDiscoverRequest(appliedQuery, cursor));
      if (loadMoreSequence.current !== requestId || activeQueryKey.current !== queryKey) return;

      const visibleRooms = selectDiscoverRooms(result.rooms);
      setRooms((currentRooms) => {
        const currentIds = new Set(currentRooms.map((room) => room.id));
        return [...currentRooms, ...visibleRooms.filter((room) => !currentIds.has(room.id))];
      });
      setNextCursor(result.nextCursor);
      setResultAnnouncement(
        `${visibleRooms.length} more ${visibleRooms.length === 1 ? "room" : "rooms"} loaded.`
      );
    } catch (caughtError) {
      if (loadMoreSequence.current !== requestId || activeQueryKey.current !== queryKey) return;
      setLoadMoreError(safeErrorText(caughtError, "More public rooms could not be loaded."));
    } finally {
      if (loadMoreSequence.current === requestId && activeQueryKey.current === queryKey) {
        setIsLoadingMore(false);
      }
    }
  }

  return (
    <section aria-labelledby="discover-title" className="discover-page">
      <header className="discover-heading">
        <div>
          <p className="discover-kicker">Live rooms, open now</p>
          <h1 id="discover-title">Discover</h1>
          <p>See what’s happening in Vibehall right now.</p>
        </div>
        <Button onClick={() => onNavigate("/create-room")} size="small" variant="primary">
          Open a room
        </Button>
      </header>

      <div aria-label="Discover room controls" className="discover-query-toolbar">
        <FormField className="discover-search-field" label="Search live rooms">
          <Input
            autoComplete="off"
            maxLength={DISCOVER_SEARCH_MAX_LENGTH}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search rooms, hosts or categories"
            type="search"
            value={search}
          />
        </FormField>

        <div className="discover-query-selects">
          <FormField label="Category">
            <Select
              disabled={categoryStatus === "loading"}
              onChange={(event) => updateCategory(event.target.value)}
              value={appliedCategorySlug}
            >
              <option value="">
                {categoryStatus === "loading" ? "Loading categories…" : "All categories"}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Sort rooms">
            <Select
              onChange={(event) => updateSort(event.target.value as DiscoverSort)}
              value={sort}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {categoryError ? (
          <InlineError
            className="discover-category-error"
            description={categoryError}
            onRetry={() => setCategoryRefreshKey((current) => current + 1)}
            retryLabel="Retry categories"
          />
        ) : null}
      </div>

      <div className="discover-result-bar">
        <div>
          {isInitialLoading ? (
            <span>Looking for rooms</span>
          ) : (
            <>
              <strong>{rooms.length}</strong>
              <span>{rooms.length === 1 ? " room shown" : " rooms shown"}</span>
            </>
          )}
        </div>
        <span>{selectedCategory?.name ?? "All categories"}</span>
        <span>{sortOptions.find((option) => option.value === sort)?.label}</span>
        {activeFilterCount > 0 && rooms.length > 0 ? (
          <Button onClick={clearFilters} size="small" variant="text">
            Clear filters
          </Button>
        ) : null}
        {isRefreshing ? <InlineLoader className="discover-refresh-status" label="Updating rooms" /> : null}
      </div>

      <span aria-atomic="true" aria-live="polite" className="visually-hidden">
        {resultAnnouncement}
      </span>

      {isInitialLoading ? (
        <ul aria-label="Loading public rooms" className="room-card-grid discover-room-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <li key={index}>
              <RoomCardSkeleton />
            </li>
          ))}
        </ul>
      ) : pageError && rooms.length === 0 ? (
        <SectionError
          className="discover-state-panel"
          description={pageError}
          onRetry={() => setRefreshKey((current) => current + 1)}
          title="We couldn’t load live rooms."
        />
      ) : rooms.length > 0 ? (
        <>
          {pageError ? (
            <SectionError
              className="discover-state-panel"
              description={`${pageError} Showing the latest available rooms.`}
              onRetry={() => setRefreshKey((current) => current + 1)}
              title="Live rooms couldn’t refresh."
            />
          ) : null}

          <section aria-labelledby="discover-results-title">
            <h2 className="visually-hidden" id="discover-results-title">Live rooms</h2>
            <ul aria-busy={isRefreshing} className="room-card-grid discover-room-grid">
              {rooms.map((room) => (
                <li key={room.id}>
                  <RoomCard onNavigate={onNavigate} room={room} />
                </li>
              ))}
            </ul>
          </section>

          {loadMoreError ? (
            <InlineError
              className="discover-load-more-error"
              description={loadMoreError}
              onRetry={handleLoadMore}
              retryLabel="Retry load more"
            />
          ) : null}

          {nextCursor ? (
            <Button
              className="discover-load-more"
              loading={isLoadingMore}
              loadingLabel="Loading more rooms"
              onClick={() => void handleLoadMore()}
              variant="secondary"
            >
              Load more rooms
            </Button>
          ) : null}
        </>
      ) : (
        <EmptyState
          action={
            <div className="action-row">
              {normalizeSearch(debouncedSearch) ? (
                <Button onClick={clearSearch} size="small">
                  Clear search
                </Button>
              ) : selectedCategory ? (
                <Button onClick={clearFilters} size="small">
                  Clear filters
                </Button>
              ) : null}
              <Button onClick={() => onNavigate("/create-room")} size="small" variant="primary">
                Open a room
              </Button>
            </div>
          }
          className="discover-state-panel"
          description={emptyStateCopy.body}
          title={emptyStateCopy.title}
          variant={activeFilterCount > 0 ? "no-results" : "no-data"}
        />
      )}
    </section>
  );
}
