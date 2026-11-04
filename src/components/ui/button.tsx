import * as React from "react";

export type ButtonVariant =
  "primary" | "onTeal" | "secondary" | "ghost" | "destructive" | "destructiveSolid";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-600/90 active:bg-blue-600",
  onTeal: "border border-gray-800/20 bg-white text-gray-800 hover:bg-gray-100 active:bg-gray-100",
  secondary:
    "border border-gray-600/40 bg-white text-gray-800 hover:bg-gray-100 active:bg-gray-100",
  ghost: "bg-transparent text-gray-800 hover:bg-gray-100 active:bg-gray-100",
  destructive:
    "border border-status-danger-fg/50 bg-white text-status-danger-fg hover:bg-status-danger-bg",
  destructiveSolid: "bg-status-danger-fg text-white hover:bg-status-danger-fg/90",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-11 px-4 py-2.5 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    isLoading = false,
    loadingText,
    disabled,
    className = "",
    children,
    type = "button",
    ...props
  },
  ref,
) {
  const isDisabled = Boolean(disabled || isLoading);
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-[6px] font-sans font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim()}
      {...props}
    >
      {isLoading ? (loadingText ?? children) : children}
    </button>
  );
});
