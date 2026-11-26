"use client";

import React, { useState, useId } from "react";
import { createPortal } from "react-dom";

export function ModalPortal({
  children,
  onBackdropClick,
}: {
  children: React.ReactNode;
  onBackdropClick?: () => void;
}) {
  const content = (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && onBackdropClick) {
          onBackdropClick();
        }
      }}
    >
      {children}
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}

interface FloatingInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  required?: boolean;
  optionalBadge?: boolean;
  hasError?: boolean;
}

export function FloatingInput({
  label,
  required,
  optionalBadge,
  hasError,
  value,
  placeholder,
  type = "text",
  id,
  onFocus,
  onBlur,
  style,
  ...rest
}: FloatingInputProps) {
  const [focused, setFocused] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;
  const strVal = String(value ?? "");
  const isDateOrTime = type === "date" || type === "time";
  const isFloating = focused || strVal.length > 0 || isDateOrTime;

  return (
    <div style={{ position: "relative" }}>
      <input
        id={inputId}
        type={type}
        value={value}
        required={required}
        placeholder={focused && !isDateOrTime ? placeholder : " "}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={{
          width: "100%",
          height: "54px",
          padding: "1.25rem 0.875rem 0.4rem",
          border: hasError
            ? "2px solid #ef4444"
            : focused
            ? "2px solid #0f172a"
            : "2px solid transparent",
          borderRadius: "0.625rem",
          fontSize: "0.9rem",
          fontWeight: 500,
          color: "#0f172a",
          background: focused ? "#ffffff" : "#ECF0F3",
          outline: "none",
          boxSizing: "border-box",
          boxShadow: focused
            ? "none"
            : "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff",
          transition: "all 0.16s ease-in-out",
          ...style,
        }}
        {...rest}
      />
      <label
        htmlFor={inputId}
        style={{
          position: "absolute",
          left: "0.875rem",
          top: isFloating ? "0.45rem" : "50%",
          transform: isFloating ? "translateY(0)" : "translateY(-50%)",
          fontSize: isFloating ? "0.625rem" : "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: hasError ? "#ef4444" : focused ? "#0f172a" : "#64748b",
          pointerEvents: "none",
          transition: "all 0.16s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
        {optionalBadge && !required && (
          <span style={{ fontWeight: 500, opacity: 0.65, marginLeft: "0.35rem" }}>
            (Optional)
          </span>
        )}
      </label>
    </div>
  );
}

interface FloatingTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  required?: boolean;
  optionalBadge?: boolean;
  hasError?: boolean;
}

export function FloatingTextarea({
  label,
  required,
  optionalBadge,
  hasError,
  value,
  placeholder,
  id,
  rows = 3,
  onFocus,
  onBlur,
  style,
  ...rest
}: FloatingTextareaProps) {
  const [focused, setFocused] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;
  const strVal = String(value ?? "");
  const isFloating = focused || strVal.length > 0;

  return (
    <div style={{ position: "relative" }}>
      <textarea
        id={inputId}
        value={value}
        required={required}
        rows={rows}
        placeholder={focused ? placeholder : " "}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={{
          width: "100%",
          minHeight: "84px",
          padding: "1.4rem 0.875rem 0.5rem",
          border: hasError
            ? "2px solid #ef4444"
            : focused
            ? "2px solid #0f172a"
            : "2px solid transparent",
          borderRadius: "0.625rem",
          fontSize: "0.9rem",
          fontWeight: 500,
          color: "#0f172a",
          background: focused ? "#ffffff" : "#ECF0F3",
          outline: "none",
          boxSizing: "border-box",
          resize: "vertical",
          boxShadow: focused
            ? "none"
            : "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff",
          transition: "all 0.16s ease-in-out",
          ...style,
        }}
        {...rest}
      />
      <label
        htmlFor={inputId}
        style={{
          position: "absolute",
          left: "0.875rem",
          top: isFloating ? "0.45rem" : "1rem",
          fontSize: isFloating ? "0.625rem" : "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: hasError ? "#ef4444" : focused ? "#0f172a" : "#64748b",
          pointerEvents: "none",
          transition: "all 0.16s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
        {optionalBadge && !required && (
          <span style={{ fontWeight: 500, opacity: 0.65, marginLeft: "0.35rem" }}>
            (Optional)
          </span>
        )}
      </label>
    </div>
  );
}
