import { type FormEvent, useMemo, useState } from "react";
import { ApiClientError } from "../lib/api";
import { apiRequest } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

type AuthPageProps = {
  onNavigate: (path: string) => void;
};

type AuthMode = "forgot" | "login" | "reset" | "signup";

function readAuthMode(): AuthMode {
  if (window.location.pathname === "/auth/reset") {
    return "reset";
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "forgot") {
    return "forgot";
  }

  return params.get("mode") === "signup" ? "signup" : "login";
}

function readReturnTo() {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo");

  if (!returnTo || !returnTo.startsWith("/")) {
    return "/";
  }

  return returnTo;
}

function readResetToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? "";
}

function getIntentCopy(returnTo: string) {
  if (returnTo.startsWith("/room")) {
    return {
      body: "Log in or create an account, then Vibehall will continue toward the room you chose.",
      label: "Room entry"
    };
  }

  if (returnTo === "/create-room") {
    return {
      body: "Create a member account or log in, then continue to launching your room.",
      label: "Host a room"
    };
  }

  if (returnTo === "/profile") {
    return {
      body: "Sign in to manage the identity people see in rooms, chat, and reports.",
      label: "Profile access"
    };
  }

  return {
    body: "Membership keeps room ownership, chat identity, reports, and moderation history connected to one clear profile.",
    label: "Member access"
  };
}

async function requestPasswordReset(email: string) {
  return apiRequest<{ message: string }>("/auth/password-reset/request", {
    body: { email },
    method: "POST"
  });
}

async function confirmPasswordReset(token: string, password: string) {
  return apiRequest<{ reset: boolean }>("/auth/password-reset/confirm", {
    body: { password, token },
    method: "POST"
  });
}

