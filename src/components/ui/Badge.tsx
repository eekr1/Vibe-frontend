import type { HTMLAttributes, ReactNode } from "react";
import { mergeClassNames } from "./utils";

export type BadgeKind = "account" | "admin" | "host" | "job" | "live" | "report" | "room";
export type StatusTone = "danger" | "info" | "neutral" | "success" | "warning";

const defaultBadgeTone: Record<BadgeKind, StatusTone> = {
  account: "neutral",
  admin: "info",
  host: "info",
  job: "neutral",
  live: "success",
  report: "neutral",
  room: "neutral"
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  kind: BadgeKind;
  tone?: StatusTone;
};

export function Badge({ children, className, kind, tone = defaultBadgeTone[kind], ...props }: BadgeProps) {
  return (
    <span {...props} className={mergeClassNames("ui-status-badge", `is-${tone}`, className)} data-kind={kind}>
      {children}
    </span>
  );
}

export type StatusIndicatorProps = HTMLAttributes<HTMLSpanElement> & {
  label: string;
  showLabel?: boolean;
  tone: StatusTone;
};

export function StatusIndicator({ className, label, showLabel = true, tone, ...props }: StatusIndicatorProps) {
  return (
    <span {...props} className={mergeClassNames("ui-status-indicator", `is-${tone}`, className)}>
      <span aria-hidden="true" className="ui-status-indicator__dot" />
      <span className={showLabel ? undefined : "visually-hidden"}>{label}</span>
    </span>
  );
}
