import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { InlineLoader, SkeletonText, UserRowSkeleton } from "../components/feedback";
import { ApiClientError } from "../lib/api";
import { getMemberProfile, type MemberProfile, type RelationshipState } from "../users/profileApi";
import { ProfileIdentityCard } from "../users/ProfileIdentityCard";
import { RelationshipActions } from "../social/RelationshipActions";

export function MemberProfilePage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { currentUser } = useAuth();
  const username = useMemo(() => {
    try { return decodeURIComponent(window.location.pathname.replace(/^\/users\//, "")); }
    catch { return ""; }
  }, [window.location.pathname]);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [relationship, setRelationship] = useState<RelationshipState | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setUnavailable(false);
    void getMemberProfile(username)
      .then((data) => { if (active) { setProfile(data.profile); setRelationship(data.relationship ?? null); } })
      .catch((error) => { if (active) setUnavailable(error instanceof ApiClientError && ["NOT_FOUND", "FEATURE_DISABLED", "FORBIDDEN"].includes(error.code)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [username]);

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[data-vibehall-profile-robots="true"]');
    if (profile?.viewer === "guest") {
      if (!meta) { meta = document.createElement("meta"); meta.name = "robots"; meta.dataset.vibehallProfileRobots = "true"; document.head.append(meta); }
      meta.content = "noindex,nofollow";
    } else meta?.remove();
    return () => { document.querySelector('meta[data-vibehall-profile-robots="true"]')?.remove(); };
  }, [profile?.viewer]);

  if (loading) return <section aria-label="Loading member profile" className="surface-panel wide-panel"><InlineLoader label="Loading member profile" /><UserRowSkeleton /><SkeletonText lines={2} /></section>;
  if (unavailable || !profile) return <section className="surface-panel profile-unavailable" role="status"><p className="eyebrow">Profile unavailable</p><h2>This member profile cannot be shown.</h2><p>It may not exist or may not be available to you. Vibehall does not reveal account or safety details.</p><button className="secondary-action" onClick={() => onNavigate("/discover")} type="button">Back to Discover</button></section>;

  const isSelf = currentUser?.id === profile.id;
  return (
    <section className="member-profile-page">
      <ProfileIdentityCard
        actions={isSelf ? <><button className="primary-action" onClick={() => onNavigate("/settings")} type="button">Manage settings</button><button className="secondary-action" onClick={() => onNavigate("/profile")} type="button">View my profile</button></> : profile.viewer === "guest" ? <><button className="primary-action" onClick={() => onNavigate(`/auth?mode=login&returnTo=${encodeURIComponent(window.location.pathname)}`)} type="button">Log in</button><button className="text-action" onClick={() => onNavigate(`/auth?mode=signup&returnTo=${encodeURIComponent(window.location.pathname)}`)} type="button">Create account</button></> : currentUser && relationship ? <RelationshipActions initialRelationship={relationship} onChanged={setRelationship} targetLabel={profile.displayName} targetUserId={profile.id} /> : null}
        profile={profile}
        showPresencePlaceholder={profile.viewer !== "guest"}
      />
    </section>
  );
}
