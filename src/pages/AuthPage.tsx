import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ActionFeedback, InlineError } from "../components/feedback";
import { Button, FormField, Input } from "../components/ui";
import { ApiClientError, apiRequest } from "../lib/api";
import { mapErrorToSafeMessage } from "../lib/errorMapping";
import { useAuth } from "../auth/AuthContext";

type AuthPageProps = { onNavigate: (path: string) => void };
export type AuthMode = "forgot" | "login" | "reset" | "signup";
type AuthField =
  | "displayName" | "email" | "emailOrUsername" | "password"
  | "resetConfirmPassword" | "resetEmail" | "username";
export type AuthFormValues = Record<AuthField, string>;
export type AuthFieldErrors = Partial<Record<AuthField, string>>;

const emptyValues: AuthFormValues = {
  displayName: "", email: "", emailOrUsername: "", password: "",
  resetConfirmPassword: "", resetEmail: "", username: ""
};

const copy: Record<AuthMode, { description: string; eyebrow: string; title: string }> = {
  forgot: { description: "Enter your email. We will send a private reset link if an account exists.", eyebrow: "Password recovery", title: "Reset your password." },
  login: { description: "Sign in with the identity you use across rooms, chat, and hosting.", eyebrow: "Welcome back", title: "Sign in to Vibehall." },
  reset: { description: "Choose a new password. Reset links are private, single-use, and time-limited.", eyebrow: "Password recovery", title: "Choose a new password." },
  signup: { description: "Create one identity for the rooms you join and the people you meet.", eyebrow: "New member", title: "Create your account." }
};

const knownFields = new Set<AuthField>([
  "displayName", "email", "emailOrUsername", "password",
  "resetConfirmPassword", "resetEmail", "username"
]);

export function readAuthModeFromLocation(pathname: string, search: string): AuthMode {
  if (pathname === "/auth/reset") return "reset";
  const mode = new URLSearchParams(search).get("mode");
  return mode === "forgot" || mode === "signup" ? mode : "login";
}

function readAuthMode() {
  return readAuthModeFromLocation(window.location.pathname, window.location.search);
}

function readReturnTo() {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  return value?.startsWith("/") ? value : "/";
}

