import * as React from "react";
import { AlertCircle } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { hasError = false, className = "", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={hasError || undefined}
      className={`h-11 w-full rounded-[8px] border bg-white px-3.5 font-sans text-sm text-gray-800 placeholder:text-gray-600/70 focus:border-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-gray-100 ${
        hasError ? "border-status-danger-fg" : "border-gray-600/35"
      } ${className}`.trim()}
      {...props}
    />
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { hasError = false, className = "", ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={hasError || undefined}
      className={`min-h-[88px] w-full rounded-[8px] border bg-white px-3.5 py-2.5 font-sans text-sm text-gray-800 placeholder:text-gray-600/70 focus:border-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-gray-100 ${
        hasError ? "border-status-danger-fg" : "border-gray-600/35"
      } ${className}`.trim()}
      {...props}
    />
  );
});

export interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  requiredSrLabel?: string;
  helperText?: string;
  error?: string | null;
  children: React.ReactNode;
}

export function FormField({
  id,
  label,
  required = false,
  requiredSrLabel = "(required)",
  helperText,
  error,
  children,
}: FormFieldProps) {
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-sans text-sm font-medium text-gray-800">
        <span>{label}</span>
        {required ? (
          <>
            <span aria-hidden="true" className="ml-1 text-status-danger-fg">
              *
            </span>
            <span className="sr-only"> {requiredSrLabel}</span>
          </>
        ) : null}
      </label>

      {children}

      {helperText && !error ? (
        <p id={helperId} className="font-sans text-xs text-gray-600">
          {helperText}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 font-sans text-xs font-medium text-status-danger-fg"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
