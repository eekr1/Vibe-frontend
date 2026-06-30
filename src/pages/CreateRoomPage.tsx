import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AuthRequiredGate } from "../components/AuthRequiredGate";
import { ApiClientError } from "../lib/api";
import {
  createRoom,
  listCategories,
  type Room,
  type RoomCategory,
  type RoomVisibility
} from "../rooms/roomApi";

type CreateRoomPageProps = {
  onNavigate: (path: string) => void;
};

function getSourcePreview(url: string) {
  const trimmed = url.trim();

  if (!trimmed) {
    return {
      detail: "Paste a YouTube link to anchor the room around a shared video.",
      state: "empty" as const,
      title: "Waiting for a video link"
    };
  }

  try {
    const parsed = new URL(trimmed);
    const isYouTube = parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be");

    return {
      detail: isYouTube
        ? "This looks like a YouTube source. Backend validation will confirm it when you create the room."
        : "This link will be checked when you create the room. Vibehall currently supports YouTube sources.",
      state: isYouTube ? "valid" as const : "warning" as const,
      title: isYouTube ? "YouTube source ready" : "Source will need validation"
    };
  } catch {
    return {
      detail: "Enter a full video URL, including https://, so Vibehall can validate the source.",
      state: "warning" as const,
      title: "This does not look like a full URL yet"
    };
  }
}