export function AuthPage({ onNavigate }: AuthPageProps) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<AuthMode>(readAuthMode);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  const returnTo = useMemo(readReturnTo, []);
  const resetToken = useMemo(readResetToken, []);
  const resetTokenMissing = mode === "reset" && !resetToken;
  const intentCopy = useMemo(() => getIntentCopy(returnTo), [returnTo]);
  const isRoomOrActionIntent = returnTo !== "/";
  const modeTitle =
    mode === "login"
      ? "Log in to continue"
      : mode === "signup"
        ? "Create your member account"
        : mode === "forgot"
          ? "Reset your password"
          : "Choose a new password";

  function switchMode(nextMode: AuthMode) {
    setError(null);
    setSuccessMessage(null);
    setMode(nextMode);

    if (nextMode === "reset") {
      return;
    }

    const params = new URLSearchParams({ mode: nextMode, returnTo });
    window.history.replaceState({}, "", `/auth?${params.toString()}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "forgot") {
        const data = await requestPasswordReset(resetEmail);
        setSuccessMessage(data.message);
        return;
      }

      if (mode === "reset") {
        if (!resetToken) {
          setError("This reset link is missing its token.");
          return;
        }

        if (password !== resetConfirmPassword) {
          setError("The new passwords do not match.");
          return;
        }

        await confirmPasswordReset(resetToken, password);
        setPassword("");
        setResetConfirmPassword("");
        switchMode("login");
        setSuccessMessage("Your password was reset. You can log in now.");
        return;
      }

      if (mode === "login") {
        await login({ emailOrUsername, password });
      } else {
        await signup({ displayName, email, password, username });
      }

      onNavigate(returnTo);
    } catch (caughtError) {
      if (caughtError instanceof ApiClientError) {
        setError(caughtError.message);
      } else {
        setError("We could not complete this step. Please check the details and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-layout identity-layout">
      <aside className="auth-context-panel surface-panel">
        <p className="eyebrow">{intentCopy.label}</p>
        <h2>{isRoomOrActionIntent ? "Keep your place in the flow." : "Enter Vibehall as a member."}</h2>
        <p>{intentCopy.body}</p>
        <div className="identity-step-list" aria-label="Authentication flow context">
          <span>Browse as guest</span>
          <span>Authenticate once</span>
          <span>Join or host live</span>
        </div>
      </aside>

      <form className="auth-panel identity-form-panel" onSubmit={handleSubmit}>
        <div className="auth-mode-header">
          <div>
            <p className="eyebrow">
              {mode === "login"
                ? "Member login"
                : mode === "signup"
                  ? "New member"
                  : mode === "forgot"
                    ? "Password recovery"
                    : "Reset password"}
            </p>
            <h2>{modeTitle}</h2>
          </div>
          {mode === "login" || mode === "signup" ? (
            <div className="auth-mode-switch" aria-label="Authentication mode">
              <button
                aria-pressed={mode === "login"}
                className={mode === "login" ? "is-active" : ""}
                onClick={() => switchMode("login")}
                type="button"
              >
                Log in
              </button>
              <button
                aria-pressed={mode === "signup"}
                className={mode === "signup" ? "is-active" : ""}
                onClick={() => switchMode("signup")}
                type="button"
              >
                Sign up
              </button>
            </div>
          ) : null}
        </div>

        <p className="form-intro">
          {mode === "forgot"
            ? "Enter your account email. If it exists, we will send a private reset link without exposing account status."
            : mode === "reset"
              ? "Use the reset link from your email. The link is single-use and expires soon."
              : isRoomOrActionIntent
                ? "This step protects room identity and sends you back to the action you started."
                : "Use the same identity for rooms, chat, reports, and hosting."}
        </p>

        {mode === "login" ? (
          <label>
            Email or username
            <input
              autoComplete="username"
              onChange={(event) => setEmailOrUsername(event.target.value)}
              required
              type="text"
              value={emailOrUsername}
            />
          </label>
        ) : mode === "signup" ? (
          <>
            <label>
              Email
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <div className="form-grid">
              <label>
                Username
                <span className="field-hint">Your stable handle for login and account identity.</span>
                <input
                  autoComplete="username"
                  onChange={(event) => setUsername(event.target.value)}
                  pattern="[a-zA-Z0-9_]+"
                  required
                  type="text"
                  value={username}
                />
              </label>
              <label>
                Display name
                <span className="field-hint">The name people see in rooms, chat, and reports.</span>
                <input
                  autoComplete="name"
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  type="text"
                  value={displayName}
                />
              </label>
            </div>
          </>
        ) : mode === "forgot" ? (
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setResetEmail(event.target.value)}
              required
              type="email"
              value={resetEmail}
            />
          </label>
        ) : null}

        {resetTokenMissing ? (
          <div className="form-error" role="alert">
            This reset link is missing its token. Please request a new password reset link.
            <div className="action-row">
              <button className="text-action compact" onClick={() => switchMode("forgot")} type="button">
                Request new link
              </button>
            </div>
          </div>
        ) : null}

        {mode !== "forgot" && !resetTokenMissing ? (
          <label>
            {mode === "reset" ? "New password" : "Password"}
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "login" ? 1 : 8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
        ) : null}

        {mode === "reset" && !resetTokenMissing ? (
          <label>
            Confirm new password
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setResetConfirmPassword(event.target.value)}
              required
              type="password"
              value={resetConfirmPassword}
            />
          </label>
        ) : null}

        {successMessage ? <p aria-live="polite" className="form-success" role="status">{successMessage}</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <button className="primary-action full-width" disabled={isSubmitting || resetTokenMissing} type="submit">
          {isSubmitting
            ? "Please wait..."
            : mode === "login"
              ? "Log in"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Reset password"}
        </button>

        <div className="auth-secondary-actions">
          {mode === "login" ? (
            <button className="text-action" onClick={() => switchMode("forgot")} type="button">
              Forgot password?
            </button>
          ) : null}

          {mode === "forgot" || mode === "reset" ? (
            <button className="text-action" onClick={() => switchMode("login")} type="button">
              Back to login
            </button>
          ) : (
            <button
              className="text-action"
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              type="button"
            >
              {mode === "login" ? "Create an account" : "I already have an account"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
