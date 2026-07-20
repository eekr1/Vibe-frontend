import { Button } from "./ui";

type AuthRequiredGateProps = {
  body?: string;
  onLogin: () => void;
  onSignup: () => void;
  title?: string;
};

export function AuthRequiredGate({
  body = "You can browse Vibehall as a guest, but entering rooms needs a member account so identity and safety stay clear.",
  onLogin,
  onSignup,
  title = "Log in to enter this room."
}: AuthRequiredGateProps) {
  return (
    <section className="auth-gate">
      <p className="eyebrow">Member access</p>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="action-row">
        <Button onClick={onLogin} variant="primary">
          Log in
        </Button>
        <Button onClick={onSignup}>
          Create account
        </Button>
      </div>
    </section>
  );
}
