type AuthRequiredGateProps = {
  onLogin: () => void;
  onSignup: () => void;
};

export function AuthRequiredGate({ onLogin, onSignup }: AuthRequiredGateProps) {
  return (
    <section className="auth-gate">
      <p className="eyebrow">Member access</p>
      <h2>Log in to continue into this room.</h2>
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
