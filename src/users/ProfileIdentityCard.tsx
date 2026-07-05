import type { ReactNode } from "react";
import type { MemberProfile, ProfileAvatar } from "./profileApi";

export function ProfileAvatarView({ avatar, displayName, size = "large" }: { avatar: ProfileAvatar; displayName: string; size?: "large" | "small" }) {
  const className = `managed-profile-avatar is-${size}`;
  return avatar.kind === "managed" ? (
    <img alt={`${displayName}'s avatar`} className={className} height={size === "large" ? 112 : 48} src={size === "large" ? avatar.urls.large : avatar.urls.small} width={size === "large" ? 112 : 48} />
  ) : (
    <span aria-label={`${displayName}'s initials avatar`} className={`${className} is-initials`} role="img">{avatar.initials}</span>
  );
}

export function ProfileIdentityCard({ actions, profile, showPresencePlaceholder = false }: { actions?: ReactNode; profile: MemberProfile; showPresencePlaceholder?: boolean }) {
  const membershipLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${profile.memberSince}-01T00:00:00Z`));
  return (
    <article className="surface-panel member-profile-card" aria-labelledby="member-profile-name">
      <div className="member-profile-main">
        <ProfileAvatarView avatar={profile.avatar} displayName={profile.displayName} />
        <div className="member-profile-copy">
          <p className="eyebrow">Member profile</p>
          <h2 id="member-profile-name">{profile.displayName}</h2>
          <p className="member-handle">@{profile.username}</p>
          <p className={profile.bio ? "member-bio" : "member-bio is-empty"}>{profile.bio || "No bio added yet."}</p>
          <p className="member-since">Member since {membershipLabel}</p>
        </div>
      </div>
      {showPresencePlaceholder ? <p className="profile-presence-note">Presence will appear here only when the member's privacy and the live-presence release allow it.</p> : null}
      {actions ? <div className="action-row profile-actions">{actions}</div> : null}
    </article>
  );
}
