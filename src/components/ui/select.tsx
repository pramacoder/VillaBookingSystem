import * as React from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: readonly SelectOption[];
  hasError?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, hasError = false, className = "", children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={hasError || undefined}
      className={`h-11 w-full rounded-[8px] border bg-white px-3.5 font-sans text-sm text-gray-800 focus:border-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-gray-100 ${
        hasError ? "border-status-danger-fg" : "border-gray-600/35"
      } ${className}`.trim()}
      {...props}
    >
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
});
