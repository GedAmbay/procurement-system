"use client";

import { useLayoutEffect, useRef } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { FormattedCellText } from "@/components/ui/formatted-cell-text";
import { handleTextFormattingKeyDown } from "@/lib/format-text-helpers";

interface EditableDescriptionCellProps {
  value: string;
  onChange: (value: string) => void;
  /** When true, renders plain text exactly like the printed document. */
  readOnly?: boolean;
  /** Text differs from the source document (PR for RFQ, RFQ for PO). */
  edited?: boolean;
  /** Label of the source document, used in tooltips/buttons ("PR", "RFQ"). */
  sourceLabel?: string;
  /** Reset the text back to the source document's text. */
  onReset?: () => void;
  /** Source text changed after this row was edited. */
  sourceChanged?: boolean;
  /** Current source text, shown when `sourceChanged`. */
  sourceText?: string;
  /** Keep the edited text and dismiss the "source changed" warning. */
  onKeepMine?: () => void;
  /** Groups cells so Enter / arrow keys move between rows of the same table. */
  group: string;
}

/**
 * A spreadsheet-like editable cell for document previews.
 * Looks identical to printed text; on hover/focus it shows a subtle edit affordance.
 * Enter = next row, Shift+Enter = new line, Esc = undo changes made since focusing.
 */
export default function EditableDescriptionCell({
  value,
  onChange,
  readOnly,
  edited,
  sourceLabel = "source",
  onReset,
  sourceChanged,
  sourceText,
  onKeepMine,
  group,
}: EditableDescriptionCellProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const valueOnFocus = useRef(value);

  // Auto-grow to fit content (layout size is unaffected by the preview's CSS zoom transform)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, readOnly]);

  if (readOnly) {
    return <FormattedCellText text={value} className="whitespace-pre-wrap" />;
  }

  const focusSibling = (dir: 1 | -1) => {
    const cells = Array.from(
      document.querySelectorAll<HTMLTextAreaElement>(`textarea[data-cell-group="${group}"]`)
    );
    const idx = cells.indexOf(ref.current!);
    const next = cells[idx + dir];
    if (next) {
      next.focus();
      const end = next.value.length;
      next.setSelectionRange(end, end);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (handleTextFormattingKeyDown(e, onChange)) {
      return;
    }

    const el = e.currentTarget;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      focusSibling(1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onChange(valueOnFocus.current);
      el.blur();
    } else if (e.key === "ArrowDown" && el.selectionStart === el.value.length) {
      e.preventDefault();
      focusSibling(1);
    } else if (e.key === "ArrowUp" && el.selectionStart === 0) {
      e.preventDefault();
      focusSibling(-1);
    }
  };

  return (
    <div className="relative group/cell">
      <textarea
        ref={ref}
        data-cell-group={group}
        rows={1}
        value={value}
        spellCheck={false}
        onFocus={() => (valueOnFocus.current = value)}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        title="Click to edit · Ctrl+B = Bold · Ctrl+I = Italic · Enter = next row · Shift+Enter = new line · Esc = undo"
        className={`print:hidden block w-full resize-none overflow-hidden bg-transparent p-0 m-0 border-0 outline-none rounded-[2px] cursor-text
          [font:inherit] [line-height:inherit] [color:inherit] [text-align:inherit]
          hover:bg-blue-50/70 focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 transition-colors
          ${edited ? "underline decoration-dotted decoration-blue-400 underline-offset-2" : ""}
          ${sourceChanged ? "bg-amber-50 ring-1 ring-amber-300" : ""}`}
      />
      {/* Printed output uses formatted text */}
      <FormattedCellText text={value} className="hidden print:inline whitespace-pre-wrap" />

      {(edited || sourceChanged) && (
        <div
          className="no-print absolute -right-1 top-0 translate-x-full pl-2 z-20 hidden group-hover/cell:flex group-focus-within/cell:flex flex-col gap-1 items-start"
          style={{ fontFamily: "Inter, system-ui, sans-serif", fontWeight: 400, fontStyle: "normal" }}
        >
          {sourceChanged && (
            <div className="w-56 rounded-md border border-amber-300 bg-amber-50 p-2 text-[10px] leading-snug text-amber-900 shadow-md">
              <div className="flex items-center gap-1 font-semibold mb-1">
                <AlertTriangle size={11} /> {sourceLabel} description changed
              </div>
              <div className="italic text-amber-800 mb-1.5 line-clamp-3">“{sourceText}”</div>
              <div className="flex gap-1">
                {onReset && (
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onReset}
                    className="rounded bg-amber-600 px-1.5 py-0.5 font-semibold text-white hover:bg-amber-700">
                    Use {sourceLabel} text
                  </button>
                )}
                {onKeepMine && (
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onKeepMine}
                    className="rounded border border-amber-400 bg-white px-1.5 py-0.5 font-semibold hover:bg-amber-100">
                    Keep mine
                  </button>
                )}
              </div>
            </div>
          )}
          {edited && !sourceChanged && onReset && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onReset}
              className="flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm hover:bg-slate-50"
              title={`Restore the original ${sourceLabel} description`}
            >
              <RotateCcw size={10} /> Reset to {sourceLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
