type AuthRequiredGateProps = {
  body?: string;
  onLogin: () => void;
  onSignup: () => void;
  title?: string;
};

export function AuthRequiredGate({
  body = "Log in or create an account so room access stays safe and traceable.",
  onLogin,
  onSignup,
  title = "Log in to continue into this room."
}: AuthRequiredGateProps) {
  return (
    <section className="auth-gate">
      <p className="eyebrow">Member access</p>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="action-row">
        <button className="primary-action" onClick={onLogin} type="button">
          Log in
        </button>
        <button className="secondary-action" onClick={onSignup} type="button">
          Create account
        </button>
      </div>
    </section>
  );
}
