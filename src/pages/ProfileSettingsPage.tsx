import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AuthRequiredGate } from "../components/AuthRequiredGate";
import { ActionFeedback, InlineError, InlineLoader, PageError, SkeletonText, UserRowSkeleton } from "../components/feedback";
import { Button, FormField, Input, Modal } from "../components/ui";
import { safeErrorText } from "../lib/errorMapping";
import { AvatarCropper } from "../users/AvatarCropper";
import { getMyProfile, requestAccountDeletion, updateMyProfile, updateSocialSettings, type MyProfileData, type SocialSettings } from "../users/profileApi";
import { validateProfileDraft } from "../users/profileValidation";
import { ProfileIdentityCard } from "../users/ProfileIdentityCard";
import { BlockedAccountsPanel } from "../social/BlockedAccountsPanel";

type PrivacyDraft = Omit<SocialSettings, "updatedAt">;

function message(error: unknown, fallback: string) { return safeErrorText(error, fallback); }

export function ProfileSettingsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { currentUser, isCheckingSession, logout, refreshCurrentUser } = useAuth();
  const [data, setData] = useState<MyProfileData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [privacy, setPrivacy] = useState<PrivacyDraft | null>(null);
  const [initialProfile, setInitialProfile] = useState({ bio: "", displayName: "" });
  const [initialPrivacy, setInitialPrivacy] = useState<PrivacyDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [deletionPassword, setDeletionPassword] = useState("");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletionSubmitted, setDeletionSubmitted] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    setError(null);
    void getMyProfile().then((result) => {
      if (!active) return;
      const profileDraft = { bio: result.profile.bio ?? "", displayName: result.profile.displayName };
      const privacyDraft = { friendRequestPrivacy: result.settings.friendRequestPrivacy, invitePrivacy: result.settings.invitePrivacy, lastSeenPrivacy: result.settings.lastSeenPrivacy, onlinePrivacy: result.settings.onlinePrivacy };
      setData(result); setDisplayName(profileDraft.displayName); setBio(profileDraft.bio); setInitialProfile(profileDraft); setPrivacy(privacyDraft); setInitialPrivacy(privacyDraft);
    }).catch((caught) => { if (active) setError(message(caught, "Settings could not be loaded.")); });
    return () => { active = false; };
  }, [currentUser?.id]);

  const dirty = useMemo(() => displayName !== initialProfile.displayName || bio !== initialProfile.bio || JSON.stringify(privacy) !== JSON.stringify(initialPrivacy), [bio, displayName, initialPrivacy, initialProfile, privacy]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    const beforeNavigate = (event: Event) => { if (dirty && !window.confirm("Discard your unsaved profile or privacy changes?")) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("vibehall:before-navigate", beforeNavigate);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("vibehall:before-navigate", beforeNavigate); };
  }, [dirty]);

  useEffect(() => { if (error || success) queueMicrotask(() => feedbackRef.current?.focus()); }, [error, success]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setError(null); setSuccess(null);
    const validation = validateProfileDraft({ bio, displayName });
    if (!validation.valid) { setError(validation.errors.displayName ?? validation.errors.bio ?? "Check the profile fields."); return; }
    setSavingProfile(true);
    try {
      const result = await updateMyProfile({ displayName: validation.normalized.displayName, ...(data?.capabilities.socialEnabled ? { bio: validation.normalized.bio } : {}) });
      setData((current) => current ? { ...current, profile: result.profile, user: result.user } : current);
      setDisplayName(result.profile.displayName); setBio(result.profile.bio ?? ""); setInitialProfile({ bio: result.profile.bio ?? "", displayName: result.profile.displayName });
      await refreshCurrentUser(); setSuccess("Profile details saved.");
    } catch (caught) { setError(message(caught, "Profile details could not be saved.")); }
    finally { setSavingProfile(false); }
  }

  async function savePrivacy(event: FormEvent) {
    event.preventDefault(); if (!privacy) return; setError(null); setSuccess(null); setSavingPrivacy(true);
    try { const result = await updateSocialSettings(privacy); const next = { friendRequestPrivacy: result.settings.friendRequestPrivacy, invitePrivacy: result.settings.invitePrivacy, lastSeenPrivacy: result.settings.lastSeenPrivacy, onlinePrivacy: result.settings.onlinePrivacy }; setPrivacy(next); setInitialPrivacy(next); setSuccess("Privacy preferences saved."); }
    catch (caught) { setError(message(caught, "Privacy preferences could not be saved.")); }
    finally { setSavingPrivacy(false); }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault(); setDeletionError(null); setDeleting(true);
    try {
      await requestAccountDeletion({ confirmation: "DELETE", password: deletionPassword });
      setDeletionSubmitted(true); setDeletionOpen(false); await logout();
    } catch { setDeletionError("Account deletion could not be requested. Check your password and try again."); }
    finally { setDeleting(false); }
  }

  if (deletionSubmitted) return <section className="surface-panel account-deletion-complete" role="status"><p className="eyebrow">Deletion requested</p><h2>You have been signed out.</h2><p>Your account deletion is processing safely. Protected report evidence follows its separate retention rules.</p><button className="secondary-action" onClick={() => onNavigate("/")} type="button">Return home</button></section>;
  if (!isCheckingSession && !currentUser) return <AuthRequiredGate body="Manage your profile, privacy, avatar, and account from one place." onLogin={() => onNavigate("/auth?mode=login&returnTo=%2Fsettings")} onSignup={() => onNavigate("/auth?mode=signup&returnTo=%2Fsettings")} title="Log in to open settings." />;
  if (isCheckingSession || (!data && !error)) return <section aria-label="Loading settings" className="surface-panel wide-panel"><InlineLoader label="Loading settings" /><UserRowSkeleton /><SkeletonText lines={3} /></section>;
  if (!data || !privacy) return <PageError description={error ?? "Try again in a moment."} title="Settings unavailable" />;

  const enabled = data.capabilities.socialEnabled;
  return (
    <section className="settings-page">
      <nav aria-label="Settings sections" className="settings-section-nav"><a href="#profile-settings">Profile</a><a href="#privacy-settings">Presence &amp; Privacy</a>{enabled ? <a href="#blocked-settings">Blocked Accounts</a> : null}<a href="#account-settings">Account</a></nav>
      {!enabled ? <ActionFeedback>Social profile tools are safely disabled on this environment. Display-name management remains available.</ActionFeedback> : null}
      {error ? <div ref={feedbackRef} tabIndex={-1}><InlineError description={error} /></div> : null}
      {success ? <div ref={feedbackRef} tabIndex={-1}><ActionFeedback tone="success">{success}</ActionFeedback></div> : null}

      <section className="settings-grid-section" id="profile-settings" aria-labelledby="profile-settings-title">
        <ProfileIdentityCard profile={{ ...data.profile, bio, displayName }} />
        <form className="surface-panel settings-form" onSubmit={saveProfile}>
          <div className="settings-section-heading"><div><p className="eyebrow">Profile</p><h2 id="profile-settings-title">Public identity</h2></div><span className="ui-badge">@{data.profile.username}</span></div>
          <label>Display name <span className="field-hint">2–48 characters.</span><input maxLength={48} minLength={2} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></label>
          <label>Bio <span className="field-hint">Plain text, 160 characters. Links, HTML, and Markdown are not accepted.</span><textarea disabled={!enabled} maxLength={160} onChange={(event) => setBio(event.target.value)} rows={4} value={bio} /><span className="character-count">{bio.length}/160</span></label>
          <Button disabled={!displayName.trim()} loading={savingProfile} loadingLabel="Saving profile" type="submit" variant="primary">Save profile</Button>
          <AvatarCropper avatar={data.profile.avatar} disabled={!enabled} displayName={displayName || data.profile.displayName} onChanged={async (avatar) => { setData((current) => current ? { ...current, profile: { ...current.profile, avatar } } : current); await refreshCurrentUser(); }} />
        </form>
      </section>

      <form className="surface-panel settings-form" id="privacy-settings" onSubmit={savePrivacy}>
        <div className="settings-section-heading"><div><p className="eyebrow">Presence &amp; Privacy</p><h2>Control future contact and visibility</h2></div><span className="ui-badge">Server enforced</span></div>
        <p className="form-intro">These preferences are ready before live presence and invitations are released. Hidden data is filtered by the server.</p>
        <div className="privacy-grid">
          <label>Friend requests<select disabled={!enabled} onChange={(event) => setPrivacy({ ...privacy, friendRequestPrivacy: event.target.value as PrivacyDraft["friendRequestPrivacy"] })} value={privacy.friendRequestPrivacy}><option value="everyone">Everyone</option><option value="nobody">Nobody</option></select></label>
          <label>Online status<select disabled={!enabled} onChange={(event) => setPrivacy({ ...privacy, onlinePrivacy: event.target.value as PrivacyDraft["onlinePrivacy"] })} value={privacy.onlinePrivacy}><option value="friends">Friends</option><option value="nobody">Nobody</option></select></label>
          <label>Last seen<select disabled={!enabled} onChange={(event) => setPrivacy({ ...privacy, lastSeenPrivacy: event.target.value as PrivacyDraft["lastSeenPrivacy"] })} value={privacy.lastSeenPrivacy}><option value="friends">Friends</option><option value="nobody">Nobody</option></select></label>
          <label>Room invitations<select disabled={!enabled} onChange={(event) => setPrivacy({ ...privacy, invitePrivacy: event.target.value as PrivacyDraft["invitePrivacy"] })} value={privacy.invitePrivacy}><option value="friends">Friends</option><option value="nobody">Nobody</option></select></label>
        </div>
        <Button disabled={!enabled} loading={savingPrivacy} loadingLabel="Saving privacy" type="submit" variant="primary">Save privacy</Button>
      </form>

      {enabled ? <BlockedAccountsPanel onNavigate={onNavigate} /> : null}

      <section className="surface-panel account-settings" id="account-settings" aria-labelledby="account-settings-title">
        <div className="settings-section-heading"><div><p className="eyebrow">Account</p><h2 id="account-settings-title">Permanent deletion</h2></div><span className="ui-badge">Re-auth required</span></div>
        <p>Deletion removes profile and social state, signs the account out, and schedules managed-avatar cleanup. Protected report evidence follows separate retention.</p>
        <button className="danger-action" disabled={!enabled} onClick={() => { setDeletionError(null); setDeletionOpen(true); }} type="button">Delete account permanently</button>
      </section>

      {deletionOpen ? (
        <Modal
          className="deletion-dialog"
          descriptionId="deletion-dialog-description"
          dismissible={!deleting}
          initialFocusRef={dialogTitleRef}
          onClose={() => setDeletionOpen(false)}
          titleId="deletion-dialog-title"
        >
          <form onSubmit={deleteAccount}>
            <p className="eyebrow">Irreversible action</p>
            <h2 id="deletion-dialog-title" ref={dialogTitleRef} tabIndex={-1}>Delete your Vibehall account?</h2>
            <ul id="deletion-dialog-description">
              <li>Your public profile and social access are removed.</li>
              <li>Friend/invite/message cleanup follows the social lifecycle.</li>
              <li>Protected safety evidence may remain for its controlled retention period.</li>
            </ul>
            <FormField label="Current password" required>
              <Input autoComplete="current-password" onChange={(event) => setDeletionPassword(event.target.value)} type="password" value={deletionPassword} />
            </FormField>
            <FormField hint="Enter the word exactly as shown." label="Type DELETE to confirm" required>
              <Input autoComplete="off" onChange={(event) => setDeletionConfirmation(event.target.value)} value={deletionConfirmation} />
            </FormField>
            {deletionError ? <InlineError className="compact" description={deletionError} /> : null}
            <div className="action-row">
              <Button disabled={deletionConfirmation !== "DELETE" || !deletionPassword} loading={deleting} loadingLabel="Requesting account deletion" type="submit" variant="danger">Delete permanently</Button>
              <Button disabled={deleting} onClick={() => setDeletionOpen(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
