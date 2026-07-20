import type { HTMLAttributes, ElementType } from "react";
import { mergeClassNames } from "./utils";

export type SurfaceLevel = "elevated" | "ground" | "interactive" | "standard";
export type SurfacePadding = "large" | "medium" | "none" | "small";

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  bordered?: boolean;
  level?: SurfaceLevel;
  padding?: SurfacePadding;
};

export function Surface({
  as: Component = "div",
  bordered = false,
  className,
  level = "standard",
  padding = "medium",
  ...props
}: SurfaceProps) {
  return (
    <Component
      {...props}
      className={mergeClassNames(
        "ui-surface",
        `ui-surface--${level}`,
        `ui-surface--padding-${padding}`,
        bordered && "is-bordered",
        className
      )}
    />
  );
}

export function Panel(props: Omit<SurfaceProps, "level">) {
  return <Surface {...props} level="standard" />;
}
