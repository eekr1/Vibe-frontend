import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AuthRequiredGate } from "../components/AuthRequiredGate";
import { ApiClientError } from "../lib/api";
import { getMyProfile, updateMyProfile } from "../users/profileApi";

type ProfileSettingsPageProps = {
  onNavigate: (path: string) => void;
};

function describeProfileError(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Profile settings could not be saved.";
}

export function ProfileSettingsPage({ onNavigate }: ProfileSettingsPageProps) {
  const { currentUser, isCheckingSession, refreshCurrentUser } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const returnTo = `${window.location.pathname}${window.location.search}`;

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isMounted = true;

    async function loadProfile() {
      setError(null);
      setIsLoadingProfile(true);

      try {
        const profile = await getMyProfile();

        if (!isMounted) {
          return;
        }

        setAvatarUrl(profile.avatarUrl ?? "");
        setDisplayName(profile.displayName);
      } catch (caughtError) {
        if (isMounted) {
          setError(describeProfileError(caughtError));
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await updateMyProfile({
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
        displayName: displayName.trim()
      });
      await refreshCurrentUser();
      setSuccess("Profile settings saved and session identity refreshed.");
    } catch (caughtError) {
      setError(describeProfileError(caughtError));
    } finally {
      setIsSaving(false);
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

  if (isCheckingSession || isLoadingProfile) {
    return (
      <section className="surface-panel wide-panel">
        <div className="inline-loading">
          <span className="loader" />
          Loading profile settings
        </div>
      </section>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <section className="profile-settings-grid">
      <div className="surface-panel">
        <p className="eyebrow">Member continuity</p>
        <h2>Your profile</h2>
        <p>
          Keep your room identity recognizable. These fields are used in rooms, chat, reports, and moderation
          context.
        </p>
        <dl className="room-facts">
          <div>
            <dt>Username</dt>
            <dd>{currentUser.username}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{currentUser.email}</dd>
          </div>
          <div>
            <dt>Account state</dt>
            <dd>{currentUser.accountState}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{currentUser.role}</dd>
          </div>
        </dl>
      </div>

      <form className="surface-panel profile-settings-form" onSubmit={handleSubmit}>
        <label>
          Display name
          <input
            maxLength={48}
            minLength={2}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <label>
          Avatar URL
          <input
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://example.com/avatar.png"
            type="url"
            value={avatarUrl}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="state-banner success">{success}</p> : null}
        <button className="primary-action" disabled={isSaving || !displayName.trim()} type="submit">
          {isSaving ? "Saving..." : "Save profile settings"}
        </button>
      </form>
    </section>
  );
}
