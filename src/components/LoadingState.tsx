type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="loading-state" role="status">
      <span aria-hidden="true" className="loader" />
      <span>{label}</span>
    </div>
  );
}
