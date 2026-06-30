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
  const avatarInitial = (displayName.trim() || currentUser?.username || "V").slice(0, 1).toUpperCase();

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
      setSuccess("Profile saved. Your room identity is up to date.");
    } catch (caughtError) {
      setError(describeProfileError(caughtError));
    } finally {
      setIsSaving(false);
    }
  }

  if (!isCheckingSession && !currentUser) {
    return (
      <AuthRequiredGate
        body="Profile settings control the name and avatar people see in rooms, chat, and reports."
        onLogin={() => onNavigate(`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`)}
        onSignup={() => onNavigate(`/auth?mode=signup&returnTo=${encodeURIComponent(returnTo)}`)}
        title="Log in to manage your room identity."
      />
    );
  }

  if (isCheckingSession || isLoadingProfile) {
    return (
      <section className="surface-panel wide-panel">
        <div aria-live="polite" className="inline-loading" role="status">
          <span aria-hidden="true" className="loader" />
          Loading profile settings
        </div>
      </section>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <section className="profile-page identity-layout">
      <article className="surface-panel profile-identity-card">
        <p className="eyebrow">Room identity</p>
        <div className="profile-hero-card">
          {avatarUrl.trim() ? (
            <img alt="" height="72" src={avatarUrl.trim()} width="72" />
          ) : (
            <span className="profile-avatar-fallback">{avatarInitial}</span>
          )}
          <div>
            <h2>{displayName || currentUser.displayName}</h2>
            <p>@{currentUser.username}</p>
          </div>
        </div>
        <p>
          This is the identity people recognize inside live rooms. Keep it readable, stable,
          and ready for future public profile surfaces without adding social controls yet.
        </p>

        <dl className="room-facts profile-account-facts">
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
      </article>

      <form className="surface-panel profile-settings-form identity-form-panel" onSubmit={handleSubmit}>
        <div className="form-section-heading">
          <p className="eyebrow">Editable profile</p>
          <h2>Update what rooms show.</h2>
          <p className="form-intro">
            Your display name and avatar are visible in rooms, chat, reports, and moderation context.
            Your username and system account details stay stable here.
          </p>
        </div>

        <label>
          Display name
          <span className="field-hint">Shown in rooms, chat, reports, and moderation context.</span>
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
          <span className="field-hint">Optional image URL. Leave it blank to use your initial instead.</span>
          <input
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://example.com/avatar.png"
            type="url"
            value={avatarUrl}
          />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {success ? <p aria-live="polite" className="state-banner success" role="status">{success}</p> : null}
        {!avatarUrl.trim() ? (
          <p className="state-banner">Avatar URL is optional. Leaving it blank keeps your profile text-only.</p>
        ) : null}
        <button className="primary-action" disabled={isSaving || !displayName.trim()} type="submit">
          {isSaving ? "Saving profile..." : "Save profile"}
        </button>
      </form>
    </section>
  );
}
