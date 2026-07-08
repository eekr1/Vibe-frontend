import type { MemberProfile, RelationshipState } from "../users/profileApi";
import { RelationshipActions } from "./RelationshipActions";

type Props = {
  context?: string;
  initialRelationship?: RelationshipState;
  inviteDisabled?: boolean;
  inviteRoomId?: string | null;
  onChanged?: () => void;
  onDismiss?: () => void;
  onInviteSent?: () => void;
  onNavigate: (path: string) => void;
  profile: MemberProfile;
};

function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "V"; }

export function SocialIdentity({ context, initialRelationship, inviteDisabled = false, inviteRoomId = null, onChanged, onDismiss, onInviteSent, onNavigate, profile }: Props) {
  const avatarUrl = profile.avatar.kind === "managed" ? profile.avatar.urls.small : null;
  return (
    <article className="social-identity-card">
      <button className="social-identity-link" onClick={() => onNavigate(`/users/${encodeURIComponent(profile.username)}`)} type="button">
        {avatarUrl ? <img alt="" className="identity-avatar" height="40" src={avatarUrl} width="40" /> : <span aria-hidden="true" className="identity-avatar">{profile.avatar.kind === "initials" ? profile.avatar.initials : initials(profile.displayName)}</span>}
        <span className="social-identity-copy"><strong>{profile.displayName}</strong><small>@{profile.username}</small>{context ? <span>{context}</span> : null}</span>
      </button>
      <RelationshipActions compact initialRelationship={initialRelationship} inviteDisabled={inviteDisabled} inviteRoomId={inviteRoomId} onChanged={onChanged} onInviteSent={onInviteSent} targetLabel={profile.displayName} targetUserId={profile.id} />
      {onDismiss ? <button className="text-action compact" onClick={onDismiss} type="button">Dismiss suggestion</button> : null}
    </article>
  );
}