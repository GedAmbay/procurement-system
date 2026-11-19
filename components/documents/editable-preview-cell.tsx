"use client";

import React, { useLayoutEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";

interface EditablePreviewCellProps {
  value: string;
  originalPrValue?: string;
  isEdited?: boolean;
  isReadOnly?: boolean;
  onChange: (newValue: string) => void;
  onReset?: () => void;
  onNavigate?: (direction: "next" | "prev") => void;
  cellClassName?: string;
  isSpec?: boolean;
  hasSpecs?: boolean;
}

export function EditablePreviewCell({
  value,
  originalPrValue,
  isEdited = false,
  isReadOnly = false,
  onChange,
  onReset,
  onNavigate,
  cellClassName = "",
  isSpec = false,
  hasSpecs = false,
}: EditablePreviewCellProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height to scrollHeight
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(20, el.scrollHeight)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onNavigate?.("next");
    } else if (e.key === "Tab") {
      e.preventDefault();
      onNavigate?.(e.shiftKey ? "prev" : "next");
    }
  };

  return (
    <div className="relative group/cell w-full min-w-0">
      {/* Printed version - static clean text */}
      <div className={`hidden print:block whitespace-pre-wrap ${isSpec ? "pl-6 text-[14px]" : hasSpecs ? "font-bold" : ""}`}>
        {value || ""}
      </div>

      {/* Screen Interactive - clean textarea with no placeholder or labels */}
      <div className="print:hidden relative w-full flex items-start">
        <textarea
          ref={textareaRef}
          value={value || ""}
          disabled={isReadOnly}
          readOnly={isReadOnly}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.max(20, e.target.scrollHeight)}px`;
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder=""
          className={`w-full bg-transparent resize-none overflow-hidden outline-none transition-colors border border-transparent rounded px-1 py-0.5 leading-normal ${
            !isReadOnly
              ? "cursor-text hover:border-blue-400 hover:bg-blue-50/50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-400 focus:shadow-xs"
              : "cursor-default"
          } ${isSpec ? "pl-6 text-[14px]" : hasSpecs ? "font-bold" : ""} ${cellClassName}`}
          style={{
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "inherit",
            color: "inherit",
          }}
        />

        {/* Reset button if edited (only appears on subtle hover) */}
        {!isReadOnly && isEdited && onReset && originalPrValue && (
          <div className="absolute right-1 top-0.5 opacity-0 group-hover/cell:opacity-100 group-focus-within/cell:opacity-100 transition-opacity z-10 no-print">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReset();
              }}
              className="p-0.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded text-[9px] flex items-center gap-0.5 px-1 font-sans font-medium shadow-xs"
              title={`Reset to PR description: "${originalPrValue}"`}
            >
              <RotateCcw size={9} />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
