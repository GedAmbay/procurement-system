"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus } from "lucide-react";

export interface RfqLineItem {
  id?: string;
  description: string;
  quantity: number | "";
  unit: string;
  descriptionEdited?: boolean;
}

interface RfqExcelTableGridProps {
  items: RfqLineItem[];
  targetRows?: number;
  isReadOnly?: boolean;
  onChange: (newItems: RfqLineItem[]) => void;
  onRowSelect?: (index: number) => void;
  onStartInsert?: (index: number) => void;
  activeItemIndex?: number | null;
  prItems?: { description: string }[];
  onDeselect?: () => void;
}

// Columns: 0 = Description, 1 = Qty, 2 = Unit
type EditableCol = 0 | 1 | 2;

export function RfqExcelTableGrid({
  items,
  targetRows = 8,
  isReadOnly = false,
  onChange,
  onRowSelect,
  onStartInsert,
  activeItemIndex = null,
  onDeselect,
}: RfqExcelTableGridProps) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: EditableCol } | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>("");

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const initialValueOnEditRef = useRef<string>("");

  const safeItems = items || [];
  const itemsRef = useRef<RfqLineItem[]>(safeItems);
  useEffect(() => {
    itemsRef.current = items || [];
  }, [items]);

  // Get raw string value of a cell
  const getCellValue = useCallback((row: number, col: EditableCol): string => {
    const list = itemsRef.current || [];
    const item = list[row];
    if (!item) return "";
    switch (col) {
      case 0: // Description
        return item.description || "";
      case 1: // Quantity
        return item.quantity === "" || item.quantity === null || item.quantity === undefined
          ? ""
          : String(item.quantity);
      case 2: // Unit
        return item.unit || "";
      default:
        return "";
    }
  }, []);

  // Commit value change for a cell
  const commitCellValue = useCallback((row: number, col: EditableCol, rawVal: string) => {
    if (isReadOnly) return;
    const trimmed = rawVal.trim();
    const currentList = itemsRef.current || [];

    if (trimmed === "" && row >= currentList.length) {
      return;
    }

    const newItems = [...currentList];
    while (newItems.length <= row) {
      newItems.push({
        description: "",
        unit: "Unit",
        quantity: 1,
      });
    }

    const current = { ...newItems[row] };
    switch (col) {
      case 0: { // Description
        current.description = rawVal;
        current.descriptionEdited = true;
        break;
      }
      case 1: { // Quantity
        current.quantity = trimmed === "" ? "" : isNaN(Number(trimmed)) ? 0 : Number(trimmed);
        break;
      }
      case 2: { // Unit
        current.unit = rawVal;
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
        const col = prev?.row === activeItemIndex ? prev.col : (prev?.col ?? 0);
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

    // Wrap column boundaries (cols 0, 1, 2)
    if (nextCol > 2) {
      nextCol = 0;
      nextRow += 1;
    } else if (nextCol < 0) {
      nextCol = 2;
      nextRow -= 1;
    }

    // Clamp row lower bound
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
      navigateTo(row + 1, col, false);
    } else if (e.key === "Enter" && e.shiftKey) {
      if (col !== 0) {
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
    } else if (col !== 0 && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
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
      <table className="w-full border-collapse border-[3px] border-black mb-1 table-fixed text-[11px]">
        <thead className="[&_th]:!font-sans print:!table-row-group" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
          <tr>
            <th className="border-x border-b-[3px] border-black py-0 px-1 w-[6%] text-center align-middle font-bold">
              ITEM <br />NO.
            </th>
            <th className="border-x border-b-[3px] border-black py-0 px-2 text-center align-middle font-bold">
              ITEM & DESCRIPTION
            </th>
            <th className="border-x border-b-[3px] border-black py-0 px-1 w-[8%] text-center align-middle font-bold">
              QTY
            </th>
            <th className="border-x border-b-[3px] border-black py-0 px-1 w-[8%] text-center align-middle font-bold">
              UNIT
            </th>
            <th className="border-x border-b-[3px] border-black py-0 px-1 w-[16%] text-center align-middle font-bold">
              UNIT<br />PRICE
            </th>
            <th className="border-x border-b-[3px] border-black py-0 px-1 w-[16%] text-center align-middle font-bold">
              TOTAL<br />COST
            </th>
          </tr>
        </thead>
        <tbody>
          {safeItems.map((item, idx) => {
            const isEmptyRow =
              !item.description?.trim() &&
              (!item.quantity || Number(item.quantity) === 0) &&
              !item.unit?.trim();

            const isSpec = !isEmptyRow && (!item.quantity || Number(item.quantity) === 0);

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

            const isRowSelected = selectedCell?.row === idx || activeItemIndex === idx;

            return (
              <tr
                key={idx}
                className={`group/row h-6 transition-colors ${
                  !isReadOnly && isRowSelected && selectedCell === null ? "bg-blue-50/70" : ""
                }`}
              >
                {/* Col 0 (Static): Item No */}
                <td className="border-x border-black py-0 px-1 text-center align-top leading-normal relative">
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

                {/* Col 1 (Editable Col 0): Item & Description */}
                <td
                  onClick={() => handleCellClick(idx, 0)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 0)}
                  className={`border-x border-black py-0 px-1.5 align-top leading-normal relative ${
                    !isReadOnly ? "cursor-cell" : ""
                  } ${isSpec ? "pl-4" : hasSpecs ? "font-bold" : ""} ${
                    selectedCell?.row === idx && selectedCell?.col === 0
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                >
                  {isEditing && selectedCell?.row === idx && selectedCell?.col === 0 ? (
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
                      className="w-full resize-none overflow-hidden bg-white border-0 outline-none p-0 m-0 leading-tight text-left block text-[11px]"
                      style={{ minHeight: "1.25rem", fontSize: "11px" }}
                    />
                  ) : (
                    <span>{item.description || "\u00A0"}</span>
                  )}

                  {selectedCell?.row === idx && selectedCell?.col === 0 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 2 (Editable Col 1): Qty */}
                <td
                  onClick={() => handleCellClick(idx, 1)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 1)}
                  className={`border-x border-black py-0 px-1 text-center align-top leading-normal relative ${
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
                    <span>{isSpec ? "" : item.quantity}</span>
                  )}

                  {selectedCell?.row === idx && selectedCell?.col === 1 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 3 (Editable Col 2): Unit */}
                <td
                  onClick={() => handleCellClick(idx, 2)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 2)}
                  className={`border-x border-black py-0 px-1 text-center align-top leading-normal relative ${
                    !isReadOnly ? "cursor-cell" : ""
                  } ${
                    selectedCell?.row === idx && selectedCell?.col === 2
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                >
                  {isEditing && selectedCell?.row === idx && selectedCell?.col === 2 ? (
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

                  {selectedCell?.row === idx && selectedCell?.col === 2 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 4 (Static): Unit Price for Bidders */}
                <td className="border-x border-black py-0 px-2 text-center align-top leading-normal">
                  {!isSpec && <span>P ___________</span>}
                </td>

                {/* Col 5 (Static): Total Cost for Bidders */}
                <td className="border-x border-black py-0 px-2 text-center align-top leading-normal">
                  {!isSpec && <span>P ___________</span>}
                </td>
              </tr>
            );
          })}

          {/* Empty rows filler */}
          {Array.from({ length: Math.max(0, targetRows - safeItems.length) }).map((_, i) => {
            const emptyRowIdx = safeItems.length + i;
            return (
              <tr key={`empty-${i}`} className="h-6">
                <td className="border-x border-black py-0 px-1 text-center"></td>
                {[0, 1, 2].map((col) => {
                  const isSelected = selectedCell?.row === emptyRowIdx && selectedCell?.col === col;
                  const isEditingThis = isEditing && isSelected;
                  return (
                    <td
                      key={col}
                      onClick={() => handleCellClick(emptyRowIdx, col as EditableCol)}
                      onDoubleClick={() => handleCellDoubleClick(emptyRowIdx, col as EditableCol)}
                      className={`border-x border-black p-0 leading-tight ${
                        col === 0 ? "text-left px-1.5" : "text-center"
                      } align-top relative ${!isReadOnly ? "cursor-cell" : ""} ${
                        isSelected ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20" : ""
                      }`}
                    >
                      {isEditingThis ? (
                        col === 0 ? (
                          <textarea
                            ref={(el) => { activeInputRef.current = el; }}
                            rows={1}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            onBlur={handleInputBlur}
                            className="w-full resize-none overflow-hidden bg-white border-0 outline-none p-0 m-0 leading-tight text-left block text-[11px]"
                            style={{ minHeight: "1.25rem", fontSize: "11px" }}
                          />
                        ) : (
                          <input
                            ref={(el) => { activeInputRef.current = el; }}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            onBlur={handleInputBlur}
                            className="w-full h-full text-center bg-white border-0 outline-none p-0 m-0 leading-tight"
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
                <td className="border-x border-black py-0 px-2 text-center"></td>
                <td className="border-x border-black py-0 px-2 text-center"></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
