import { forwardRef, type ButtonHTMLAttributes, type ReactElement } from "react";
import { mergeClassNames } from "./utils";

export type ButtonVariant = "danger" | "primary" | "secondary" | "text";
export type ButtonSize = "large" | "small" | "default";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled = false,
    fullWidth = false,
    loading = false,
    loadingLabel,
    size = "default",
    type = "button",
    variant = "secondary",
    "aria-label": ariaLabel,
    ...props
  },
  ref
) {
  return (
    <button
      {...props}
      aria-label={loading && loadingLabel ? loadingLabel : ariaLabel}
      aria-busy={loading || undefined}
      className={mergeClassNames(
        "ui-button",
        `ui-button--${variant}`,
        `ui-button--${size}`,
        fullWidth && "ui-button--full-width",
        loading && "is-loading",
        className
      )}
      disabled={disabled || loading}
      ref={ref}
      type={type}
    >
      {loading ? <span aria-hidden="true" className="ui-button__spinner" /> : null}
      <span className="ui-button__label">{children}</span>
    </button>
  );
});

export type IconButtonProps = Omit<ButtonProps, "children" | "fullWidth" | "loadingLabel" | "size"> & {
  icon: ReactElement;
  label: string;
  tooltip?: string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, icon, label, loading = false, tooltip, variant = "secondary", ...props },
  ref
) {
  return (
    <Button
      {...props}
      aria-label={label}
      className={mergeClassNames("ui-icon-button", className)}
      loading={loading}
      ref={ref}
      title={tooltip ?? label}
      variant={variant}
    >
      <span aria-hidden="true" className="ui-icon-button__icon">{icon}</span>
    </Button>
  );
});
