"use client";

import React from "react";

interface FormattedCellTextProps {
  text?: string | null;
  className?: string;
  fallback?: React.ReactNode;
}

// Regex to capture markdown formatting:
// Group 1: ***bold italic***
// Group 2: **bold**
// Group 3: *italic* (not followed or preceded by space, and not double asterisks)
// Group 4: newlines \n
const FORMAT_REGEX = /(\*\*\*[^\s*](?:[\s\S]*?[^\s*])?\*\*\*|\*\*[^\s*](?:[\s\S]*?[^\s*])?\*\*|\*[^\s*](?:[\s\S]*?[^\s*])?\*|\n)/g;

function renderWithBreaks(content: string, keyPrefix: string | number) {
  const lines = content.split("\n");
  if (lines.length === 1) return content;
  return lines.map((line, lIdx) => (
    <React.Fragment key={`${keyPrefix}-line-${lIdx}`}>
      {lIdx > 0 && <br />}
      {line}
    </React.Fragment>
  ));
}

/**
 * Parses markdown-like bold (**text**) and italic (*text*) strings into React nodes.
 * Safe against XSS, fast, and does not require third-party dependencies.
 */
export function parseFormattedText(text?: string | null): React.ReactNode {
  if (!text) return null;

  // Quick bail-out if there are no asterisks or newlines
  if (!text.includes("*") && !text.includes("\n")) {
    return text;
  }

  const parts = text.split(FORMAT_REGEX);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part === "\n") {
      return <br key={index} />;
    }

    // Bold + Italic: ***text***
    if (part.startsWith("***") && part.endsWith("***") && part.length >= 6) {
      const inner = part.slice(3, -3);
      return (
        <strong key={index} className="font-bold">
          <em className="italic">{renderWithBreaks(inner, index)}</em>
        </strong>
      );
    }

    // Bold: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <strong key={index} className="font-bold">
          {renderWithBreaks(inner, index)}
        </strong>
      );
    }

    // Italic: *text*
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <em key={index} className="italic">
          {renderWithBreaks(inner, index)}
        </em>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/**
 * Component to display cell text with support for bold (**...**) and italic (*...*).
 */
export function FormattedCellText({
  text,
  className,
  fallback = "\u00A0",
}: FormattedCellTextProps) {
  if (text === null || text === undefined || text === "") {
    return <span className={className}>{fallback}</span>;
  }

  const content = parseFormattedText(text);

  return <span className={className}>{content}</span>;
}

export default FormattedCellText;
