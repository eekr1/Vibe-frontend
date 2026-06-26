type NotFoundPageProps = {
  onNavigate: (path: string) => void;
};

export function NotFoundPage({ onNavigate }: NotFoundPageProps) {
  return (
    <section className="not-found-surface" aria-labelledby="not-found-title">
      <div className="not-found-code" aria-hidden="true">404</div>
      <div className="not-found-copy">
        <p className="eyebrow">Not found</p>
        <h2 id="not-found-title">This hallway does not lead to a live room.</h2>
        <p>
          The page may have moved, the room link may be incomplete, or the address may have been typed by hand.
          You can return home or browse public rooms that are live right now.
        </p>
        <div className="action-row">
          <button className="primary-action compact" onClick={() => onNavigate("/")} type="button">
            Go home
          </button>
          <button className="secondary-action compact" onClick={() => onNavigate("/discover")} type="button">
            Discover rooms
          </button>
          <button className="text-action compact" onClick={() => onNavigate("/support")} type="button">
            Support
          </button>
        </div>
      </div>
    </section>
  );
}
