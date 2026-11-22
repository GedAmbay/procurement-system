"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface PrLineItem {
  itemId: string | null;
  description: string;
  unit: string;
  quantity: number | "";
  unitCost: number | "";
}

interface ExcelTableGridProps {
  items: PrLineItem[];
  targetRows?: number;
  isReadOnly?: boolean;
  onChange: (newItems: PrLineItem[]) => void;
  onRowSelect?: (index: number) => void;
  onStartInsert?: (index: number) => void;
  insertAtIndex?: number | null;
  activeItemIndex?: number | null;
  totalAmount: number;
  onDeselect?: () => void;
}

// Columns: 0 = Quantity, 1 = Unit, 2 = Description, 3 = Unit Cost
type EditableCol = 0 | 1 | 2 | 3;

export function ExcelTableGrid({
  items,
  targetRows = 21,
  isReadOnly = false,
  onChange,
  onRowSelect,
  onStartInsert,
  insertAtIndex = null,
  activeItemIndex = null,
  totalAmount,
  onDeselect,
}: ExcelTableGridProps) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: EditableCol } | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>("");

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const initialValueOnEditRef = useRef<string>("");

  // Ensure items is always an array and keep a synchronous ref
  const safeItems = items || [];
  const itemsRef = useRef<PrLineItem[]>(safeItems);
  useEffect(() => {
    itemsRef.current = items || [];
  }, [items]);

  // Get raw string value of a cell
  const getCellValue = useCallback((row: number, col: EditableCol): string => {
    const list = itemsRef.current || [];
    const item = list[row];
    if (!item) return "";
    switch (col) {
      case 0: // Quantity
        return item.quantity === "" || item.quantity === null || item.quantity === undefined
          ? ""
          : String(item.quantity);
      case 1: // Unit
        return item.unit || "";
      case 2: // Description
        return item.description || "";
      case 3: // Unit Cost
        return item.unitCost === "" || item.unitCost === null || item.unitCost === undefined
          ? ""
          : String(item.unitCost);
      default:
        return "";
    }
  }, []);

  // Commit value change for a cell
  const commitCellValue = useCallback((row: number, col: EditableCol, rawVal: string) => {
    if (isReadOnly) return;
    const trimmed = rawVal.trim();
    const currentList = itemsRef.current || [];

    // If committing an empty value on a row past existing items, don't create phantom empty rows
    if (trimmed === "" && row >= currentList.length) {
      return;
    }

    const newItems = [...currentList];
    // If committing to an appended row that doesn't exist yet, create items as main items
    while (newItems.length <= row) {
      newItems.push({
        itemId: null,
        description: "",
        unit: "Unit",
        quantity: 1,
        unitCost: "",
      });
    }

    const current = { ...newItems[row] };
    switch (col) {
      case 0: { // Quantity
        current.quantity = trimmed === "" ? "" : isNaN(Number(trimmed)) ? 0 : Number(trimmed);
        break;
      }
      case 1: // Unit
        current.unit = rawVal;
        break;
      case 2: // Description
        current.description = rawVal;
        break;
      case 3: { // Unit Cost
        current.unitCost = trimmed === "" ? "" : isNaN(Number(trimmed)) ? 0 : Number(trimmed);
        break;
      }
    }

    newItems[row] = current;
    itemsRef.current = newItems; // Synchronously update ref so subsequent operations in same tick read fresh data
    onChange(newItems);
  }, [isReadOnly, onChange]);

  // Enter edit mode without overwriting existing content (optionally appending initial typed char)
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
      // Place cursor at the end (do NOT select all, do NOT overwrite)
      const len = activeInputRef.current.value.length;
      activeInputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Keep selection container focused when in selection mode
  useEffect(() => {
    if (!isEditing && selectedCell && gridContainerRef.current) {
      // Focus the container so it captures arrow keys
      gridContainerRef.current.focus({ preventScroll: true });
    }
  }, [selectedCell, isEditing]);

  // Synchronize cell highlight when active row changes from parent (e.g. Next/Prev buttons in side panel)
  useEffect(() => {
    if (activeItemIndex !== null && activeItemIndex !== undefined) {
      setSelectedCell((prev) => {
        // If already highlighting this row, keep the current column; otherwise default to col 2 (Description)
        const col = prev?.row === activeItemIndex ? prev.col : (prev?.col ?? 2);
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

    // Wrap column boundaries
    if (nextCol > 3) {
      nextCol = 0;
      nextRow += 1;
    } else if (nextCol < 0) {
      nextCol = 3;
      nextRow -= 1;
    }

    // Clamp row lower bound
    if (nextRow < 0) {
      nextRow = 0;
    }

    // Clamp row upper bound
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

  // Keyboard navigation when in SELECTION MODE (container has focus)
  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isReadOnly || !selectedCell || isEditing) return;

    const { row, col } = selectedCell;

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
        e.preventDefault();
        // Pressing Enter in Excel enters edit mode (or moves down if already edited)
        startEditing(row, col);
        break;
      case "F2":
        e.preventDefault();
        startEditing(row, col);
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        commitCellValue(row, col, "");
        break;
      case "Escape":
        e.preventDefault();
        setSelectedCell(null);
        setIsEditing(false);
        if (onDeselect) onDeselect();
        break;
      default:
        // When typing any character key (without immediate overwrite!):
        // Enter edit mode while PRESERVING the existing content and appending the typed key
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          startEditing(row, col, e.key);
        }
        break;
    }
  };

  // Keyboard navigation when in EDIT MODE (input has focus)
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitCellValue(row, col, editValue);
      // Excel Enter: commit and move DOWN
      navigateTo(row + 1, col, false);
    } else if (e.key === "Enter" && e.shiftKey) {
      // In textarea, Shift+Enter inserts newline. In single-line inputs, Shift+Enter moves UP
      if (col !== 2) {
        e.preventDefault();
        commitCellValue(row, col, editValue);
        navigateTo(row - 1, col, false);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitCellValue(row, col, editValue);
      // Excel Tab: commit and move RIGHT / Shift+Tab: move LEFT
      if (e.shiftKey) {
        navigateTo(row, (col - 1) as EditableCol, false);
      } else {
        navigateTo(row, (col + 1) as EditableCol, false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Excel Esc: cancel edit and revert to initial value
      setEditValue(initialValueOnEditRef.current);
      setIsEditing(false);
    } else if (col !== 2 && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      // In single-line inputs (quantity, unit, unitCost), Up/Down commits and navigates
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
      className="outline-none w-full"
    >
      <table className="w-full table-fixed border-collapse text-sm border-b-4 border-double border-black select-none">
        <thead className="print:!table-row-group">
          <tr className="bg-white">
            <th className="border border-black border-t-0 border-l-0 p-1 font-bold text-center w-[7%]">
              Item<br />No.
            </th>
            <th className="border border-black border-t-0 p-1 font-bold text-center w-[11%]">
              Quantity
            </th>
            <th className="border border-black border-t-0 p-1 font-bold text-center w-[12%]">
              Unit Of<br />Issue
            </th>
            <th className="border border-black border-t-0 p-1 font-bold text-center w-[40%]">
              Item Description
            </th>
            <th className="border border-black border-t-0 p-1 font-bold text-center w-[15%]">
              Estimated<br />Unit Cost
            </th>
            <th className="border border-black border-t-0 border-r-0 p-1 font-bold text-center w-[15%]">
              Estimated<br />Cost
            </th>
          </tr>
        </thead>

        <tbody>
          {safeItems.map((item, idx) => {
            const isEmptyRow =
              !item.description?.trim() &&
              (!item.quantity || Number(item.quantity) === 0) &&
              (!item.unitCost || Number(item.unitCost) === 0);
            const isSpec = !isEmptyRow && (!item.quantity || Number(item.quantity) === 0);

            // Calculate item number dynamically
            let displayNo = "";
            if (!isSpec && !isEmptyRow) {
              let count = 0;
              for (let i = 0; i <= idx; i++) {
                if (Number(safeItems[i].quantity) > 0) count++;
              }
              displayNo = count.toString();
            }

            const hasSpecs =
              !isSpec &&
              idx + 1 < safeItems.length &&
              safeItems[idx + 1].description?.trim() &&
              (!safeItems[idx + 1].quantity || Number(safeItems[idx + 1].quantity) === 0);

            const rowAmount =
              item.quantity && item.unitCost ? Number(item.quantity) * Number(item.unitCost) : 0;

            const isRowSelected = selectedCell?.row === idx || activeItemIndex === idx;

            return (
              <React.Fragment key={idx}>
                {insertAtIndex === idx && !isReadOnly && (
                  <tr className="no-print">
                    <td colSpan={6} className="p-0 border-x-0 border-y-2 border-blue-500 bg-blue-50/50">
                      <div className="flex items-center justify-center py-0.5 text-[10px] font-bold text-blue-700">
                        <span className="bg-blue-600 text-white px-2 py-0.2 rounded-full text-[9px] uppercase tracking-wider">
                          Insert Row {idx + 1} Here
                        </span>
                      </div>
                    </td>
                  </tr>
                )}

                <tr
                  className={`group/row h-6 transition-colors ${
                    !isReadOnly && isRowSelected && selectedCell === null
                      ? "bg-blue-50/70"
                      : ""
                  }`}
                >
                  {/* Col 0 (Static): Item No */}
                  <td className="border border-black border-l-0 p-0 leading-tight text-center align-top relative">
                    {!isReadOnly && onStartInsert && (
                      <div className="absolute top-1/2 left-[-26px] -translate-y-1/2 opacity-0 group-hover/row:opacity-100 transition-opacity no-print z-30 flex items-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartInsert(idx + 1);
                          }}
                          className="w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110"
                          title={`Insert row below ${isSpec ? "specification" : `Item #${displayNo || idx + 1}`}`}
                        >
                          <Plus size={12} className="stroke-[3]" />
                        </button>
                      </div>
                    )}
                    {displayNo}
                  </td>

                  {/* Col 1 (Editable Col 0): Quantity */}
                  <td
                    onClick={() => handleCellClick(idx, 0)}
                    onDoubleClick={() => handleCellDoubleClick(idx, 0)}
                    className={`border border-black p-0 leading-tight text-center align-top relative ${
                      !isReadOnly ? "cursor-cell" : ""
                    } ${
                      selectedCell?.row === idx && selectedCell?.col === 0
                        ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                        : ""
                    }`}
                  >
                    {isEditing && selectedCell?.row === idx && selectedCell?.col === 0 ? (
                      <input
                        ref={(el) => { activeInputRef.current = el; }}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        onBlur={handleInputBlur}
                        className="w-full h-full text-center bg-white border-0 outline-none p-0 m-0 leading-tight"
                      />
                    ) : (
                      <span>{isSpec ? "" : item.quantity}</span>
                    )}

                    {/* Excel Fill Handle */}
                    {selectedCell?.row === idx && selectedCell?.col === 0 && !isEditing && (
                      <div
                        className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                        style={{ border: "1px solid #ffffff" }}
                      />
                    )}
                  </td>

                  {/* Col 2 (Editable Col 1): Unit */}
                  <td
                    onClick={() => handleCellClick(idx, 1)}
                    onDoubleClick={() => handleCellDoubleClick(idx, 1)}
                    className={`border border-black p-0 leading-tight text-center align-top relative ${
                      !isReadOnly ? "cursor-cell" : ""
                    } ${
                      selectedCell?.row === idx && selectedCell?.col === 1
                        ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                        : ""
                    }`}
                  >
                    {isEditing && selectedCell?.row === idx && selectedCell?.col === 1 ? (
                      <input
                        ref={(el) => { activeInputRef.current = el; }}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        onBlur={handleInputBlur}
                        className="w-full h-full text-center bg-white border-0 outline-none p-0 m-0 leading-tight"
                      />
                    ) : (
                      <span>{isSpec ? "" : item.unit}</span>
                    )}

                    {/* Excel Fill Handle */}
                    {selectedCell?.row === idx && selectedCell?.col === 1 && !isEditing && (
                      <div
                        className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                        style={{ border: "1px solid #ffffff" }}
                      />
                    )}
                  </td>

                  {/* Col 3 (Editable Col 2): Description */}
                  <td
                    onClick={() => handleCellClick(idx, 2)}
                    onDoubleClick={() => handleCellDoubleClick(idx, 2)}
                    className={`border border-black p-0 px-1 leading-tight whitespace-normal break-words align-top relative ${
                      !isReadOnly ? "cursor-cell" : ""
                    } ${isSpec ? "pl-4 text-sm" : hasSpecs ? "font-bold" : ""} ${
                      selectedCell?.row === idx && selectedCell?.col === 2
                        ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                        : ""
                    }`}
                  >
                    {isEditing && selectedCell?.row === idx && selectedCell?.col === 2 ? (
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
                        className="w-full resize-none overflow-hidden bg-white border-0 outline-none p-0 m-0 leading-tight text-left block"
                        style={{ minHeight: "1.25rem" }}
                      />
                    ) : (
                      <span>{item.description || "\u00A0"}</span>
                    )}

                    {/* Excel Fill Handle */}
                    {selectedCell?.row === idx && selectedCell?.col === 2 && !isEditing && (
                      <div
                        className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                        style={{ border: "1px solid #ffffff" }}
                      />
                    )}
                  </td>

                  {/* Col 4 (Editable Col 3): Estimated Unit Cost */}
                  <td
                    onClick={() => handleCellClick(idx, 3)}
                    onDoubleClick={() => handleCellDoubleClick(idx, 3)}
                    className={`border border-black p-0 leading-tight text-right align-top pr-1 relative ${
                      !isReadOnly ? "cursor-cell" : ""
                    } ${
                      selectedCell?.row === idx && selectedCell?.col === 3
                        ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                        : ""
                    }`}
                  >
                    {isEditing && selectedCell?.row === idx && selectedCell?.col === 3 ? (
                      <input
                        ref={(el) => { activeInputRef.current = el; }}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        onBlur={handleInputBlur}
                        className="w-full h-full text-right bg-white border-0 outline-none p-0 m-0 leading-tight pr-1"
                      />
                    ) : (
                      <span>
                        {isSpec
                          ? ""
                          : item.unitCost
                          ? formatCurrency(Number(item.unitCost)).replace("₱", "")
                          : "0.00"}
                      </span>
                    )}

                    {/* Excel Fill Handle */}
                    {selectedCell?.row === idx && selectedCell?.col === 3 && !isEditing && (
                      <div
                        className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                        style={{ border: "1px solid #ffffff" }}
                      />
                    )}
                  </td>

                  {/* Col 5 (Static): Estimated Total Cost */}
                  <td className="border border-black border-r-0 p-0 leading-tight text-right align-top pr-1">
                    {isSpec
                      ? ""
                      : rowAmount > 0
                      ? formatCurrency(rowAmount).replace("₱", "")
                      : "0.00"}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}

          {/* Empty rows filler */}
          {Array.from({ length: Math.max(0, targetRows - safeItems.length) }).map((_, i) => {
            const emptyRowIdx = safeItems.length + i;
            return (
              <tr key={`empty-${i}`} className="h-6">
                <td className="border border-black border-l-0 p-0"></td>
                {[0, 1, 2, 3].map((col) => {
                  const isSelected = selectedCell?.row === emptyRowIdx && selectedCell?.col === col;
                  const isEditingThis = isEditing && isSelected;
                  return (
                    <td
                      key={col}
                      onClick={() => handleCellClick(emptyRowIdx, col as EditableCol)}
                      onDoubleClick={() => handleCellDoubleClick(emptyRowIdx, col as EditableCol)}
                      className={`border border-black p-0 leading-tight ${
                        col === 2 ? "text-left px-1" : col === 3 ? "text-right pr-1" : "text-center"
                      } align-top relative ${!isReadOnly ? "cursor-cell" : ""} ${
                        isSelected ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20" : ""
                      }`}
                    >
                      {isEditingThis ? (
                        col === 2 ? (
                          <textarea
                            ref={(el) => { activeInputRef.current = el; }}
                            rows={1}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            onBlur={handleInputBlur}
                            className="w-full resize-none overflow-hidden bg-white border-0 outline-none p-0 m-0 leading-tight text-left block"
                            style={{ minHeight: "1.25rem" }}
                          />
                        ) : (
                          <input
                            ref={(el) => { activeInputRef.current = el; }}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            onBlur={handleInputBlur}
                            className={`w-full h-full ${
                              col === 3 ? "text-right pr-1" : "text-center"
                            } bg-white border-0 outline-none p-0 m-0 leading-tight`}
                          />
                        )
                      ) : null}

                      {isSelected && !isEditing && (
                        <div
                          className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                          style={{ border: "1px solid #ffffff" }}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="border border-black border-r-0 p-0"></td>
              </tr>
            );
          })}

          {/* Grand Total Row */}
          <tr className="h-6">
            <td colSpan={5} className="border border-black border-l-0 border-b-0 p-0 font-bold text-right pr-2">
              TOTAL
            </td>
            <td className="border border-black border-r-0 border-b-0 p-0 text-right pr-1 font-bold">
              {totalAmount > 0 ? formatCurrency(totalAmount).replace("₱", "") : "-"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
