"use client";

import React from "react";

interface EditablePreviewInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
  type?: string;
  align?: "left" | "center" | "right";
  underline?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function EditablePreviewInput({
  value,
  onChange,
  disabled = false,
  className = "",
  type = "text",
  align = "left",
  underline = true,
  onKeyDown,
}: EditablePreviewInputProps) {
  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  return (
    <input
      type={type}
      value={value ?? ""}
      disabled={disabled}
      readOnly={disabled}
      placeholder=""
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`bg-transparent outline-none transition-colors px-1 py-0.5 rounded-[2px] ${alignClass} ${
        underline ? "border-b border-black" : "border border-transparent"
      } ${
        !disabled
          ? "cursor-text hover:bg-blue-50/50 hover:border-blue-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-400 focus:shadow-xs"
          : "cursor-default"
      } print:border-b print:border-black print:bg-transparent print:placeholder-transparent ${className}`}
      style={{
        fontFamily: "inherit",
        fontSize: "inherit",
        fontWeight: "inherit",
        lineHeight: "inherit",
        color: "inherit",
      }}
    />
  );
}