export function CreateRoomPage({ onNavigate }: CreateRoomPageProps) {
  const { currentUser, isCheckingSession } = useAuth();
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [createdPrivateRoom, setCreatedPrivateRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteCopyStatus, setInviteCopyStatus] = useState<string | null>(null);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [participantLimit, setParticipantLimit] = useState(8);
  const [privatePassword, setPrivatePassword] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<RoomVisibility>("public");
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const sourcePreview = useMemo(() => getSourcePreview(sourceUrl), [sourceUrl]);
  const isReadyToCreate =
    !isCheckingSession &&
    !isLoadingCategories &&
    !isSubmitting &&
    Boolean(categoryId) &&
    title.trim().length >= 3 &&
    sourceUrl.trim().length > 0 &&
    (visibility === "public" || privatePassword.trim().length >= 4);

  const createdPrivateRoomPath = createdPrivateRoom ? `/room?roomId=${createdPrivateRoom.id}` : "";
  const createdPrivateRoomUrl = createdPrivateRoom
    ? `${window.location.origin}${createdPrivateRoomPath}`
    : "";

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const nextCategories = await listCategories();

        if (!isMounted) {
          return;
        }

        setCategories(nextCategories);
        setCategoryId(nextCategories[0]?.id ?? "");
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof ApiClientError
              ? caughtError.message
              : "Categories could not be loaded."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    }

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatedPrivateRoom(null);
    setError(null);
    setInviteCopyStatus(null);
    setIsSubmitting(true);

    try {
      const room = await createRoom({
        categoryId,
        participantLimit,
        privatePassword: visibility === "private" ? privatePassword : undefined,
        sourceUrl,
        title,
        visibility
      });

      if (room.visibility === "private") {
        setCreatedPrivateRoom(room);
      } else {
        onNavigate(`/room?roomId=${room.id}`);
      }
    } catch (caughtError) {
      if (caughtError instanceof ApiClientError) {
        setError(caughtError.message);
      } else {
        setError("Room could not be created. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyInviteLink() {
    if (!createdPrivateRoomUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdPrivateRoomUrl);
      setInviteCopyStatus("Invite link copied. Share it with the people you want in this private room.");
    } catch {
      setInviteCopyStatus("Copy failed. You can select the link manually below.");
    }
  }

  if (!isCheckingSession && !currentUser) {
    return (
      <AuthRequiredGate
        body="Rooms need a signed-in host so ownership, room endings, and moderation stay traceable."
        onLogin={() => onNavigate("/auth?mode=login&returnTo=%2Fcreate-room")}
        onSignup={() => onNavigate("/auth?mode=signup&returnTo=%2Fcreate-room")}
        title="Log in to host a Vibehall room."
      />
    );
  }

  return (
    <section className="create-room-layout launch-layout">
      <form className="room-form launch-form" onSubmit={handleSubmit}>
        <div className="form-section-heading">
          <p className="eyebrow">Create room</p>
          <h2>Launch a live room from one YouTube link.</h2>
          <p className="form-intro">
            Start with the video, then name the room and choose who can enter. Public rooms go to Discover;
            private rooms wait with an invite link you can copy first.
          </p>
        </div>

        <section className="launch-section">
          <p className="eyebrow">1. Video source</p>
          <label>
            YouTube source
            <input
              maxLength={2048}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              required
              type="url"
              value={sourceUrl}
            />
          </label>
          <div className={`source-preview-card ${sourcePreview.state}`}>
            <div className="source-preview-media">YouTube</div>
            <div>
              <h3>{sourcePreview.title}</h3>
              <p>{sourcePreview.detail}</p>
            </div>
          </div>
        </section>

        <section className="launch-section">
          <p className="eyebrow">2. Room identity</p>
          <label>
            Room title
            <span className="field-hint">This is what guests see in Discover and what members see inside the room.</span>
            <input
              maxLength={96}
              minLength={3}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Late night music videos"
              required
              type="text"
              value={title}
            />
          </label>

          <div className="form-grid">
            <label>
              Category
              <select
                disabled={isLoadingCategories || categories.length === 0}
                onChange={(event) => setCategoryId(event.target.value)}
                required
                value={categoryId}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Participant limit
              <input
                max={50}
                min={2}
                onChange={(event) => setParticipantLimit(Number(event.target.value))}
                required
                type="number"
                value={participantLimit}
              />
            </label>
          </div>
        </section>

        <section className="launch-section">
          <p className="eyebrow">3. Access</p>
          <fieldset className="visibility-switch visibility-cards">
            <legend>Who can find this room?</legend>
            <label className={visibility === "public" ? "is-selected" : ""}>
              <input
                checked={visibility === "public"}
                onChange={() => setVisibility("public")}
                type="radio"
              />
              <span>
                <strong>Public room</strong>
                <small>Appears in Discover while live.</small>
              </span>
            </label>
            <label className={visibility === "private" ? "is-selected" : ""}>
              <input
                checked={visibility === "private"}
                onChange={() => setVisibility("private")}
                type="radio"
              />
              <span>
                <strong>Private room</strong>
                <small>Uses invite link and password.</small>
              </span>
            </label>
          </fieldset>

          {visibility === "private" ? (
            <label>
              Private room password
              <span className="field-hint">
                People with the invite link still need this password before they can enter.
              </span>
              <input
                maxLength={80}
                minLength={4}
                onChange={(event) => setPrivatePassword(event.target.value)}
                required
                type="password"
                value={privatePassword}
              />
            </label>
          ) : null}
        </section>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        {createdPrivateRoom ? (
          <div className="private-invite-card">
            <p className="eyebrow">Private room ready</p>
            <h3>{createdPrivateRoom.title}</h3>
            <p>
              Send this link to the people you want inside. The room stays hidden from Discover,
              and guests still need the password you set.
            </p>
            <input aria-label="Private room invite link" readOnly value={createdPrivateRoomUrl} />
            {inviteCopyStatus ? <p aria-live="polite" className="state-banner success" role="status">{inviteCopyStatus}</p> : null}
            <div className="action-row">
              <button className="secondary-action compact" onClick={() => void handleCopyInviteLink()} type="button">
                Copy invite link
              </button>
              <button
                className="primary-action compact"
                onClick={() => onNavigate(createdPrivateRoomPath)}
                type="button"
              >
                Enter room
              </button>
            </div>
          </div>
        ) : null}

        <div className="launch-action-row">
          <button className="secondary-action" onClick={() => onNavigate("/discover")} type="button">
            Cancel
          </button>
          <button
            className="primary-action"
            disabled={!isReadyToCreate}
            type="submit"
          >
            {isSubmitting ? "Creating room..." : "Create live room"}
          </button>
        </div>
      </form>

      <aside className="create-room-aside launch-summary">
        <p className="eyebrow">Launch summary</p>
        <h3>Your room at a glance</h3>
        <dl className="create-debug-list">
          <div>
            <dt>Source</dt>
            <dd>{sourceUrl.trim() ? sourcePreview.title : "Waiting"}</dd>
          </div>
          <div>
            <dt>Title</dt>
            <dd>{title.trim() || "Untitled"}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{selectedCategory?.name ?? "Loading"}</dd>
          </div>
          <div>
            <dt>Visibility</dt>
            <dd>{visibility === "private" ? "Private invite" : "Public Discover"}</dd>
          </div>
          <div>
            <dt>Capacity</dt>
            <dd>{participantLimit}</dd>
          </div>
        </dl>
        <p>Public rooms open immediately and can appear in Discover while they are live.</p>
        <p>Private rooms pause after creation so you can copy the invite link before entering.</p>
        <p>Host controls, chat, reports, and moderation all stay connected to this room.</p>
      </aside>
    </section>
  );
}
