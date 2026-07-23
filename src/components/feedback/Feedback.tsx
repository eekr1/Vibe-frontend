import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  CloudSlashIcon,
  InfoIcon,
  MagnifyingGlassIcon,
  WarningCircleIcon,
  WarningIcon,
  XCircleIcon
} from "@phosphor-icons/react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useId, useRef, useState } from "react";

import { Button, type ButtonProps } from "../ui";
import { mergeClassNames } from "../ui/utils";

export type FeedbackTone = "danger" | "info" | "success" | "warning";

const toneIcons = {
  danger: XCircleIcon,
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningIcon
};

type SkeletonBlockProps = HTMLAttributes<HTMLDivElement> & {
  height?: CSSProperties["height"];
  radius?: "medium" | "small";
  width?: CSSProperties["width"];
};

export function SkeletonBlock({ className, height, radius = "small", style, width, ...props }: SkeletonBlockProps) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={mergeClassNames("state-skeleton", `state-skeleton--${radius}`, className)}
      style={{ ...style, height, width }}
    />
  );
}

export function SkeletonText({ className, lines = 3 }: { className?: string; lines?: number }) {
  const safeLines = Math.min(8, Math.max(1, lines));
  return (
    <div aria-hidden="true" className={mergeClassNames("state-skeleton-text", className)}>
      {Array.from({ length: safeLines }, (_, index) => (
        <SkeletonBlock key={index} width={index === safeLines - 1 ? "68%" : "100%"} />
      ))}
    </div>
  );
}

export function RoomCardSkeleton() {
  return (
    <div aria-hidden="true" className="state-skeleton-card">
      <SkeletonBlock className="state-skeleton-card__media" radius="medium" />
      <div className="state-skeleton-card__body">
        <SkeletonBlock width="38%" />
        <SkeletonText lines={2} />
        <div className="state-skeleton-card__identity">
          <SkeletonBlock className="state-skeleton-card__avatar" />
          <SkeletonText lines={2} />
        </div>
        <SkeletonBlock width="46%" />
      </div>
    </div>
  );
}

export function UserRowSkeleton() {
  return (
    <div aria-hidden="true" className="state-skeleton-row">
      <SkeletonBlock className="state-skeleton-row__avatar" />
      <SkeletonText className="state-skeleton-row__copy" lines={2} />
    </div>
  );
}

export function MessageSkeleton({ align = "start" }: { align?: "end" | "start" }) {
  return (
    <div aria-hidden="true" className={`state-skeleton-message state-skeleton-message--${align}`}>
      <SkeletonText lines={2} />
    </div>
  );
}

type MediaPlaceholderProps = {
  className?: string;
  label?: string;
  state?: "error" | "loading";
};

export function MediaPlaceholder({ className, label = "Media is loading", state = "loading" }: MediaPlaceholderProps) {
  return (
    <div
      aria-busy={state === "loading" || undefined}
      aria-label={label}
      className={mergeClassNames("media-placeholder", `media-placeholder--${state}`, className)}
      role="img"
    >
      {state === "error" ? <WarningCircleIcon aria-hidden="true" size={28} weight="light" /> : <SkeletonBlock />}
    </div>
  );
}

export function InlineLoader({ className, label }: { className?: string; label: string }) {
  return (
    <div aria-atomic="true" aria-live="polite" className={mergeClassNames("state-inline-loader", className)} role="status">
      <CircleNotchIcon aria-hidden="true" className="state-inline-loader__icon" size={18} weight="bold" />
      <span>{label}</span>
    </div>
  );
}

export function ButtonLoadingState({ label }: { label: string }) {
  return (
    <span className="state-button-loader">
      <CircleNotchIcon aria-hidden="true" className="state-button-loader__icon" size={18} weight="bold" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

type EmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  secondaryAction?: ReactNode;
  title: string;
  variant?: "no-data" | "no-results";
};

export function EmptyState({
  action,
  className,
  description,
  icon,
  secondaryAction,
  title,
  variant = "no-data"
}: EmptyStateProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={mergeClassNames("state-empty", `state-empty--${variant}`, className)}>
      <div aria-hidden="true" className="state-empty__icon">
        {icon ?? <MagnifyingGlassIcon size={28} weight="light" />}
      </div>
      <h2 id={titleId}>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action || secondaryAction ? <div className="state-empty__actions">{action}{secondaryAction}</div> : null}
    </section>
  );
}

