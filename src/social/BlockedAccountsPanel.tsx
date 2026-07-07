import { useEffect, useState } from "react";
import { ApiClientError } from "../lib/api";
import type { MemberProfile } from "../users/profileApi";
import { listBlockedMembers } from "./socialApi";
import { SocialIdentity } from "./SocialIdentity";

export function BlockedAccountsPanel({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<{ blockedAt: string; profile: MemberProfile }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError(null);
    void listBlockedMembers().then((result) => { if (active) setItems(result.items); }).catch((caught) => { if (active) setError(caught instanceof ApiClientError ? caught.message : "Blocked accounts could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);
  return (
    <section aria-labelledby="blocked-settings-title" className="surface-panel blocked-settings" id="blocked-settings">
      <div className="settings-section-heading"><div><p className="eyebrow">Safety</p><h2 id="blocked-settings-title">Blocked accounts</h2></div><span className="ui-badge">Private</span></div>
      <p>Review people you blocked. Unblocking never restores a previous friendship or request.</p>
      {loading ? <div aria-live="polite" className="inline-loading" role="status"><span aria-hidden="true" className="loader" />Loading blocked accounts</div> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="social-identity-list compact-list">
        {items.slice(0, 3).map((item) => <SocialIdentity context={`Blocked ${new Date(item.blockedAt).toLocaleDateString()}`} initialRelationship={{ actions: ["unblock", "report"], state: "blocked" }} key={item.profile.id} onChanged={() => setRefreshKey((value) => value + 1)} onNavigate={onNavigate} profile={item.profile} />)}
      </div>
      {!loading && items.length === 0 ? <p className="empty-state">You have no blocked accounts.</p> : null}
      <button className="secondary-action" onClick={() => onNavigate("/friends?view=blocked")} type="button">Open blocked accounts manager{items.length > 3 ? ` (${items.length})` : ""}</button>
    </section>
  );
}
