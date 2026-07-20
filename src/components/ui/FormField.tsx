import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from "react";
import { mergeClassNames } from "./utils";

type FormControlAccessibilityProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "false" | "true";
  id?: string;
  required?: boolean;
};

export type FormFieldProps = {
  children: ReactElement<FormControlAccessibilityProps>;
  className?: string;
  error?: string | null;
  hint?: ReactNode;
  label: ReactNode;
  required?: boolean;
};

export function FormField({ children, className, error, hint, label, required = false }: FormFieldProps) {
  const generatedId = useId();
  if (!isValidElement<FormControlAccessibilityProps>(children)) return null;

  const controlId = children.props.id ?? `field-${generatedId.replaceAll(":", "")}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = cloneElement(children, {
    "aria-describedby": describedBy,
    "aria-invalid": error ? "true" : children.props["aria-invalid"],
    id: controlId,
    required: required || children.props.required
  });

  return (
    <div className={mergeClassNames("ui-form-field", error && "has-error", className)}>
      <label className="ui-form-field__label" htmlFor={controlId}>
        {label}
        {required ? <span aria-hidden="true" className="ui-form-field__required">*</span> : null}
        {required ? <span className="visually-hidden">Required</span> : null}
      </label>
      {control}
      {hint ? <div className="ui-form-field__hint" id={hintId}>{hint}</div> : null}
      {error ? <ErrorMessage id={errorId}>{error}</ErrorMessage> : null}
    </div>
  );
}

export function ErrorMessage({ children, id }: { children: ReactNode; id?: string }) {
  return <div className="ui-error-message" id={id} role="alert">{children}</div>;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input {...props} className={mergeClassNames("ui-input", className)} ref={ref} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref
) {
  return <textarea {...props} className={mergeClassNames("ui-textarea", className)} ref={ref} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref
) {
  return <select {...props} className={mergeClassNames("ui-select", className)} ref={ref} />;
});

type ChoiceFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  error?: string | null;
  hint?: ReactNode;
  label: ReactNode;
  type: "checkbox" | "radio";
};

export const ChoiceField = forwardRef<HTMLInputElement, ChoiceFieldProps>(function ChoiceField(
  { className, error, hint, id, label, type, ...props },
  ref
) {
  const generatedId = useId();
  const controlId = id ?? `choice-${generatedId.replaceAll(":", "")}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return (
    <div className={mergeClassNames("ui-choice", error && "has-error", className)}>
      <label className="ui-choice__label" htmlFor={controlId}>
        <input
          {...props}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? "true" : undefined}
          className="ui-choice__control"
          id={controlId}
          ref={ref}
          type={type}
        />
        <span>{label}</span>
      </label>
      {hint ? <div className="ui-form-field__hint" id={hintId}>{hint}</div> : null}
      {error ? <ErrorMessage id={errorId}>{error}</ErrorMessage> : null}
    </div>
  );
});
