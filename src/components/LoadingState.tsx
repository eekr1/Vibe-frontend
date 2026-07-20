import { InlineLoader } from "./feedback";

type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <main className="loading-state">
      <span aria-hidden="true" className="loading-state__brand">V</span>
      <InlineLoader label={label} />
    </main>
  );
}