type RetryActionProps = Omit<ButtonProps, "loading" | "onClick"> & {
  onRetry: () => Promise<unknown> | unknown;
};

export function RetryAction({ children = "Try again", disabled, onRetry, ...props }: RetryActionProps) {
  const pendingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);

  async function retry() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsPending(true);
    try {
      await onRetry();
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }

  return (
    <Button {...props} disabled={disabled} loading={isPending} loadingLabel="Trying again" onClick={() => void retry()}>
      {children}
    </Button>
  );
}

type ErrorStateProps = {
  action?: ReactNode;
  className?: string;
  description: ReactNode;
  onRetry?: () => Promise<unknown> | unknown;
  retryLabel?: string;
  title?: string;
};

function ErrorState({ action, className, description, onRetry, retryLabel = "Try again", title }: ErrorStateProps) {
  const titleId = useId();
  return (
    <div aria-labelledby={title ? titleId : undefined} className={className} role="alert">
      <WarningCircleIcon aria-hidden="true" className="state-error__icon" size={24} weight="light" />
      <div className="state-error__copy">
        {title ? <h2 id={titleId}>{title}</h2> : null}
        <p>{description}</p>
      </div>
      {onRetry ? <RetryAction onRetry={onRetry} size="small">{retryLabel}</RetryAction> : action}
    </div>
  );
}

export function InlineError(props: Omit<ErrorStateProps, "className" | "title"> & { className?: string }) {
  return <ErrorState {...props} className={mergeClassNames("state-error state-error--inline", props.className)} />;
}

export function SectionError(props: ErrorStateProps) {
  return <ErrorState {...props} className={mergeClassNames("state-error state-error--section", props.className)} title={props.title ?? "This section could not load."} />;
}

export function PageError(props: ErrorStateProps) {
  return <ErrorState {...props} className={mergeClassNames("state-error state-error--page", props.className)} title={props.title ?? "Something went wrong."} />;
}

export type ConnectionKind = "degraded" | "failed" | "offline" | "reconnecting";

const connectionCopy: Record<ConnectionKind, { description: string; title: string }> = {
  degraded: { description: "Some updates may be delayed. Your current view is still available.", title: "Connection is limited." },
  failed: { description: "Automatic recovery stopped. Try again when your connection is ready.", title: "We could not reconnect." },
  offline: { description: "Some actions are unavailable until your connection returns.", title: "You’re offline." },
  reconnecting: { description: "Showing the latest loaded state while Vibehall reconnects.", title: "Reconnecting…" }
};

export function ConnectionBanner({ className, kind, onRetry }: { className?: string; kind: ConnectionKind; onRetry?: () => Promise<unknown> | unknown }) {
  const copy = connectionCopy[kind];
  const Icon = kind === "offline" ? CloudSlashIcon : kind === "failed" ? XCircleIcon : ArrowsClockwiseIcon;
  return (
    <aside
      aria-atomic="true"
      aria-live={kind === "failed" ? "assertive" : "polite"}
      className={mergeClassNames("state-connection", `state-connection--${kind}`, className)}
      role={kind === "failed" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="state-connection__icon" size={22} weight="light" />
      <div><strong>{copy.title}</strong><span>{copy.description}</span></div>
      {onRetry && kind === "failed" ? <RetryAction onRetry={onRetry} size="small" variant="text">Try again</RetryAction> : null}
    </aside>
  );
}

export function ActionFeedback({ children, className, tone = "info" }: { children: ReactNode; className?: string; tone?: FeedbackTone }) {
  const Icon = toneIcons[tone];
  return (
    <div
      aria-atomic="true"
      aria-live={tone === "danger" ? "assertive" : "polite"}
      className={mergeClassNames("state-action-feedback", `state-action-feedback--${tone}`, className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" size={20} weight="light" />
      <span>{children}</span>
    </div>
  );
}
