import { type FormEvent, useMemo, useState } from "react";
import { ApiClientError } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

type AuthPageProps = {
  onNavigate: (path: string) => void;
};

type AuthMode = "login" | "signup";

function readAuthMode(): AuthMode {
  const params = new URLSearchParams(window.location.search);
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

export function AuthPage({ onNavigate }: AuthPageProps) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<AuthMode>(readAuthMode);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const returnTo = useMemo(readReturnTo, []);

  function switchMode(nextMode: AuthMode) {
    setError(null);
    setMode(nextMode);
    const params = new URLSearchParams({ mode: nextMode, returnTo });
    window.history.replaceState({}, "", `/auth?${params.toString()}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
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
        <p className="eyebrow">{mode === "login" ? "Member login" : "Create account"}</p>
        <h2>{mode === "login" ? "Log in to continue" : "Join Vibehall"}</h2>

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
        ) : (
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
        )}

        <label>
          Password
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "signup" ? 8 : 1}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-action full-width" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Working..." : mode === "login" ? "Log in" : "Create account"}
        </button>

        <button
          className="text-action"
          onClick={() => switchMode(mode === "login" ? "signup" : "login")}
          type="button"
        >
          {mode === "login" ? "Create an account" : "I already have an account"}
        </button>
      </form>
    </section>
  );
}
