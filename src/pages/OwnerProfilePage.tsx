import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AuthRequiredGate } from "../components/AuthRequiredGate";
import { getMyProfile, type MyProfileData } from "../users/profileApi";
import { ProfileIdentityCard } from "../users/ProfileIdentityCard";

export function OwnerProfilePage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { currentUser, isCheckingSession } = useAuth();
  const [data, setData] = useState<MyProfileData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    void getMyProfile().then((result) => { if (active) setData(result); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [currentUser?.id]);

  if (!isCheckingSession && !currentUser) return <AuthRequiredGate body="Your profile is the identity people recognize across Vibehall rooms." onLogin={() => onNavigate("/auth?mode=login&returnTo=%2Fprofile")} onSignup={() => onNavigate("/auth?mode=signup&returnTo=%2Fprofile")} title="Log in to view your profile." />;
  if (isCheckingSession || (!data && !error)) return <section className="surface-panel wide-panel"><div aria-live="polite" className="inline-loading" role="status"><span aria-hidden="true" className="loader" />Loading your profile</div></section>;
  if (error || !data) return <section className="surface-panel profile-unavailable" role="alert"><h2>Your profile could not be loaded.</h2><button className="secondary-action" onClick={() => window.location.reload()} type="button">Try again</button></section>;

  return <section className="member-profile-page"><ProfileIdentityCard actions={<><button className="primary-action" onClick={() => onNavigate("/settings")} type="button">Manage profile and privacy</button><button className="secondary-action" onClick={() => onNavigate(`/users/${encodeURIComponent(data.profile.username)}`)} type="button">Open direct profile</button></>} profile={{ ...data.profile, viewer: "owner_preview" }} showPresencePlaceholder /></section>;
}
