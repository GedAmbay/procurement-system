/**
 * Helpers for keyboard shortcuts and formatting (Ctrl+B for Bold, Ctrl+I for Italic)
 * Supports hybrid Excel cell-level formatting and Word-level inline text formatting.
 */

export type FormatType = "bold" | "italic";

/**
 * Checks if a string is entirely wrapped in bold (**...**) or italic (*...*).
 */
export function isCellFormatted(text: string, format: FormatType): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (format === "bold") {
    // Bold is wrapped with **...** or ***...***
    return (
      (trimmed.startsWith("***") && trimmed.endsWith("***") && trimmed.length >= 6) ||
      (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length >= 4)
    );
  } else {
    // Italic is wrapped with *...* or ***...***
    return (
      (trimmed.startsWith("***") && trimmed.endsWith("***") && trimmed.length >= 6) ||
      (trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**") && trimmed.length >= 2)
    );
  }
}

/**
 * Toggles bold or italic on an entire cell value (Excel mode).
 * Preserves leading and trailing whitespace.
 */
export function toggleCellFormat(text: string, format: FormatType): string {
  if (!text) return "";

  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const leading = match ? match[1] : "";
  const core = match ? match[2] : text;
  const trailing = match ? match[3] : "";

  if (!core) return text;

  if (format === "bold") {
    // If it has bold-italic (***core***) -> strip bold, leave italic (*core*)
    if (core.startsWith("***") && core.endsWith("***") && core.length >= 6) {
      return `${leading}*${core.slice(3, -3)}*${trailing}`;
    }
    // If it has bold (**core**) -> strip bold, leave plain
    if (core.startsWith("**") && core.endsWith("**") && core.length >= 4) {
      return `${leading}${core.slice(2, -2)}${trailing}`;
    }
    // If it has italic (*core*) -> add bold -> (***core***)
    if (core.startsWith("*") && core.endsWith("*") && core.length >= 2) {
      return `${leading}***${core.slice(1, -1)}***${trailing}`;
    }
    // Plain text -> wrap in **core**
    return `${leading}**${core}**${trailing}`;
  } else {
    // Format is italic
    // If it has bold-italic (***core***) -> strip italic, leave bold (**core**)
    if (core.startsWith("***") && core.endsWith("***") && core.length >= 6) {
      return `${leading}**${core.slice(3, -3)}**${trailing}`;
    }
    // If it has italic (*core*) -> strip italic, leave plain
    if (core.startsWith("*") && core.endsWith("*") && !core.startsWith("**") && core.length >= 2) {
      return `${leading}${core.slice(1, -1)}${trailing}`;
    }
    // If it has bold (**core**) -> add italic -> (***core***)
    if (core.startsWith("**") && core.endsWith("**") && core.length >= 4) {
      return `${leading}***${core.slice(2, -2)}***${trailing}`;
    }
    // Plain text -> wrap in *core*
    return `${leading}*${core}*${trailing}`;
  }
}

/**
 * Applies bold or italic to the current selection in an input or textarea (Word mode).
 * If no text is selected (cursor collapsed), inserts empty formatting tags and positions cursor between them.
 */
export function applyInlineFormat(
  text: string,
  start: number,
  end: number,
  format: FormatType
): { newText: string; newStart: number; newEnd: number } {
  const delim = format === "bold" ? "**" : "*";
  const delimLen = delim.length;

  // Case 1: Text is selected
  if (start !== end) {
    const selected = text.slice(start, end);
    const before = text.slice(0, start);
    const after = text.slice(end);

    // 1a: The selection itself starts and ends with the delimiter (e.g. user selected "**word**")
    if (
      format === "bold" &&
      selected.startsWith("**") &&
      selected.endsWith("**") &&
      selected.length >= 4
    ) {
      const unwrapped = selected.slice(2, -2);
      return {
        newText: before + unwrapped + after,
        newStart: start,
        newEnd: start + unwrapped.length,
      };
    }
    if (
      format === "italic" &&
      selected.startsWith("*") &&
      selected.endsWith("*") &&
      !selected.startsWith("**") &&
      selected.length >= 2
    ) {
      const unwrapped = selected.slice(1, -1);
      return {
        newText: before + unwrapped + after,
        newStart: start,
        newEnd: start + unwrapped.length,
      };
    }

    // 1b: The selection is immediately wrapped by delimiters outside (e.g. "**[word]**")
    if (format === "bold" && before.endsWith("**") && after.startsWith("**")) {
      return {
        newText: before.slice(0, -2) + selected + after.slice(2),
        newStart: start - 2,
        newEnd: end - 2,
      };
    }
    if (
      format === "italic" &&
      before.endsWith("*") &&
      !before.endsWith("**") &&
      after.startsWith("*") &&
      !after.startsWith("**")
    ) {
      return {
        newText: before.slice(0, -1) + selected + after.slice(1),
        newStart: start - 1,
        newEnd: end - 1,
      };
    }

    // 1c: Wrap selection in delimiter
    return {
      newText: before + delim + selected + delim + after,
      newStart: start,
      newEnd: end + delimLen * 2,
    };
  }

  // Case 2: Cursor collapsed (no selection) -> insert delimiter pair and place cursor in the middle
  const before = text.slice(0, start);
  const after = text.slice(start);

  return {
    newText: before + delim + delim + after,
    newStart: start + delimLen,
    newEnd: start + delimLen,
  };
}

/**
 * Convenience keydown handler for inputs and textareas to handle Ctrl+B / Ctrl+I.
 * Returns true if handled.
 */
export function handleTextFormattingKeyDown(
  e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  onChange: (newValue: string) => void
): boolean {
  if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B" || e.key === "i" || e.key === "I")) {
    e.preventDefault();
    const format: FormatType = (e.key === "b" || e.key === "B") ? "bold" : "italic";
    const target = e.currentTarget;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const { newText, newStart, newEnd } = applyInlineFormat(target.value, start, end, format);
    onChange(newText);
    requestAnimationFrame(() => {
      target.setSelectionRange(newStart, newEnd);
      if (target.tagName.toLowerCase() === "textarea") {
        target.style.height = "auto";
        target.style.height = `${Math.max(20, target.scrollHeight)}px`;
      }
    });
    return true;
  }
  return false;
}
