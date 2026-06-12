import { type FormEvent, useEffect, useState } from "react";
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
        body="Rooms need a signed-in host so ownership and moderation stay traceable."
        onLogin={() => onNavigate("/auth?mode=login&returnTo=%2Fcreate-room")}
        onSignup={() => onNavigate("/auth?mode=signup&returnTo=%2Fcreate-room")}
        title="Log in to host a Vibehall room."
      />
    );
  }

  return (
    <section className="create-room-layout">
      <form className="room-form" onSubmit={handleSubmit}>
        <p className="eyebrow">Create room</p>
        <h2>Start a host-owned live room.</h2>
        <p className="form-intro">
          This form now talks to the real room API: backend validates the YouTube
          source, category, visibility, capacity, and creates the room live immediately.
        </p>

        <label>
          Room title
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

        <fieldset className="visibility-switch">
          <legend>Visibility</legend>
          <label>
            <input
              checked={visibility === "public"}
              onChange={() => setVisibility("public")}
              type="radio"
            />
            Public
          </label>
          <label>
            <input
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
              type="radio"
            />
            Private
          </label>
        </fieldset>

        {visibility === "private" ? (
          <label>
            Private room password
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

        {error ? <p className="form-error">{error}</p> : null}

        {createdPrivateRoom ? (
          <div className="private-invite-card">
            <p className="eyebrow">Private room ready</p>
            <h3>{createdPrivateRoom.title}</h3>
            <p>Share this link to invite someone. They still need to log in and enter the room password.</p>
            <input aria-label="Private room invite link" readOnly value={createdPrivateRoomUrl} />
            {inviteCopyStatus ? <p className="state-banner success">{inviteCopyStatus}</p> : null}
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

        <button
          className="primary-action full-width"
          disabled={!isReadyToCreate}
          type="submit"
        >
          {isSubmitting ? "Creating room..." : "Create live room"}
        </button>
      </form>

      <aside className="create-room-aside">
        <p className="eyebrow">Debug promise</p>
        <h3>What should happen?</h3>
        <dl className="create-debug-list">
          <div>
            <dt>Selected category</dt>
            <dd>{selectedCategory?.name ?? "Loading"}</dd>
          </div>
          <div>
            <dt>Visibility</dt>
            <dd>{visibility}</dd>
          </div>
          <div>
            <dt>Capacity</dt>
            <dd>{participantLimit}</dd>
          </div>
        </dl>
        <p>
          A successful submit creates a room owned by the signed-in host, sets it live
          immediately, and routes you into `/room?roomId=...`.
        </p>
        <p>
          Public rooms open immediately after creation. Private rooms pause here first so
          you can copy the invite link before entering.
        </p>
        <p>
          If the host closes or leaves the room, backend state flips to ended immediately
          and the public room list stops returning it.
        </p>
      </aside>
    </section>
  );
}
