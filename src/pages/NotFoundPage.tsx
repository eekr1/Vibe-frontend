type NotFoundPageProps = {
  onNavigate: (path: string) => void;
};

export function NotFoundPage({ onNavigate }: NotFoundPageProps) {
  return (
    <section className="surface-panel narrow-panel">
      <p className="eyebrow">Not found</p>
      <h2>This page is not available.</h2>
      <p>Return to Vibehall or browse live public rooms.</p>
      <div className="action-row">
        <button className="primary-action compact" onClick={() => onNavigate("/")} type="button">
          Go home
        </button>
        <button className="secondary-action compact" onClick={() => onNavigate("/discover")} type="button">
          Discover rooms
        </button>
      </div>
    </section>
  );
}