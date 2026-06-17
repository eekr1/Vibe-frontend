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
        setError("Auth failed. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <form className="auth-panel" onSubmit={handleSubmit}>
        <p className="eyebrow">
          {mode === "login"
            ? "Member login"
            : mode === "signup"
              ? "Create account"
              : mode === "forgot"
                ? "Password recovery"
                : "Set a new password"}
        </p>
        <h2>
          {mode === "login"
            ? "Log in to continue"
            : mode === "signup"
              ? "Join Vibehall"
              : mode === "forgot"
                ? "Reset your password"
                : "Choose a new password"}
        </h2>
        <p className="form-intro">
          {mode === "forgot"
            ? "Enter your account email. If it exists, we will send a reset link without exposing account status."
            : mode === "reset"
              ? "Use the reset link from your email. The link is single-use and expires soon."
              : returnTo === "/"
                ? "Your account keeps room ownership, chat identity, and moderation history traceable."
                : "After this step, we will send you back to the room or admin flow you started."}
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
            <label>
              Username
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
              <input
                autoComplete="name"
                onChange={(event) => setDisplayName(event.target.value)}
                required
                type="text"
                value={displayName}
              />
            </label>
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

        {mode !== "forgot" ? (
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

        {mode === "reset" ? (
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

        {successMessage ? <p className="form-success">{successMessage}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-action full-width" disabled={isSubmitting} type="submit">
          {isSubmitting
            ? "Working..."
            : mode === "login"
              ? "Log in"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Reset password"}
        </button>

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
      </form>
    </section>
  );
}
