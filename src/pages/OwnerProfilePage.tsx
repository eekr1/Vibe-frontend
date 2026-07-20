import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AuthRequiredGate } from "../components/AuthRequiredGate";
import { InlineLoader, PageError, SkeletonText, UserRowSkeleton } from "../components/feedback";
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
  if (isCheckingSession || (!data && !error)) return <section aria-label="Loading your profile" className="surface-panel wide-panel"><InlineLoader label="Loading your profile" /><UserRowSkeleton /><SkeletonText lines={2} /></section>;
  if (error || !data) return <PageError description="Try again in a moment." onRetry={() => window.location.reload()} title="Your profile could not be loaded." />;

  return <section className="member-profile-page"><ProfileIdentityCard actions={<><button className="primary-action" onClick={() => onNavigate("/settings")} type="button">Manage profile and privacy</button><button className="secondary-action" onClick={() => onNavigate(`/users/${encodeURIComponent(data.profile.username)}`)} type="button">Open direct profile</button></>} profile={{ ...data.profile, viewer: "owner_preview" }} showPresencePlaceholder /></section>;
}
