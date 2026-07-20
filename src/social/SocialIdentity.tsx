import type { MemberProfile, RelationshipState } from "../users/profileApi";
import { Avatar } from "../components/ui";
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

export function SocialIdentity({ context, initialRelationship, inviteDisabled = false, inviteRoomId = null, onChanged, onDismiss, onInviteSent, onNavigate, profile }: Props) {
  const avatarUrl = profile.avatar.kind === "managed" ? profile.avatar.urls.small : null;
  return (
    <article className="social-identity-card">
      <button className="social-identity-link" onClick={() => onNavigate(`/users/${encodeURIComponent(profile.username)}`)} type="button">
        <Avatar displayName={profile.displayName} fallback={profile.avatar.kind === "initials" ? profile.avatar.initials : undefined} src={avatarUrl} />
        <span className="social-identity-copy"><strong>{profile.displayName}</strong><small>@{profile.username}</small>{context ? <span>{context}</span> : null}</span>
      </button>
      <RelationshipActions compact initialRelationship={initialRelationship} inviteDisabled={inviteDisabled} inviteRoomId={inviteRoomId} onChanged={onChanged} onInviteSent={onInviteSent} targetLabel={profile.displayName} targetUserId={profile.id} />
      {onDismiss ? <button className="text-action compact" onClick={onDismiss} type="button">Dismiss suggestion</button> : null}
    </article>
  );
}
