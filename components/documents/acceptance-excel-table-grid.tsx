"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { FormattedCellText } from "@/components/ui/formatted-cell-text";
import { toggleCellFormat, applyInlineFormat, FormatType } from "@/lib/format-text-helpers";

export interface AcceptanceLineItemData {
  id: string;
  description: string;
  unit: string;
  unitPrice: number;
  poQuantity: number;
  quantityDelivered: number;
  previouslyDelivered: number;
  propertyNo?: string;
}

interface AcceptanceExcelTableGridProps {
  items: AcceptanceLineItemData[];
  targetRows?: number;
  isReadOnly?: boolean;
  totalAmount?: number;
  onChange: (newItems: AcceptanceLineItemData[]) => void;
  onRowSelect?: (index: number) => void;
  activeItemIndex?: number | null;
  onDeselect?: () => void;
}

// Columns: 0 = Stock/Property No, 1 = Description, 2 = Unit, 3 = Quantity Delivered
type EditableCol = 0 | 1 | 2 | 3;

export function AcceptanceExcelTableGrid({
  items,
  targetRows = 15,
  isReadOnly = false,
  totalAmount = 0,
  onChange,
  onRowSelect,
  activeItemIndex = null,
  onDeselect,
}: AcceptanceExcelTableGridProps) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: EditableCol } | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>("");

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const initialValueOnEditRef = useRef<string>("");

  const safeItems = items || [];
  const itemsRef = useRef<AcceptanceLineItemData[]>(safeItems);
  useEffect(() => {
    itemsRef.current = items || [];
  }, [items]);

  // Get raw string value of a cell
  const getCellValue = useCallback((row: number, col: EditableCol): string => {
    const list = itemsRef.current || [];
    const item = list[row];
    if (!item) return "";
    switch (col) {
      case 0:
        return item.propertyNo || "";
      case 1:
        return item.description || "";
      case 2:
        return item.unit || "";
      case 3:
        return item.quantityDelivered === 0 ? "0" : String(item.quantityDelivered || "");
      default:
        return "";
    }
  }, []);

  // Commit value change for a cell
  const commitCellValue = useCallback((row: number, col: EditableCol, rawVal: string) => {
    if (isReadOnly) return;
    const trimmed = rawVal.trim();
    const currentList = itemsRef.current || [];

    if (row >= currentList.length) return;

    const newItems = [...currentList];
    const current = { ...newItems[row] };

    switch (col) {
      case 0:
        current.propertyNo = rawVal;
        break;
      case 1:
        current.description = rawVal;
        break;
      case 2:
        current.unit = rawVal;
        break;
      case 3: {
        const val = trimmed === "" ? 0 : isNaN(Number(trimmed)) ? 0 : Number(trimmed);
        const remaining = Math.max(0, current.poQuantity - (current.previouslyDelivered || 0));
        const clamped = Math.max(0, Math.min(val, remaining > 0 ? remaining : val));
        current.quantityDelivered = clamped;
        break;
      }
    }

    newItems[row] = current;
    itemsRef.current = newItems;
    onChange(newItems);
  }, [isReadOnly, onChange]);

  // Enter edit mode without overwriting existing content (appends typed character if provided)
  const startEditing = useCallback((row: number, col: EditableCol, initialChar?: string) => {
    if (isReadOnly) return;
    const val = getCellValue(row, col);
    initialValueOnEditRef.current = val;
    const nextVal = initialChar !== undefined ? val + initialChar : val;
    setEditValue(nextVal);
    setIsEditing(true);
  }, [isReadOnly, getCellValue]);

  // Focus active input when editing starts
  useEffect(() => {
    if (isEditing && activeInputRef.current) {
      activeInputRef.current.focus();
      const len = activeInputRef.current.value.length;
      activeInputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Keep selection container focused when in selection mode
  useEffect(() => {
    if (!isEditing && selectedCell && gridContainerRef.current) {
      gridContainerRef.current.focus({ preventScroll: true });
    }
  }, [selectedCell, isEditing]);

  // Synchronize cell highlight when active row changes from outside (e.g. Next/Prev buttons in side panel)
  useEffect(() => {
    if (activeItemIndex !== null && activeItemIndex !== undefined) {
      setSelectedCell((prev) => {
        const col = prev?.row === activeItemIndex ? prev.col : (prev?.col ?? 3);
        return { row: activeItemIndex, col };
      });
      setIsEditing(false);
    } else {
      setSelectedCell(null);
      setIsEditing(false);
    }
  }, [activeItemIndex]);

  // Handle cell selection click
  const handleCellClick = (row: number, col: EditableCol) => {
    if (isReadOnly) return;

    if (isEditing && selectedCell) {
      commitCellValue(selectedCell.row, selectedCell.col, editValue);
      setIsEditing(false);
    }

    setSelectedCell({ row, col });
    setIsEditing(false);

    if (onRowSelect) {
      onRowSelect(row);
    }
  };

  // Handle double click -> enter edit mode
  const handleCellDoubleClick = (row: number, col: EditableCol) => {
    if (isReadOnly) return;
    setSelectedCell({ row, col });
    startEditing(row, col);
  };

  // Navigation helper
  const navigateTo = useCallback((targetRow: number, targetCol: EditableCol, keepEditMode = false) => {
    let nextRow = targetRow;
    let nextCol = targetCol;

    // Wrap column boundaries (cols 0, 1, 2, 3)
    if (nextCol > 3) {
      nextCol = 0;
      nextRow += 1;
    } else if (nextCol < 0) {
      nextCol = 3;
      nextRow -= 1;
    }

    if (nextRow < 0) {
      nextRow = 0;
    }

    const maxRows = Math.max(targetRows, itemsRef.current?.length || 0);
    if (nextRow >= maxRows) {
      nextRow = maxRows - 1;
    }

    setSelectedCell({ row: nextRow, col: nextCol });
    if (onRowSelect) {
      onRowSelect(nextRow);
    }

    if (keepEditMode) {
      startEditing(nextRow, nextCol);
    } else {
      setIsEditing(false);
    }
  }, [targetRows, onRowSelect, startEditing]);

  // Keyboard navigation in SELECTION MODE
  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isReadOnly || !selectedCell || isEditing) return;

    const { row, col } = selectedCell;

    // Excel mode: Ctrl+B (bold) or Ctrl+I (italic) formatting on selected cell
    if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B" || e.key === "i" || e.key === "I")) {
      e.preventDefault();
      const format: FormatType = (e.key === "b" || e.key === "B") ? "bold" : "italic";
      const currentVal = getCellValue(row, col);
      if (currentVal) {
        const nextVal = toggleCellFormat(currentVal, format);
        commitCellValue(row, col, nextVal);
      }
      return;
    }

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        navigateTo(row - 1, col);
        break;
      case "ArrowDown":
        e.preventDefault();
        navigateTo(row + 1, col);
        break;
      case "ArrowLeft":
        e.preventDefault();
        navigateTo(row, (col - 1) as EditableCol);
        break;
      case "ArrowRight":
        e.preventDefault();
        navigateTo(row, (col + 1) as EditableCol);
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          navigateTo(row, (col - 1) as EditableCol);
        } else {
          navigateTo(row, (col + 1) as EditableCol);
        }
        break;
      case "Enter":
      case "F2":
        e.preventDefault();
        startEditing(row, col);
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        commitCellValue(row, col, col === 3 ? "0" : "");
        break;
      case "Escape":
        e.preventDefault();
        setSelectedCell(null);
        setIsEditing(false);
        if (onDeselect) onDeselect();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          startEditing(row, col, e.key);
        }
        break;
    }
  };

  // Keyboard navigation in EDIT MODE
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;

    // Word mode: Ctrl+B (bold) or Ctrl+I (italic) inline formatting on highlighted text
    if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B" || e.key === "i" || e.key === "I")) {
      e.preventDefault();
      const format: FormatType = (e.key === "b" || e.key === "B") ? "bold" : "italic";
      const target = e.currentTarget;
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      const { newText, newStart, newEnd } = applyInlineFormat(editValue, start, end, format);
      setEditValue(newText);
      requestAnimationFrame(() => {
        if (activeInputRef.current) {
          activeInputRef.current.setSelectionRange(newStart, newEnd);
          if (activeInputRef.current.tagName.toLowerCase() === "textarea") {
            activeInputRef.current.style.height = "auto";
            activeInputRef.current.style.height = `${Math.max(20, activeInputRef.current.scrollHeight)}px`;
          }
        }
      });
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitCellValue(row, col, editValue);
      navigateTo(row + 1, col, false);
    } else if (e.key === "Enter" && e.shiftKey) {
      if (col !== 1) {
        e.preventDefault();
        commitCellValue(row, col, editValue);
        navigateTo(row - 1, col, false);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitCellValue(row, col, editValue);
      if (e.shiftKey) {
        navigateTo(row, (col - 1) as EditableCol, false);
      } else {
        navigateTo(row, (col + 1) as EditableCol, false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditValue(initialValueOnEditRef.current);
      setIsEditing(false);
    } else if (col !== 1 && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      commitCellValue(row, col, editValue);
      navigateTo(e.key === "ArrowUp" ? row - 1 : row + 1, col, false);
    }
  };

  const handleInputBlur = () => {
    if (selectedCell && isEditing) {
      commitCellValue(selectedCell.row, selectedCell.col, editValue);
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={gridContainerRef}
      tabIndex={isReadOnly ? -1 : 0}
      onKeyDown={handleContainerKeyDown}
      className="outline-none focus:outline-none select-none"
    >
      <table className="w-full border-collapse border-y-2 border-black flex-1 table-fixed text-[14px]">
        <thead>
          <tr className="border-b-2 border-black h-8 text-[14px]">
            <th className="border-r-2 border-black font-bold text-center" style={{ width: "12%" }}>
              Stock/ Property No.
            </th>
            <th className="border-r-2 border-black font-bold text-center" style={{ width: "48%" }}>
              Description
            </th>
            <th className="border-r-2 border-black font-bold text-center" style={{ width: "20%" }}>
              Unit
            </th>
            <th className="font-bold text-center" style={{ width: "20%" }}>
              Quantity
            </th>
          </tr>
        </thead>
        <tbody>
          {safeItems.map((item, idx) => {
            const isSpec = !item.poQuantity || item.poQuantity === 0;

            let displayNo = "";
            if (!isSpec) {
              let count = 0;
              for (let i = 0; i <= idx; i++) {
                if (safeItems[i].poQuantity > 0) count++;
              }
              displayNo = count.toString();
            }

            const hasSpecs =
              !isSpec &&
              idx + 1 < safeItems.length &&
              (!safeItems[idx + 1].poQuantity || safeItems[idx + 1].poQuantity === 0);

            const isRowSelected = selectedCell?.row === idx || activeItemIndex === idx;

            // In print mode, hide zero-delivered items unless it's a spec under a delivered item
            const isZeroDelivered = !isSpec && item.quantityDelivered === 0;

            return (
              <tr
                key={idx}
                className={`group/row transition-colors h-6 ${
                  isZeroDelivered ? "print:hidden" : ""
                } ${!isReadOnly && isRowSelected && selectedCell === null ? "bg-blue-50/70" : ""}`}
              >
                {/* Col 0 (Editable Col 0): Stock/Property No */}
                <td
                  onClick={() => handleCellClick(idx, 0)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 0)}
                  className={`border-r-2 border-black border-b text-center align-top leading-normal relative ${
                    !isReadOnly ? "cursor-cell" : ""
                  } ${
                    selectedCell?.row === idx && selectedCell?.col === 0
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                  style={{ borderBottomStyle: "dashed" }}
                >
                  {isEditing && selectedCell?.row === idx && selectedCell?.col === 0 ? (
                    <input
                      ref={(el) => { activeInputRef.current = el; }}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      className="w-full h-full text-center bg-white border-0 outline-none p-0 m-0 leading-tight font-['Times_New_Roman',_Times,_serif] text-[14px]"
                    />
                  ) : (
                    <span>{item.propertyNo || (isSpec ? "" : displayNo)}</span>
                  )}

                  {selectedCell?.row === idx && selectedCell?.col === 0 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 1 (Editable Col 1): Description */}
                <td
                  onClick={() => handleCellClick(idx, 1)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 1)}
                  className={`border-r-2 border-black border-b px-2 align-top leading-normal relative ${
                    !isReadOnly ? "cursor-cell" : ""
                  } ${isSpec ? "" : hasSpecs ? "font-bold" : ""} ${
                    selectedCell?.row === idx && selectedCell?.col === 1
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                  style={{ borderBottomStyle: "dashed" }}
                >
                  {isEditing && selectedCell?.row === idx && selectedCell?.col === 1 ? (
                    <textarea
                      ref={(el) => { activeInputRef.current = el; }}
                      rows={1}
                      value={editValue}
                      onChange={(e) => {
                        setEditValue(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.max(20, e.target.scrollHeight)}px`;
                      }}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      className="w-full resize-none overflow-hidden bg-white border-0 outline-none p-0 m-0 leading-tight text-left block font-['Times_New_Roman',_Times,_serif] text-[14px]"
                      style={{ minHeight: "1.25rem", fontSize: "14px" }}
                    />
                  ) : (
                    <FormattedCellText text={item.description} fallback={"\u00A0"} />
                  )}

                  {selectedCell?.row === idx && selectedCell?.col === 1 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 2 (Editable Col 2): Unit */}
                <td
                  onClick={() => handleCellClick(idx, 2)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 2)}
                  className={`border-r-2 border-black border-b text-center align-top leading-normal relative ${
                    !isReadOnly ? "cursor-cell" : ""
                  } ${
                    selectedCell?.row === idx && selectedCell?.col === 2
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                  style={{ borderBottomStyle: "dashed" }}
                >
                  {isEditing && selectedCell?.row === idx && selectedCell?.col === 2 ? (
                    <input
                      ref={(el) => { activeInputRef.current = el; }}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      className="w-full h-full text-center bg-white border-0 outline-none p-0 m-0 leading-tight font-['Times_New_Roman',_Times,_serif] text-[14px]"
                    />
                  ) : (
                    <span>{isSpec ? "" : item.unit}</span>
                  )}

                  {selectedCell?.row === idx && selectedCell?.col === 2 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 3 (Editable Col 3): Quantity Delivered */}
                <td
                  onClick={() => handleCellClick(idx, 3)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 3)}
                  className={`border-b text-center font-bold align-top leading-normal relative ${
                    !isReadOnly ? "cursor-cell" : ""
                  } ${
                    selectedCell?.row === idx && selectedCell?.col === 3
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                  style={{ borderBottomStyle: "dashed" }}
                >
                  {isEditing && selectedCell?.row === idx && selectedCell?.col === 3 ? (
                    <input
                      ref={(el) => { activeInputRef.current = el; }}
                      type="number"
                      step="any"
                      min="0"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      className="w-full h-full text-center bg-white border-0 outline-none p-0 m-0 leading-tight font-['Times_New_Roman',_Times,_serif] text-[14px] font-bold"
                    />
                  ) : (
                    <span>{isSpec ? "" : item.quantityDelivered}</span>
                  )}

                  {selectedCell?.row === idx && selectedCell?.col === 3 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>
              </tr>
            );
          })}

          {/* Empty rows filler */}
          {Array.from({
            length: Math.max(
              0,
              targetRows - (safeItems.filter((i) => i.quantityDelivered > 0 || !i.poQuantity).length || 0)
            ),
          }).map((_, i) => (
            <tr key={`empty-${i}`} className="h-6">
              <td
                className="border-r-2 border-black border-b text-center"
                style={{ borderBottomStyle: "dashed" }}
              ></td>
              <td
                className="border-r-2 border-black border-b"
                style={{ borderBottomStyle: "dashed" }}
              ></td>
              <td
                className="border-r-2 border-black border-b text-center"
                style={{ borderBottomStyle: "dashed" }}
              ></td>
              <td className="border-b text-center" style={{ borderBottomStyle: "dashed" }}></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-b-2 border-black font-bold h-8">
            <td className="border-r-2 border-black"></td>
            <td className="border-r-2 border-black px-2">
              <div className="flex items-center">
                <span className="ml-16">TOTAL</span>
                <span className="flex-1 text-center">P</span>
                <span className="mr-2">{formatCurrency(totalAmount).replace("₱", "")}</span>
              </div>
            </td>
            <td className="border-r-2 border-black"></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