function readResetToken() {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

export function createAuthModePath(mode: Exclude<AuthMode, "reset">, returnTo: string) {
  return "/auth?" + new URLSearchParams({ mode, returnTo }).toString();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateAuthForm(mode: AuthMode, values: AuthFormValues, token = ""): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (mode === "login") {
    const identifier = values.emailOrUsername.trim();
    if (!identifier) errors.emailOrUsername = "Enter your email or username.";
    else if (identifier.length < 3 || identifier.length > 120) errors.emailOrUsername = "Use between 3 and 120 characters.";
    if (!values.password) errors.password = "Enter your password.";
    else if (values.password.length > 128) errors.password = "Password must be 128 characters or fewer.";
  }
  if (mode === "signup") {
    if (!validEmail(values.email)) errors.email = "Enter a valid email address.";
    const username = values.username.trim().toLowerCase();
    if (!username) errors.username = "Choose a username.";
    else if (username.length < 3 || username.length > 24) errors.username = "Username must be between 3 and 24 characters.";
    else if (!/^[a-z0-9_]+$/.test(username)) errors.username = "Use only letters, numbers, and underscores.";
    const displayName = values.displayName.trim();
    if (!displayName) errors.displayName = "Enter a display name.";
    else if (displayName.length < 2 || displayName.length > 48) errors.displayName = "Display name must be between 2 and 48 characters.";
    if (!values.password) errors.password = "Create a password.";
    else if (values.password.length < 8 || values.password.length > 128) errors.password = "Password must be between 8 and 128 characters.";
  }
  if (mode === "forgot" && !validEmail(values.resetEmail)) errors.resetEmail = "Enter a valid email address.";
  if (mode === "reset" && token) {
    if (!values.password) errors.password = "Create a new password.";
    else if (values.password.length < 8 || values.password.length > 128) errors.password = "Password must be between 8 and 128 characters.";
    if (!values.resetConfirmPassword) errors.resetConfirmPassword = "Confirm your new password.";
    else if (values.password !== values.resetConfirmPassword) errors.resetConfirmPassword = "The new passwords do not match.";
  }
  return errors;
}

export function createAuthPayload(mode: AuthMode, values: AuthFormValues, token = "") {
  if (mode === "login") return { emailOrUsername: values.emailOrUsername.trim(), password: values.password };
  if (mode === "signup") return {
    displayName: values.displayName.trim(), email: values.email.trim().toLowerCase(),
    password: values.password, username: values.username.trim().toLowerCase()
  };
  if (mode === "forgot") return { email: values.resetEmail.trim().toLowerCase() };
  return { password: values.password, token: token.trim() };
}

function errorsFromDetails(details: unknown): AuthFieldErrors {
  if (!Array.isArray(details)) return {};
  const errors: AuthFieldErrors = {};
  for (const issue of details) {
    if (!issue || typeof issue !== "object" || !("path" in issue) || !Array.isArray(issue.path)) continue;
    const field = issue.path[0];
    if (typeof field === "string" && knownFields.has(field as AuthField)) {
      errors[field as AuthField] = "Check this field and try again.";
    }
  }
  return errors;
}

export function getAuthErrorFeedback(error: unknown, mode: AuthMode) {
  if (error instanceof ApiClientError) {
    if (error.code === "VALIDATION_FAILED") {
      const fieldErrors = errorsFromDetails(error.details);
      if (mode === "forgot" && fieldErrors.email) {
        fieldErrors.resetEmail = fieldErrors.email;
        delete fieldErrors.email;
      }
      return { fieldErrors, message: "Some information needs attention. Check the highlighted fields and try again." };
    }
    if (error.code === "INVALID_CREDENTIALS") return { fieldErrors: {}, message: "We couldn’t sign you in. Check your details and try again." };
    if (error.code === "CONFLICT" && mode === "signup") return { fieldErrors: {}, message: "That email or username is unavailable. Try a different one." };
    if (error.code === "INVALID_RESET_TOKEN") return { fieldErrors: {}, message: "This reset link is invalid, expired, or has already been used." };
    if (["ACCOUNT_BANNED", "ACCOUNT_RESTRICTED", "ACCOUNT_SUSPENDED"].includes(error.code)) {
      return { fieldErrors: {}, message: "This account cannot complete that action right now." };
    }
  }
  if (error instanceof TypeError) return { fieldErrors: {}, message: "We couldn’t reach Vibehall. Check your connection and try again." };
  const mapped = mapErrorToSafeMessage(error);
  return { fieldErrors: {}, message: mapped.title + " " + mapped.message };
}

function requestReset(email: string) {
  return apiRequest<{ message: string }>("/auth/password-reset/request", { body: { email }, method: "POST" });
}

function confirmReset(token: string, password: string) {
  return apiRequest<{ reset: boolean }>("/auth/password-reset/confirm", { body: { password, token }, method: "POST" });
}

export function AuthPage({ onNavigate }: AuthPageProps) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<AuthMode>(readAuthMode);
  const [values, setValues] = useState<AuthFormValues>(emptyValues);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const fieldRefs = useRef<Partial<Record<AuthField, HTMLInputElement | null>>>({});
  const errorRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const returnTo = useMemo(readReturnTo, []);
  const resetToken = useMemo(readResetToken, []);
  const missingToken = mode === "reset" && !resetToken;
  const titleId = "auth-title-" + mode;

  useEffect(() => {
    function syncMode() {
      setMode(readAuthMode());
      setFieldErrors({});
      setFormError(null);
      setSuccess(null);
    }
    window.addEventListener("popstate", syncMode);
    return () => window.removeEventListener("popstate", syncMode);
  }, []);

  function focus(field?: AuthField) {
    window.requestAnimationFrame(() => field ? fieldRefs.current[field]?.focus() : errorRef.current?.focus());
  }

  function update(field: AuthField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function switchMode(next: Exclude<AuthMode, "reset">) {
    if (submitting.current) return;
    setMode(next);
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    onNavigate(createAuthModePath(next, returnTo));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || missingToken) return;
    setFormError(null);
    setSuccess(null);
    const validation = validateAuthForm(mode, values, resetToken);
    const firstField = Object.keys(validation)[0] as AuthField | undefined;
    if (firstField) {
      setFieldErrors(validation);
      focus(firstField);
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    try {
      if (mode === "forgot") {
        const payload = createAuthPayload(mode, values) as { email: string };
        setSuccess((await requestReset(payload.email)).message);
      } else if (mode === "reset") {
        const payload = createAuthPayload(mode, values, resetToken) as { password: string; token: string };
        await confirmReset(payload.token, payload.password);
        setValues((current) => ({ ...current, password: "", resetConfirmPassword: "" }));
        setMode("login");
        onNavigate(createAuthModePath("login", returnTo));
        setSuccess("Your password was reset. You can sign in now.");
      } else if (mode === "login") {
        await login(createAuthPayload(mode, values) as { emailOrUsername: string; password: string });
        onNavigate(returnTo);
      } else {
        await signup(createAuthPayload(mode, values) as { displayName: string; email: string; password: string; username: string });
        onNavigate(returnTo);
      }
    } catch (caught) {
      const feedback = getAuthErrorFeedback(caught, mode);
      setFieldErrors(feedback.fieldErrors);
      setFormError(feedback.message);
      focus(Object.keys(feedback.fieldErrors)[0] as AuthField | undefined);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  const input = (field: AuthField, props: React.ComponentProps<typeof Input>) => (
    <Input
      {...props}
      onChange={(event) => update(field, event.target.value)}
      ref={(node) => { fieldRefs.current[field] = node; }}
      value={values[field]}
    />
  );

  return (
    <section aria-labelledby={titleId} className="auth-page">
      <div aria-hidden="true" className="auth-page__aura" />
      <form aria-busy={isSubmitting || undefined} className="auth-panel" noValidate onSubmit={submit}>
        <header className="auth-panel__header">
          <span aria-hidden="true" className="auth-panel__mark">✦</span>
          <p className="eyebrow">{copy[mode].eyebrow}</p>
          <h2 id={titleId}>{copy[mode].title}</h2>
          <p className="form-intro">{copy[mode].description}</p>
        </header>

        <div className="auth-fields">
          {mode === "login" ? (
            <FormField error={fieldErrors.emailOrUsername} label="Email or username" required>
              {input("emailOrUsername", { autoCapitalize: "none", autoComplete: "username", maxLength: 120, spellCheck: false, type: "text" })}
            </FormField>
          ) : null}
          {mode === "signup" ? (
            <>
              <FormField error={fieldErrors.email} label="Email" required>
                {input("email", { autoCapitalize: "none", autoComplete: "email", inputMode: "email", spellCheck: false, type: "email" })}
              </FormField>
              <FormField error={fieldErrors.username} hint="3–24 characters. Letters, numbers, and underscores only." label="Username" required>
                {input("username", { autoCapitalize: "none", autoComplete: "username", maxLength: 24, spellCheck: false, type: "text" })}
              </FormField>
              <FormField error={fieldErrors.displayName} hint="The name people see across Vibehall." label="Display name" required>
                {input("displayName", { autoComplete: "name", maxLength: 48, type: "text" })}
              </FormField>
            </>
          ) : null}
          {mode === "forgot" ? (
            <FormField error={fieldErrors.resetEmail} label="Email" required>
              {input("resetEmail", { autoCapitalize: "none", autoComplete: "email", inputMode: "email", spellCheck: false, type: "email" })}
            </FormField>
          ) : null}
          {missingToken ? (
            <div ref={errorRef} tabIndex={-1}>
              <InlineError
                action={<Button onClick={() => switchMode("forgot")} size="small" variant="text">Request a new link</Button>}
                description="This reset link is missing its token. Request a new password reset link to continue."
              />
            </div>
          ) : null}
          {mode !== "forgot" && !missingToken ? (
            <FormField
              error={fieldErrors.password}
              hint={mode === "login" ? undefined : "Use 8–128 characters."}
              label={mode === "reset" ? "New password" : "Password"}
              required
            >
              {input("password", { autoComplete: mode === "login" ? "current-password" : "new-password", maxLength: 128, type: "password" })}
            </FormField>
          ) : null}
          {mode === "reset" && !missingToken ? (
            <FormField error={fieldErrors.resetConfirmPassword} label="Confirm new password" required>
              {input("resetConfirmPassword", { autoComplete: "new-password", maxLength: 128, type: "password" })}
            </FormField>
          ) : null}
        </div>

        {mode === "login" ? (
          <div className="auth-forgot-action">
            <Button onClick={() => switchMode("forgot")} size="small" variant="text">Forgot password?</Button>
          </div>
        ) : null}
        {success ? <ActionFeedback tone="success">{success}</ActionFeedback> : null}
        {formError ? <div ref={errorRef} tabIndex={-1}><InlineError description={formError} /></div> : null}

        <Button
          disabled={missingToken}
          fullWidth
          loading={isSubmitting}
          loadingLabel={mode === "forgot" ? "Sending reset link" : mode === "reset" ? "Resetting password" : mode === "signup" ? "Creating account" : "Signing in"}
          size="large"
          type="submit"
          variant="primary"
        >
          {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Reset password"}
        </Button>

        <div className="auth-secondary-actions">
          {mode === "login" ? <p>Don’t have an account? <Button onClick={() => switchMode("signup")} size="small" variant="text">Sign up</Button></p> : null}
          {mode === "signup" ? <p>Already have an account? <Button onClick={() => switchMode("login")} size="small" variant="text">Sign in</Button></p> : null}
          {mode === "forgot" || mode === "reset" ? <Button onClick={() => switchMode("login")} size="small" variant="text">Back to sign in</Button> : null}
        </div>
      </form>
    </section>
  );
}
