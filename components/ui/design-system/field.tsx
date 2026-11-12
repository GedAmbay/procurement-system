import React from "react";

export interface FieldProps {
  label?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  required = false,
  helperText,
  error,
  id,
  children,
  className = "",
}: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-bold text-slate-700 tracking-wide flex items-center gap-1 select-none"
        >
          <span>{label}</span>
          {required && <span className="text-red-500 font-bold">*</span>}
        </label>
      )}

      {children}

      {error ? (
        <span role="alert" className="text-xs font-semibold text-red-600">
          {error}
        </span>
      ) : helperText ? (
        <span className="text-xs text-slate-500 font-normal">
          {helperText}
        </span>
      ) : null}
    </div>
  );
}

